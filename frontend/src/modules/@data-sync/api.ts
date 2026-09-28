import { axiosInstance } from "../../_service/axious";
import { BASE_URL } from "@common/options";

/**
 * Talks directly to the data-sync endpoints rather than going through Refine's
 * data provider — these are RPC-shaped (start a run, decide changes, apply), not
 * REST resources, the same reason @catalog/import.tsx calls axios directly.
 */

export type SyncKind = "cricos_register" | "site_scrape" | "ai_curation";

export type SyncStatus =
  | "queued"
  | "running"
  | "awaiting_review"
  | "applying"
  | "done"
  | "failed"
  | "cancelled";

export type ChangeType = "create" | "update" | "unchanged" | "disappeared";
export type ChangeDecision = "pending" | "accepted" | "rejected" | "applied";
export type EntityType = "university" | "course" | "admission_policy";

/** How far back a record counts as stale. Scopes what's compared, not what's downloaded. */
export type StalenessWindow = "7w" | "1m" | "3m" | "6m" | "all";

export interface SyncTotals {
  step?: string;
  processed?: number;
  total?: number;
  created?: number;
  updated?: number;
  unchanged?: number;
  disappeared?: number;
  auto_applied?: number;
  applied?: number;
  failed?: number;
}

export interface SyncLogEntry {
  at: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface SyncRun {
  id: string;
  kind: SyncKind;
  status: SyncStatus;
  params: Record<string, unknown>;
  totals: SyncTotals;
  source_meta: Record<string, { last_modified?: string | null; name?: string } | undefined>;
  log: SyncLogEntry[];
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface FieldDiff {
  field: string;
  before: unknown;
  after: unknown;
}

export interface SyncChange {
  id: string;
  entity_type: EntityType;
  entity_id: string | null;
  natural_key: string | null;
  label: string;
  change_type: ChangeType;
  field_diffs: FieldDiff[];
  auto_applied: boolean;
  decision: ChangeDecision;
  confidence: number | null;
  apply_error: string | null;
}

export interface ResourceMeta {
  id: string;
  name: string;
  last_modified: string | null;
  size: number | null;
  format: string;
}

export interface CricosStatus {
  last_sync: { id: string; finished_at: string | null; totals: SyncTotals } | null;
  upstream: Record<"institutions" | "courses" | "locations", ResourceMeta | null> | null;
  upstream_error: string | null;
  /** True when data.gov.au hasn't republished since our last completed sync. */
  source_unchanged: boolean;
  catalogue: {
    universities: number;
    courses: number;
    stale_universities: number;
    stale_courses: number;
    never_fetched_courses: number;
    courses_without_sourced_english: number;
  };
  tracked_sources: number;
}

const url = (path: string) => `${BASE_URL}/data-sync${path}`;

export async function getCricosStatus(): Promise<CricosStatus> {
  const { data } = await axiosInstance.get<CricosStatus>(url("/sources/cricos/status"));
  return data;
}

export interface StartCricosParams {
  window?: StalenessWindow;
  include_vet?: boolean;
  states?: string[];
  institution_types?: string[];
}

export async function startCricosRun(params: StartCricosParams): Promise<SyncRun> {
  const { data } = await axiosInstance.post<SyncRun>(url("/runs/cricos"), params);
  return data;
}

export async function listRuns(kind?: SyncKind, limit = 15): Promise<SyncRun[]> {
  const { data } = await axiosInstance.get<SyncRun[]>(url("/runs"), {
    params: { kind, limit },
  });
  return data;
}

export async function getRun(id: string): Promise<SyncRun> {
  const { data } = await axiosInstance.get<SyncRun>(url(`/runs/${id}`));
  return data;
}

export interface SummaryRow {
  entity_type: EntityType;
  change_type: ChangeType;
  decision: ChangeDecision;
  count: number;
}

export async function getSummary(id: string): Promise<SummaryRow[]> {
  const { data } = await axiosInstance.get<SummaryRow[]>(url(`/runs/${id}/summary`));
  return data;
}

export interface ListChangesParams {
  entity_type?: EntityType;
  change_type?: ChangeType;
  decision?: ChangeDecision;
  q?: string;
  skip?: number;
  take?: number;
}

export async function listChanges(
  id: string,
  params: ListChangesParams,
): Promise<{ items: SyncChange[]; total: number }> {
  const { data } = await axiosInstance.get<{ items: SyncChange[]; total: number }>(
    url(`/runs/${id}/changes`),
    { params },
  );
  return data;
}

export async function decideChanges(
  id: string,
  body: {
    ids?: string[];
    decision: "accepted" | "rejected";
    all?: boolean;
    entity_type?: EntityType;
    change_type?: ChangeType;
  },
): Promise<{ updated: number }> {
  const { data } = await axiosInstance.patch<{ updated: number }>(url(`/runs/${id}/changes`), body);
  return data;
}

export async function applyRun(id: string): Promise<SyncRun> {
  const { data } = await axiosInstance.post<SyncRun>(url(`/runs/${id}/apply`), {});
  return data;
}

export async function cancelRun(id: string): Promise<SyncRun> {
  const { data } = await axiosInstance.delete<SyncRun>(url(`/runs/${id}`));
  return data;
}

/** A run is still working, so the UI should keep polling. */
export const isRunActive = (s: SyncStatus) =>
  s === "queued" || s === "running" || s === "applying";

export const STALENESS_LABELS: Record<StalenessWindow, string> = {
  "7w": "Older than 7 weeks",
  "1m": "Older than 1 month",
  "3m": "Older than 3 months",
  "6m": "Older than 6 months",
  all: "Everything, regardless of age",
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Renders a diff value for display without turning null into an empty cell. */
export function renderValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}

// ---------------------------------------------------------------------------
// Phase 2: per-institution requirement sourcing + the known-source registry
// ---------------------------------------------------------------------------

export type FetchStatus =
  | "ok"
  | "unchanged"
  | "blocked_by_robots"
  | "http_error"
  | "fetch_error"
  | "never_fetched";

export type TrustTier = "authoritative" | "reliable" | "unverified";

export interface SourcePage {
  id: string;
  url: string;
  domain: string;
  trust_tier: TrustTier;
  data_kinds: string[];
  description: string;
  entity_type: "university" | "course" | "admission_policy" | null;
  entity_id: string | null;
  last_fetched_at: string | null;
  last_changed_at: string | null;
  http_status: number | null;
  fetch_status: FetchStatus;
  robots_allowed: boolean;
  verified_at: string | null;
  notes: string;
}

export type AutoSourceReason =
  | "anti_bot"
  | "robots_disallow"
  | "client_rendered"
  | "unreachable"
  | "no_website";

export interface BlockedInstitution {
  id: string;
  name: string;
  website: string | null;
  auto_source_reason: AutoSourceReason | null;
  auto_source_note: string;
  auto_source_checked_at: string | null;
  auto_source_failures: number;
}

export interface SourcesStatus {
  pages: { tracked: number; ok: number; blocked_by_robots: number; http_error: number; orphaned?: number };
  /** Institutions the scraper has established it cannot read at all. */
  auto_source: {
    blocked_institutions: number;
    by_reason: { reason: string; count: number }[];
  };
  coverage: {
    courses_with_sourced_band: number;
    courses_total: number;
    institutions_with_a_source: number;
    institutions_total: number;
  };
}

export interface StartSiteScrapeParams {
  university_ids?: string[];
  only_missing?: boolean;
  stale_days?: number;
  limit?: number;
  max_pages?: number;
}

export async function getSourcesStatus(): Promise<SourcesStatus> {
  const { data } = await axiosInstance.get<SourcesStatus>(url("/sources/status"));
  return data;
}

export async function listSourcePages(params: {
  entity_id?: string;
  fetch_status?: string;
  q?: string;
  skip?: number;
  take?: number;
}): Promise<{ items: SourcePage[]; total: number }> {
  const { data } = await axiosInstance.get<{ items: SourcePage[]; total: number }>(url("/sources"), {
    params,
  });
  return data;
}

export async function updateSourcePage(
  id: string,
  patch: { description?: string; data_kinds?: string[]; notes?: string; verified?: boolean },
): Promise<SourcePage> {
  const { data } = await axiosInstance.patch<SourcePage>(url(`/sources/${id}`), patch);
  return data;
}

export async function startSiteScrape(params: StartSiteScrapeParams): Promise<SyncRun> {
  const { data } = await axiosInstance.post<SyncRun>(url("/runs/site-scrape"), params);
  return data;
}

export const FETCH_STATUS_LABELS: Record<FetchStatus, string> = {
  ok: "read",
  unchanged: "unchanged",
  blocked_by_robots: "blocked by robots.txt",
  http_error: "HTTP error",
  fetch_error: "could not fetch",
  never_fetched: "never fetched",
};

export async function listBlockedInstitutions(): Promise<{
  items: BlockedInstitution[];
  total: number;
}> {
  const { data } = await axiosInstance.get<{ items: BlockedInstitution[]; total: number }>(
    url("/sources/blocked"),
    // 200 is the server's hard cap (ListSourcePagesDto @Max). Asking for more
    // returned a 400 that took the whole Sources page down with it.
    { params: { take: 200 } },
  );
  return data;
}

/** Why a site can't be read, and what to do about it instead. */
export const BLOCKED_REASON_LABELS: Record<AutoSourceReason, string> = {
  anti_bot: "Blocks automated requests (HTTP 403)",
  robots_disallow: "robots.txt disallows the page",
  client_rendered: "Content only exists after JavaScript runs",
  unreachable: "Site could not be reached",
  no_website: "No usable website in the register",
};

// ---------------------------------------------------------------------------
// Phase 3: conversational curation (instruction + URLs + file uploads)
// ---------------------------------------------------------------------------

export interface CurationAttachment {
  kind: "url" | "file";
  label: string;
  url?: string;
  status: "read" | "failed";
  reason?: string;
  chars?: number;
  source_page_id?: string;
}

export interface ProposedChange {
  entity_type: EntityType;
  entity_id: string | null;
  label: string;
  field: string;
  before: unknown;
  after: unknown;
  quote: string;
  cited: string;
  confidence: number;
  sync_change_id?: string;
}

export interface CurationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments: CurationAttachment[];
  proposals: ProposedChange[];
  created_at: string;
}

export interface CurationSession {
  id: string;
  title: string;
  entity_type: EntityType | null;
  entity_id: string | null;
  sync_run_id: string | null;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
}

const cUrl = (path: string) => `${BASE_URL}/data-sync/curation${path}`;

export async function createCurationSession(body: {
  entity_type?: EntityType;
  entity_id?: string;
  title?: string;
}): Promise<CurationSession> {
  const { data } = await axiosInstance.post<CurationSession>(cUrl("/sessions"), body);
  return data;
}

export async function listCurationSessions(entityId?: string): Promise<CurationSession[]> {
  const { data } = await axiosInstance.get<CurationSession[]>(cUrl("/sessions"), {
    params: { entity_id: entityId },
  });
  return data;
}

export async function getCurationSession(id: string): Promise<{
  session: CurationSession;
  messages: CurationMessage[];
  subject: Record<string, unknown> | null;
}> {
  const { data } = await axiosInstance.get(cUrl(`/sessions/${id}`));
  return data;
}

/** Multipart so an instruction, pasted URLs and files travel in one turn. */
export async function sendCurationMessage(
  id: string,
  input: { content: string; urls: string[]; files: File[] },
): Promise<{ user_message: CurationMessage; assistant_message: CurationMessage }> {
  const form = new FormData();
  form.append("content", input.content);
  if (input.urls.length) form.append("urls", JSON.stringify(input.urls));
  for (const f of input.files) form.append("files", f);
  const { data } = await axiosInstance.post(cUrl(`/sessions/${id}/messages`), form);
  return data;
}

// ---------------------------------------------------------------------------
// Assessment coverage — what the catalogue cannot answer, and why
// ---------------------------------------------------------------------------

export type CoverageGapKind =
  | "no_band_at_level"
  | "ambiguous_bands"
  | "band_without_academic_figure"
  | "band_without_english_figure";

export interface CoverageGap {
  policy_key: string;
  institution: string;
  /** Every catalogue institution the gap applies to — one briefing can govern several. */
  universities: string[];
  program_level: "UG" | "PG" | "PG_RESEARCH" | "PATHWAY";
  degree_levels: string[];
  kind: CoverageGapKind;
  courses: number;
  bands_defined: number;
  example_courses: string[];
}

export interface CoverageReport {
  courses_checked: number;
  courses_assessable: number;
  courses_blocked: number;
  by_kind: Record<CoverageGapKind, number>;
  gaps: CoverageGap[];
}

export async function getCoverageGaps(): Promise<CoverageReport> {
  const { data } = await axiosInstance.get<CoverageReport>(url("/coverage-gaps"));
  return data;
}

// ---------------------------------------------------------------------------
// Policy <-> course consistency
// ---------------------------------------------------------------------------

export interface EntryDisagreement {
  course_id: string;
  course: string;
  institution: string;
  policy_key: string;
  band_label: string;
  course_band: number | null;
  course_source: string | null;
  course_source_kind: "human_verified" | "provider_page" | "admission_policy" | "aggregator" | "none";
  policy_band: number | null;
  resolution: "policy wins" | "course wins" | "equal" | "no policy figure";
}

export interface ConsistencyReport {
  checked: number;
  disagreements: EntryDisagreement[];
  summary: Record<string, number>;
}

export async function getConsistency(): Promise<ConsistencyReport> {
  const { data } = await axiosInstance.get<ConsistencyReport>(url("/consistency"));
  return data;
}

export async function reconcileConsistency(
  apply: boolean,
): Promise<{ dry_run: boolean; updated: number; skipped_stronger_source: number }> {
  const { data } = await axiosInstance.post(
    url(`/consistency/reconcile${apply ? "?apply=true" : ""}`),
    {},
  );
  return data;
}

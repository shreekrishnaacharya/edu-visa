import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VerifiedIcon from "@mui/icons-material/Verified";
import BlockIcon from "@mui/icons-material/Block";

import { RefineListView } from "@components/view/list";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import {
  ConsistencyReport,
  getConsistency,
  reconcileConsistency,
  ReconcileDirection,
  RECONCILE_LABELS,
  BLOCKED_REASON_LABELS,
  BlockedInstitution,
  listBlockedInstitutions,
  FETCH_STATUS_LABELS,
  FetchStatus,
  formatDate,
  getSourcesStatus,
  listSourcePages,
  SourcePage,
  SourcesStatus,
  startSiteScrape,
  updateSourcePage,
} from "./api";

const STATUS_COLOUR: Record<FetchStatus, "success" | "default" | "warning" | "error"> = {
  ok: "success",
  unchanged: "default",
  blocked_by_robots: "warning",
  http_error: "error",
  fetch_error: "error",
  never_fetched: "default",
};

const TIER_COLOUR = {
  authoritative: "success",
  reliable: "info",
  unverified: "warning",
} as const;

/**
 * The known-source registry: every page the system has read a requirement from,
 * what it holds, and when it was last checked.
 *
 * Two jobs at once — provenance for the bands in the catalogue, and the context
 * the AI uses to know where a given fact has been found before, so it looks in
 * known-good places instead of rediscovering a university's site each time.
 */
export function SourceRegistryPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SourcesStatus | null>(null);
  const [pages, setPages] = useState<SourcePage[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<SourcePage | null>(null);
  const [draft, setDraft] = useState("");
  const [starting, setStarting] = useState(false);
  const [blocked, setBlocked] = useState<BlockedInstitution[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [consistency, setConsistency] = useState<ConsistencyReport | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [direction, setDirection] = useState<ReconcileDirection>("policy_to_course");

  const load = useCallback(async () => {
    try {
      // Settled, not all: one failing side-query (the blocked-institutions list)
      // previously rejected the whole Promise.all and left the page blank with
      // only a validation message. A secondary panel failing should cost that
      // panel, not the page.
      const [sRes, pRes, bRes, cRes] = await Promise.allSettled([
        getSourcesStatus(),
        listSourcePages({ fetch_status: statusFilter || undefined, q: query || undefined, take: 100 }),
        listBlockedInstitutions(),
        getConsistency(),
      ]);
      if (sRes.status === "fulfilled") setStatus(sRes.value);
      else throw sRes.reason;
      if (pRes.status === "fulfilled") {
        setPages(pRes.value.items);
        setTotal(pRes.value.total);
      }
      setBlocked(bRes.status === "fulfilled" ? bRes.value.items : []);
      setConsistency(cRes.status === "fulfilled" ? cRes.value : null);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Could not load the source registry");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, query]);

  useEffect(() => {
    void load();
  }, [statusFilter]);

  const scrape = async () => {
    setStarting(true);
    setError(null);
    try {
      const run = await startSiteScrape({ limit: 10, max_pages: 3, only_missing: true });
      navigate(`/data-sync/runs/${run.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Could not start the scrape");
    } finally {
      setStarting(false);
    }
  };

  const runReconcile = async (force = false) => {
    setReconciling(true);
    setError(null);
    try {
      const res = await reconcileConsistency({ direction, apply: true, force });
      const refused = res.skipped.filter((s) => /governs/.test(s.reason));
      setNotice(
        direction === "keep_both"
          ? `Left ${res.skipped.length} disagreement(s) as they are — nothing was written.`
          : `${RECONCILE_LABELS[direction]} — updated ${res.updated}.` +
              (res.skipped.length ? ` ${res.skipped.length} skipped.` : ""),
      );
      if (refused.length) setError(refused[0].reason);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Reconcile failed");
    } finally {
      setReconciling(false);
    }
  };

  const saveDescription = async () => {
    if (!editing) return;
    await updateSourcePage(editing.id, { description: draft, verified: true });
    setEditing(null);
    await load();
  };

  const c = status?.coverage;
  const bandPct = c?.courses_total ? Math.round((c.courses_with_sourced_band / c.courses_total) * 100) : 0;
  const instPct = c?.institutions_total
    ? Math.round((c.institutions_with_a_source / c.institutions_total) * 100)
    : 0;

  return (
    <RefineListView
      title="Requirement sources"
      breadcrumb={
        <AppBreadcrumbs items={[{ label: "Data sync", href: "/data-sync" }, { label: "Sources" }]} />
      }
      headerButtons={
        <Button
          variant="contained"
          startIcon={<TravelExploreIcon />}
          disabled={starting}
          onClick={scrape}
        >
          {starting ? "Starting…" : "Source requirements"}
        </Button>
      }
    >
      <Box sx={{ p: { xs: 1, sm: 2 } }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        )}
        {loading && <CircularProgress size={24} />}

        {status && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              CRICOS publishes no entry requirements, so these are read from each institution's own
              admissions pages. A course with no sourced band is reported as <b>unknown</b> by the
              matching engine — never assumed to have no requirement.
            </Alert>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Courses with a sourced English band
                  </Typography>
                  <Typography variant="h5">
                    {c!.courses_with_sourced_band.toLocaleString()}{" "}
                    <Typography component="span" variant="body2" color="text.secondary">
                      of {c!.courses_total.toLocaleString()} ({bandPct}%)
                    </Typography>
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={bandPct}
                    sx={{ mt: 1, height: 6, borderRadius: 1 }}
                  />
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Institutions with at least one readable source page
                  </Typography>
                  <Typography variant="h5">
                    {c!.institutions_with_a_source.toLocaleString()}{" "}
                    <Typography component="span" variant="body2" color="text.secondary">
                      of {c!.institutions_total.toLocaleString()} ({instPct}%)
                    </Typography>
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={instPct}
                    sx={{ mt: 1, height: 6, borderRadius: 1 }}
                  />
                </Paper>
              </Grid>
            </Grid>

            {!!status.pages.orphaned && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {status.pages.orphaned} tracked page(s) point at an institution that no longer
                exists, so their provenance is lost. This happens if university records are recreated
                with new ids; re-link them by domain or re-run sourcing for those providers.
              </Alert>
            )}

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              <Chip size="small" label={`${status.pages.tracked} pages tracked`} />
              <Chip size="small" color="success" variant="outlined" label={`${status.pages.ok} read`} />
              <Tooltip title="These sites' robots.txt disallows the path. Not bypassed — the requirement has to be entered by hand or sourced elsewhere.">
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  label={`${status.pages.blocked_by_robots} blocked by robots.txt`}
                />
              </Tooltip>
              <Tooltip title="Usually HTTP 403 from anti-bot protection, or a page whose content is rendered client-side.">
                <Chip
                  size="small"
                  color="error"
                  variant="outlined"
                  label={`${status.pages.http_error} HTTP errors`}
                />
              </Tooltip>
            </Stack>

            {consistency && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <Typography variant="subtitle2">Policy ↔ course consistency</Typography>
                  <Box flex={1} />
                  <TextField
                    size="small"
                    select
                    label="When they disagree"
                    value={direction}
                    sx={{ minWidth: 300 }}
                    onChange={(e) => setDirection(e.target.value as ReconcileDirection)}
                  >
                    {(Object.keys(RECONCILE_LABELS) as ReconcileDirection[]).map((k) => (
                      <MenuItem key={k} value={k}>
                        {RECONCILE_LABELS[k]}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={reconciling || !consistency.disagreements.length}
                    onClick={() => runReconcile(false)}
                  >
                    {reconciling ? "Applying…" : "Apply"}
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  The English requirement is held in two places: on the course (what the matcher
                  scores) and in the institution's admission policy (what the eligibility verdict
                  checks). When they disagree there is no automatic winner — a figure scraped from the
                  provider's own course page may belong in the policy, or the briefing may be right
                  and the course row stale. Choose the direction. Promoting a course figure into a
                  band that governs other courses is refused unless you confirm it, since it changes
                  the requirement for all of them.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`${consistency.checked} courses checked`} />
                  {Object.entries(consistency.summary).map(([k, v]) => (
                    <Chip
                      key={k}
                      size="small"
                      variant="outlined"
                      color={k === "DISAGREE" ? "error" : k === "agree" ? "success" : "default"}
                      label={`${v} ${k}`}
                    />
                  ))}
                </Stack>
                {consistency.disagreements.length > 0 && (
                  <Alert severity="warning" sx={{ mt: 1.5 }}>
                    {consistency.disagreements.length} course(s) either contradict their institution's
                    policy or have no band while the policy has one — so a report can quote two
                    different requirements for the same course.
                  </Alert>
                )}
              </Paper>
            )}

            {status.auto_source.blocked_institutions > 0 && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <BlockIcon color="warning" fontSize="small" />
                  <Typography variant="subtitle2">
                    {status.auto_source.blocked_institutions} institution
                    {status.auto_source.blocked_institutions === 1 ? "" : "s"} cannot be
                    auto-sourced
                  </Typography>
                  <Box flex={1} />
                  <Button size="small" onClick={() => setShowBlocked((v) => !v)}>
                    {showBlocked ? "Hide" : "Show"}
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  These sites block automated requests or render their content client-side. That
                  does not change on its own, so scrape runs skip them from now on rather than
                  retrying and failing. Their requirements need entering by hand, or a document
                  upload.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                  {status.auto_source.by_reason.map((r) => (
                    <Chip
                      key={r.reason}
                      size="small"
                      color="warning"
                      variant="outlined"
                      label={`${r.count} ${
                        BLOCKED_REASON_LABELS[r.reason as keyof typeof BLOCKED_REASON_LABELS] ??
                        r.reason
                      }`}
                    />
                  ))}
                </Stack>
                {showBlocked && (
                  <Table size="small" sx={{ mt: 1.5 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Institution</TableCell>
                        <TableCell>Why</TableCell>
                        <TableCell>Last tried</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {blocked.map((b) => (
                        <TableRow key={b.id} hover>
                          <TableCell>
                            <Typography variant="body2">{b.name}</Typography>
                            {b.website && (
                              <Link
                                href={b.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="caption"
                              >
                                {b.website.replace(/^https?:\/\//, "")}
                              </Link>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {b.auto_source_reason
                                ? BLOCKED_REASON_LABELS[b.auto_source_reason]
                                : "unknown"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {formatDate(b.auto_source_checked_at)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 1.5 }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Fetch status</InputLabel>
                <Select
                  label="Fetch status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  {(Object.keys(FETCH_STATUS_LABELS) as FetchStatus[]).map((s) => (
                    <MenuItem key={s} value={s}>
                      {FETCH_STATUS_LABELS[s]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                placeholder="Search URL or description"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                sx={{ minWidth: 280 }}
              />
              <Box flex={1} />
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
                {total} page{total === 1 ? "" : "s"}
              </Typography>
            </Stack>

            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Page</TableCell>
                    <TableCell>What it holds</TableCell>
                    <TableCell>Trust</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Last read</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pages.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No source pages tracked yet. Run "Source requirements" to visit
                          institutions' own admissions pages.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {pages.map((p) => (
                    <TableRow key={p.id} hover>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Link
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="body2"
                          sx={{ wordBreak: "break-all" }}
                        >
                          {p.url.replace(/^https?:\/\//, "")}
                          <OpenInNewIcon sx={{ fontSize: 12, ml: 0.5 }} />
                        </Link>
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                          {p.data_kinds.map((k) => (
                            <Chip key={k} size="small" variant="outlined" label={k.replace(/_/g, " ")} />
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 340 }}>
                        <Typography variant="caption">{p.description || "—"}</Typography>
                        {p.notes && (
                          <Typography variant="caption" color="warning.main" display="block">
                            {p.notes}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={TIER_COLOUR[p.trust_tier]}
                          variant="outlined"
                          label={p.trust_tier}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={STATUS_COLOUR[p.fetch_status]}
                          variant={p.fetch_status === "ok" ? "filled" : "outlined"}
                          label={FETCH_STATUS_LABELS[p.fetch_status]}
                        />
                        {p.http_status && p.http_status >= 400 && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            HTTP {p.http_status}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{formatDate(p.last_fetched_at)}</Typography>
                        {p.verified_at && (
                          <Tooltip title={`Confirmed by a human ${formatDate(p.verified_at)}`}>
                            <VerifiedIcon color="success" sx={{ fontSize: 14, ml: 0.5 }} />
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => {
                            setEditing(p);
                            setDraft(p.description);
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </>
        )}

        <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
          <DialogTitle>What this page holds</DialogTitle>
          <DialogContent>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
              The AI wrote this description when it read the page. Correcting it improves where the
              system looks next time — and saving marks the page as human-confirmed.
            </Typography>
            <TextField
              multiline
              fullWidth
              minRows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              size="small"
            />
          </DialogContent>
          <DialogActions>
            <Button color="inherit" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="contained" onClick={saveDescription}>
              Save & mark confirmed
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </RefineListView>
  );
}

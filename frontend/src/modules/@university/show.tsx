import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useOne, useCan } from "@refinedev/core";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid2 as Grid,
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import BlockIcon from "@mui/icons-material/Block";
import SchoolIcon from "@mui/icons-material/School";

import { RefineShowView } from "@components/view/show";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import { Monogram } from "@components/other/monogram";
import { LabelData } from "@components/other/label.data";
import { axiosInstance } from "../../_service/axious";
import { BASE_URL } from "@common/options";
import { computeUniversityGaps } from "@utils/university-data-gaps";
import type { University } from "@mocks/types";

interface UniversityDocument {
  id: string;
  title: string;
  doc_type: string;
  file: { name: string; type: string; size: number };
  extracted_text: string | null;
  extraction_status: "pending" | "extracting" | "extracted" | "failed";
  extraction_error: string | null;
  doc_id: string | null;
  last_ingested_at: string | null;
  uploaded_by: string;
  created_at: string;
  url: string;
  policy_draft_status: "pending" | "drafting" | "drafted" | "failed" | "not_applicable";
  drafted_policy_key: string | null;
}

/**
 * Fields the API returns that the prototype `University` type predates:
 * the scraper's readability verdict and the server-computed course rollup.
 */
interface CampusRow {
  id: string;
  location_name: string;
  city: string;
  locality: string | null;
  state: string | null;
  postcode: string | null;
  is_primary: boolean;
}

interface UniversityExtras {
  campuses?: CampusRow[];
  auto_source_status?: "unknown" | "ok" | "blocked";
  auto_source_reason?: string | null;
  auto_source_note?: string;
  course_stats?: { total: number; with_scholarships: number; with_cricos: number; unverified_fee: number };
}

interface CourseRow {
  id: string;
  title: string;
  degree_level: string;
  field: string;
  duration_months: number;
  tuition_fee: number;
  currency: string;
  cricos: string | null;
  entry?: { min_english_band: number | null; min_gpa: number | null };
}

const BLOCKED_REASON_TEXT: Record<string, string> = {
  anti_bot: "blocks automated requests (HTTP 403)",
  robots_disallow: "robots.txt disallows the pages we need",
  client_rendered: "content only exists after JavaScript runs",
  unreachable: "site could not be reached",
  no_website: "no usable website in the register",
};

interface PolicySummary {
  key: string;
  institution: string;
  review_status: "ai_drafted" | "reviewed";
}

const STATUS_COLOR: Record<UniversityDocument["extraction_status"], "default" | "warning" | "success" | "error"> = {
  pending: "default",
  extracting: "warning",
  extracted: "success",
  failed: "error",
};

const POLICY_DRAFT_COLOR: Record<UniversityDocument["policy_draft_status"], "default" | "warning" | "success" | "error"> = {
  pending: "default",
  drafting: "warning",
  drafted: "success",
  failed: "error",
  not_applicable: "default",
};

export function UniversityShowPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useOne<University & UniversityExtras>({ resource: "universities", id });
  const u = data?.data;
  const { data: canWrite } = useCan({ resource: "universities", action: "edit" });

  const [docs, setDocs] = useState<UniversityDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<UniversityDocument | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [policy, setPolicy] = useState<PolicySummary | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [courseTotal, setCourseTotal] = useState(0);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [registryTwin, setRegistryTwin] = useState<{ id: string; name: string } | null>(null);

  /**
   * A record with no CRICOS provider code was created by the aggregator import,
   * not from the government register, so all its registry fields are empty. Find
   * the registered provider that shares its admission policy so the page can
   * point at the real row instead of showing a column of dashes.
   */
  const loadRegistryTwin = async (policyKey: string) => {
    try {
      const { data } = await axiosInstance.get(`${BASE_URL}/universities`, {
        params: { _start: 0, _end: 5, policy_key: policyKey },
      });
      const twin = (data?.elements ?? []).find(
        (x: any) => x.id !== id && x.cricos_provider_code,
      );
      setRegistryTwin(twin ? { id: twin.id, name: twin.name } : null);
    } catch {
      setRegistryTwin(null);
    }
  };

  const loadCourses = async () => {
    setCoursesLoading(true);
    try {
      const { data: page } = await axiosInstance.get(`${BASE_URL}/courses`, {
        params: { _start: 0, _end: 50, university_id: id, _sort: "title", _order: "asc" },
      });
      setCourses(page?.elements ?? []);
      setCourseTotal(page?.totalElements ?? 0);
    } finally {
      setCoursesLoading(false);
    }
  };

  const loadDocs = async () => {
    setDocsLoading(true);
    try {
      const { data } = await axiosInstance.get<UniversityDocument[]>(`${BASE_URL}/universities/${id}/documents`);
      setDocs(data);
    } finally {
      setDocsLoading(false);
    }
  };
  const loadPolicy = async (policyKey: string) => {
    const { data } = await axiosInstance.get<PolicySummary[]>(`${BASE_URL}/admission/institutions`);
    setPolicy(data.find((p) => p.key === policyKey) ?? null);
  };
  useEffect(() => {
    if (id) {
      loadDocs();
      loadCourses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    if (u?.policy_key && !u?.cricos_provider_code) loadRegistryTwin(u.policy_key);
    else setRegistryTwin(null);
    if (u?.policy_key) loadPolicy(u.policy_key);
    else setPolicy(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u?.policy_key]);

  const runAction = async (docId: string, action: "reprocess" | "reingest" | "delete") => {
    setBusyId(docId);
    try {
      if (action === "delete") {
        await axiosInstance.delete(`${BASE_URL}/universities/${id}/documents/${docId}`);
      } else {
        await axiosInstance.post(`${BASE_URL}/universities/${id}/documents/${docId}/${action}`);
      }
      await loadDocs();
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading || !u) return <LinearProgress sx={{ mt: 4 }} />;

  return (
    <RefineShowView
      resource="universities"
      title={u.name}
      breadcrumb={<AppBreadcrumbs items={[{ label: "Universities", href: "/universities" }, { label: u.name }]} />}
      headerButtons={
        canWrite?.can ? (
          <Button startIcon={<EditOutlinedIcon />} onClick={() => navigate(`/universities/${id}/edit`)}>
            Edit
          </Button>
        ) : undefined
      }
    >
      <Box sx={{ p: { xs: 1, sm: 2 } }}>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Monogram name={u.name} hue={u.logo_hue} variant="rounded" sx={{ width: 56, height: 56 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">{u.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {u.city}, {u.country}
                {(u.campuses?.length ?? 0) > 1 &&
                  ` · +${new Set(u.campuses!.map((c) => c.city)).size - 1} more ${
                    new Set(u.campuses!.map((c) => c.city)).size - 1 === 1 ? "city" : "cities"
                  }`}
                {u.world_rank && u.world_rank < 999
                  ? ` · world rank ${u.world_rank}`
                  : " · not world-ranked"}
              </Typography>
            </Box>
            {u.policy_key ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  color={policy?.review_status === "reviewed" ? "success" : "warning"}
                  variant="outlined"
                  label={
                    policy?.review_status === "reviewed"
                      ? `Admission policy: ${u.policy_key} · reviewed`
                      : `Admission policy: ${u.policy_key} · AI-drafted, unreviewed`
                  }
                />
                <Button
                  size="small"
                  startIcon={<SchoolIcon />}
                  onClick={() => navigate(`/admission/${u.policy_key}`)}
                >
                  View policy
                </Button>
                {canWrite?.can && (
                  <Button size="small" onClick={() => setReviewing(true)}>
                    Edit raw
                  </Button>
                )}
              </Stack>
            ) : (
              <Chip variant="outlined" label="No admission policy on file yet — upload an entry-requirements document" />
            )}
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* Official CRICOS registry fields, straight from the government
              register. A record created by the aggregator import has none of
              them, so rather than rendering a column of dashes the page says why
              and links to the registered provider. */}
          {u.cricos_provider_code ? (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  CRICOS provider code
                </Typography>
                <Typography variant="body2">{u.cricos_provider_code}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  Provider type
                </Typography>
                <Typography variant="body2">{u.institution_type || "not stated in the register"}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  Student capacity
                </Typography>
                <Typography variant="body2">
                  {u.student_capacity ? u.student_capacity.toLocaleString() : "not stated in the register"}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  Website
                </Typography>
                <Typography variant="body2">
                  {u.website ? (
                    <MuiLink
                      href={u.website.startsWith("http") ? u.website : `https://${u.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {u.website.replace(/^https?:\/\//, "")}
                      <OpenInNewIcon sx={{ fontSize: 12, ml: 0.5 }} />
                    </MuiLink>
                  ) : (
                    "not stated in the register"
                  )}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 8 }}>
                <Typography variant="caption" color="text.secondary">
                  Registered address
                </Typography>
                <Typography variant="body2">{u.address || "not stated in the register"}</Typography>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Not a CRICOS register record
              </Typography>
              This entry was created from third-party research, not from the government CRICOS
              register, so it has no provider code, provider type, capacity, website or registered
              address. Its course data is marked unverified for the same reason.
              {registryTwin && (
                <>
                  {" "}The registered provider is{" "}
                  <MuiLink
                    component="button"
                    type="button"
                    onClick={() => navigate(`/universities/${registryTwin.id}`)}
                  >
                    {registryTwin.name}
                  </MuiLink>
                  {" "}— use that record for official details.
                </>
              )}
            </Alert>
          )}

          {u.auto_source_status === "blocked" && (
            <Alert severity="warning" icon={<BlockIcon fontSize="small" />} sx={{ mt: 2 }}>
              This institution's site cannot be read automatically —{" "}
              {BLOCKED_REASON_TEXT[u.auto_source_reason ?? ""] ?? u.auto_source_reason ?? "unknown reason"}.
              Requirements for it have to be entered by hand, or sourced from an uploaded document or
              AI curation.
            </Alert>
          )}
        </Paper>

        {(() => {
          const gaps = computeUniversityGaps(u, policy);
          if (!gaps.length) return null;
          const hasWarning = gaps.some((g) => g.severity === "warning");
          return (
            <Alert severity={hasWarning ? "warning" : "info"} sx={{ mb: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Missing profile data
              </Typography>
              <Stack component="ul" sx={{ m: 0, pl: 2.5 }}>
                {gaps.map((g) => (
                  <Typography key={g.label} component="li" variant="body2">
                    {g.label}
                  </Typography>
                ))}
              </Stack>
            </Alert>
          );
        })()}

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Box>
              <Typography variant="subtitle2">Admission documents</Typography>
              <Typography variant="caption" color="text.secondary">
                Upload → vision-extract → ingest into the AI knowledge base. Each step is independently
                re-runnable.
              </Typography>
            </Box>
            {canWrite?.can && (
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setUploading(true)}>
                Upload
              </Button>
            )}
          </Stack>

          {docsLoading ? (
            <LinearProgress sx={{ mt: 2 }} />
          ) : docs.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              No documents uploaded yet.
            </Typography>
          ) : (
            <Stack spacing={1.5} sx={{ mt: 1.5 }}>
              {docs.map((d) => (
                <Paper key={d.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" useFlexGap gap={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {d.title}
                        </Typography>
                        <Chip size="small" variant="outlined" label={d.doc_type} />
                        <Chip size="small" color={STATUS_COLOR[d.extraction_status]} label={d.extraction_status} />
                        {d.last_ingested_at && <Chip size="small" variant="outlined" color="success" label="ingested" />}
                        {d.policy_draft_status !== "pending" && d.policy_draft_status !== "not_applicable" && (
                          <Chip
                            size="small"
                            color={POLICY_DRAFT_COLOR[d.policy_draft_status]}
                            variant="outlined"
                            label={
                              d.policy_draft_status === "drafted"
                                ? `policy drafted: ${d.drafted_policy_key}`
                                : `policy draft ${d.policy_draft_status}`
                            }
                          />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {d.file.name} · {d.uploaded_by} · {new Date(d.created_at).toLocaleDateString()}
                      </Typography>
                      {d.extraction_error && (
                        <Alert severity="error" sx={{ mt: 1, py: 0 }}>
                          {d.extraction_error}
                        </Alert>
                      )}
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" title="Open file" component="a" href={d.url} target="_blank" rel="noreferrer">
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                      {canWrite?.can && (
                        <>
                          <IconButton size="small" title="Edit extracted text" onClick={() => setEditing(d)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            title="Re-run vision extraction + ingest"
                            disabled={busyId === d.id}
                            onClick={() => runAction(d.id, "reprocess")}
                          >
                            <RefreshOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            title="Re-ingest saved text (no vision call)"
                            disabled={busyId === d.id || !d.extracted_text}
                            onClick={() => runAction(d.id, "reingest")}
                          >
                            <CloudSyncOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            title="Delete"
                            disabled={busyId === d.id}
                            onClick={() => {
                              if (confirm(`Delete "${d.title}"?`)) runAction(d.id, "delete");
                            }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      </Box>

      {uploading && (
        <UploadDialog
          universityId={id}
          onClose={() => setUploading(false)}
          onUploaded={() => {
            setUploading(false);
            loadDocs();
          }}
        />
      )}
      {editing && (
        <EditTextDialog
          universityId={id}
          doc={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadDocs();
          }}
        />
      )}
      {/* Registered teaching locations. A provider is routinely one institution
          across many cities (CQU teaches in 11), and matching now scores a
          student's preferred city against any of them, so all are shown. */}
      {!!u.campuses?.length && (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Campuses</Typography>
            <Chip size="small" label={`${u.campuses.length} registered location${u.campuses.length === 1 ? "" : "s"}`} />
            {u.campuses.length > 1 && (
              <Tooltip title="A student who prefers any of these cities is scored as a location match, not a mismatch.">
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${new Set(u.campuses.map((c) => c.city)).size} cities`}
                />
              </Tooltip>
            )}
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Campus</TableCell>
                <TableCell>City</TableCell>
                <TableCell>Locality</TableCell>
                <TableCell>State</TableCell>
                <TableCell align="right">Postcode</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...u.campuses]
                .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.city.localeCompare(b.city))
                .map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>
                      <Typography variant="body2">{c.location_name}</Typography>
                      {c.is_primary && (
                        <Tooltip title="The campus whose postcode matches the institution's registered postal address — this is where the record's city comes from.">
                          <Chip size="small" color="primary" variant="outlined" label="primary" sx={{ mt: 0.5 }} />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>{c.city}</TableCell>
                    <TableCell>
                      <Typography variant="caption">{c.locality ?? "—"}</Typography>
                    </TableCell>
                    <TableCell>{c.state ?? "—"}</TableCell>
                    <TableCell align="right">{c.postcode ?? "—"}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Courses offered here. The register is the source for these, so a
          provider's real catalogue is visible without leaving the page. */}
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="subtitle2">Courses</Typography>
          <Chip size="small" label={`${courseTotal} total`} />
          {u.course_stats && (
            <>
              <Tooltip title="Courses carrying a real CRICOS course code from the government register.">
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${u.course_stats.with_cricos} with CRICOS code`}
                />
              </Tooltip>
              <Tooltip title="CRICOS publishes no scholarship data, so this is usually zero until scholarships are entered or sourced.">
                <Chip
                  size="small"
                  variant="outlined"
                  color={u.course_stats.with_scholarships ? "default" : "warning"}
                  label={`${u.course_stats.with_scholarships} with scholarships`}
                />
              </Tooltip>
            </>
          )}
          <Box flex={1} />
          <Button
            size="small"
            onClick={() => navigate(`/catalogue?university_id=${u.id}`)}
          >
            Open in catalogue
          </Button>
        </Stack>
        {coursesLoading && <LinearProgress sx={{ mb: 1 }} />}
        {!coursesLoading && courses.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No courses on file for this institution.
          </Typography>
        )}
        {courses.length > 0 && (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Course</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell>Field</TableCell>
                  <TableCell align="right">Fee / yr</TableCell>
                  <TableCell align="right">Duration</TableCell>
                  <TableCell align="right">English</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {courses.map((c) => (
                  <TableRow
                    key={c.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/catalogue/${c.id}/edit`)}
                  >
                    <TableCell>
                      <Typography variant="body2">{c.title}</Typography>
                      {c.cricos && (
                        <Typography variant="caption" color="text.secondary">
                          CRICOS {c.cricos}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={c.degree_level} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{c.field}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      {c.currency} {Number(c.tuition_fee).toLocaleString()}
                    </TableCell>
                    <TableCell align="right">{c.duration_months} mo</TableCell>
                    <TableCell align="right">
                      {c.entry?.min_english_band != null ? (
                        `IELTS ${c.entry.min_english_band}`
                      ) : (
                        <Tooltip title="Not sourced from the provider. The matcher reports this gate as unknown rather than assuming a bar.">
                          <Typography variant="caption" color="warning.main">
                            not sourced
                          </Typography>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {courseTotal > courses.length && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                Showing the first {courses.length} of {courseTotal} — open in the catalogue to see them all.
              </Typography>
            )}
          </>
        )}
      </Paper>

      {reviewing && u.policy_key && (
        <ReviewPolicyDialog
          policyKey={u.policy_key}
          onClose={() => setReviewing(false)}
          onSaved={() => {
            setReviewing(false);
            loadPolicy(u.policy_key!);
          }}
        />
      )}
    </RefineShowView>
  );
}

function UploadDialog({ universityId, onClose, onUploaded }: { universityId: string; onClose: () => void; onUploaded: () => void }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title || file.name);
      await axiosInstance.post(`${BASE_URL}/universities/${universityId}/documents`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onUploaded();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Upload admission document
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Button component="label" startIcon={<UploadFileIcon />} variant="outlined">
            {file ? file.name : "Choose PDF or image"}
            <input
              type="file"
              accept=".pdf,image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title) setTitle(f.name);
              }}
            />
          </Button>
          <TextField size="small" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
          {err && <Alert severity="error">{err}</Alert>}
          <Typography variant="caption" color="text.secondary">
            Runs vision extraction, auto-identifies the document type, and ingests into the knowledge base
            immediately — may take up to ~10s per page. No need to classify it yourself.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!file || busy} onClick={submit}>
          {busy ? "Uploading…" : "Upload"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * The admission policy shape is 20+ nested fields (academics, sponsors,
 * income thresholds, ...) — same honesty-over-bespoke-form choice as
 * EditTextDialog: a pretty-printed JSON editor rather than a form for every
 * field. Saving via PATCH /admission/institutions/:key is what flips
 * review_status from ai_drafted to reviewed.
 */
function ReviewPolicyDialog({ policyKey, onClose, onSaved }: { policyKey: string; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    axiosInstance.get(`${BASE_URL}/admission/institutions/${policyKey}`).then(({ data }) => {
      setText(JSON.stringify(data, null, 2));
      setLoading(false);
    });
  }, [policyKey]);

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      const parsed = JSON.parse(text);
      await axiosInstance.patch(`${BASE_URL}/admission/institutions/${policyKey}`, parsed);
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Save failed — check the JSON is valid");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Review admission policy — {policyKey}
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          This is the real structured data the deterministic eligibility checker runs against — edit any
          incorrect value directly. Saving marks it as reviewed.
        </Typography>
        {loading ? (
          <LinearProgress />
        ) : (
          <TextField multiline fullWidth minRows={20} value={text} onChange={(e) => setText(e.target.value)} sx={{ fontFamily: "monospace" }} />
        )}
        {err && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {err}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy || loading} onClick={submit}>
          {busy ? "Saving…" : "Save & mark reviewed"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EditTextDialog({
  universityId,
  doc,
  onClose,
  onSaved,
}: {
  universityId: string;
  doc: UniversityDocument;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState(doc.extracted_text ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await axiosInstance.patch(`${BASE_URL}/universities/${universityId}/documents/${doc.id}`, { extracted_text: text });
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Edit extracted text — {doc.title}
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          Correcting this only updates the saved text — it does not re-ingest automatically. Use "Re-ingest" on
          the document row afterward to push the correction into the knowledge base.
        </Typography>
        <TextField multiline fullWidth minRows={16} value={text} onChange={(e) => setText(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy} onClick={submit}>
          {busy ? "Saving…" : "Save text"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useList, useOne } from "@refinedev/core";
import { useReactToPrint } from "react-to-print";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid2 as Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  Table,
  TextField,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";
import TableRowsOutlinedIcon from "@mui/icons-material/TableRowsOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import dayjs from "dayjs";

import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import { AiMarkdown } from "@components/other/ai.markdown";
import { Monogram } from "@components/other/monogram";
import type {
  AdmissionCheck,
  AdmissionEligibility,
  Course,
  MatchDimension,
  MatchResult,
  MatchRun,
  MatchWeights,
  Student,
  StudentProfile,
  University,
} from "@mocks/types";
import { DEFAULT_WEIGHTS } from "@mocks/engine/weights";
import { axiosInstance } from "../../_service/axious";
import { BASE_URL } from "@common/options";

const DIMS: { key: MatchDimension; label: string; short: string }[] = [
  { key: "academic", label: "Academic", short: "Acad" },
  { key: "english", label: "English", short: "Eng" },
  { key: "financial", label: "Financial affordability", short: "Funds" },
  { key: "career", label: "Career fit", short: "Career" },
  { key: "location", label: "Location", short: "Loc" },
  { key: "scholarship", label: "Scholarship", short: "Schol" },
];

/**
 * Moves one dimension weight to `newValue` and proportionally RESCALES the
 * other five so all six always sum to exactly `total` (default 1, i.e.
 * 100%) — dragging one slider up visibly shrinks the others in real time,
 * preserving their relative shape, instead of the old behaviour where each
 * slider was an independent raw number silently re-normalised server-side
 * (so the total drifted and the displayed numbers didn't reflect each
 * dimension's real share). `scale` is always >= 0 here since `newValue` is
 * clamped to [0, total] first, so no negative-value clamping is needed —
 * every other slider just shrinks/grows by the same proportional factor.
 */
function redistributeWeights(
  weights: MatchWeights,
  changedKey: MatchDimension,
  rawNewValue: number,
  total = 1,
): MatchWeights {
  const newValue = Math.max(0, Math.min(total, rawNewValue));
  const otherKeys = DIMS.map((d) => d.key).filter((k) => k !== changedKey);
  const othersOldSum = otherKeys.reduce((sum, k) => sum + weights[k], 0);
  const othersNewSum = total - newValue;
  const scale = othersOldSum > 0 ? othersNewSum / othersOldSum : 0;

  const next = { ...weights, [changedKey]: newValue } as MatchWeights;
  if (othersOldSum <= 0) {
    // nothing to scale proportionally from (all others already at 0) — split the freed-up budget evenly
    otherKeys.forEach((k) => (next[k] = othersNewSum / otherKeys.length));
  } else {
    otherKeys.forEach((k) => (next[k] = weights[k] * scale));
  }

  // Floating-point rounding across 6 multiplications can leave the sum a
  // hair off `total` — renormalise once so it's always EXACT, never ~99.98%.
  const sum = Object.values(next).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(DIMS.map((d) => [d.key, (next[d.key] / sum) * total])) as MatchWeights;
}

// Same fixed lists intake.tsx's own preference fields already use.
const OVERRIDE_COUNTRIES = ["AU", "NZ", "UK", "CA", "US"];
const OVERRIDE_DEGREE_LEVELS = ["Bachelor", "PG Diploma", "Master", "PhD"];

/** "What-if" overrides on top of the real profile/preferences — see server ProfileOverrideDto. Every field optional; omitted = use the real value. */
interface ProfileOverride {
  canonical_gpa?: number;
  english_band?: number;
  max_tuition_per_year?: number;
  preferred_countries?: string[];
  preferred_cities?: string[];
  degree_level?: string;
  field?: string;
}

const band = (n: number) => (n >= 80 ? "success" : n >= 60 ? "warning" : "error");
const money = (n: number) => `A$${Math.round(n).toLocaleString()}`;

type SortKey = "match" | "cost" | "deadline";
type ViewMode = "cards" | "table";

// Same estimate the engine's financialScore uses (server/src/modules/match/engine/score.ts)
// — kept in sync deliberately so the number shown here is the number the score was built from.
function costBreakdown(student: Student, availableFundsAud: number, course?: Course) {
  if (!course) return null;
  const years = course.duration_months / 12;
  const livingPerYear = 29000 + student.dependants.filter((d) => d.accompanying).length * 8000;
  const totalCost = Math.round(course.tuition_fee * years + livingPerYear * years);
  const coverage = totalCost > 0 ? Math.round((availableFundsAud / totalCost) * 100) : 100;
  return { totalCost, funds: availableFundsAud, coverage, years };
}

function deadlineInfo(course?: Course) {
  if (!course?.application_deadline) return null;
  const d = dayjs(course.application_deadline);
  if (!d.isValid()) return null;
  const days = d.diff(dayjs(), "day");
  return { date: d.format("D MMM YYYY"), days };
}

interface AiAnalysisState {
  loading: boolean;
  answer?: string;
  cites?: { chunk_id: string; source_url: string }[];
  degraded?: boolean;
  error?: boolean;
}

export function MatchResultPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  const { data, isLoading, isError } = useOne<Student>({
    resource: "students",
    id,
    queryOptions: { retry: 0 },
  });
  const student = data?.data;

  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [enforceEligibility, setEnforceEligibility] = useState(true);
  const [profileOverride, setProfileOverride] = useState<ProfileOverride>({});
  const [run, setRun] = useState<MatchRun | null>(null);
  const [running, setRunning] = useState(false);
  const [view, setView] = useState<ViewMode>("cards");
  const [sort, setSort] = useState<SortKey>("match");

  // Live re-rank: POST /match/preview (compute-only) whenever weights, the
  // admission-eligibility gate toggle, or a what-if profile override change —
  // same debounced pattern for all three.
  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setRunning(true);
      try {
        const { data } = await axiosInstance.post<MatchRun>(`${BASE_URL}/match/preview`, {
          student_id: student.id,
          weights,
          enforce_admission_eligibility: enforceEligibility,
          profile_override: profileOverride,
        });
        if (!cancelled) setRun(data);
      } finally {
        if (!cancelled) setRunning(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [student, weights, enforceEligibility, profileOverride]);

  // Reuses the same conversation thread as the student's "AI Consultant" tab
  // — a per-course analysis here shows up there too, and vice versa.
  const [conversationId, setConversationId] = useState<string | null>(null);
  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    axiosInstance
      .get<{ conversation_id: string | null }>(`${BASE_URL}/assistant/students/${student.id}`)
      .then(({ data }) => !cancelled && setConversationId(data.conversation_id))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [student?.id]);
  const [aiState, setAiState] = useState<Record<string, AiAnalysisState>>({});

  async function getAiAnalysis(r: MatchResult, course?: Course, uni?: University) {
    if (!student) return;
    setAiState((prev) => ({ ...prev, [r.course_id]: { loading: true } }));
    // Score/knockout/admission-eligibility context now travels structurally via
    // match_result (grounded server-side, see OrchestratorService.matchResultChunks)
    // instead of being hand-summarised into prose here — keeps the AI's answer
    // consistent with exactly what this card shows, admission eligibility included.
    const question = `Give me a genuinely practical analysis of "${course?.title ?? "this course"}" at ${uni?.name ?? "this university"} for this student — is it really a good pick, especially regarding admission eligibility, visa outcome, scholarship eligibility, and any real risks worth flagging?`;
    try {
      const { data } = await axiosInstance.post<{
        conversation_id: string;
        reply: { body: string; meta: { cites?: AiAnalysisState["cites"]; degraded?: boolean } | null };
      }>(`${BASE_URL}/assistant/messages`, {
        conversation_id: conversationId ?? undefined,
        student_id: student.id,
        body: question,
        match_result: r,
      });
      setConversationId(data.conversation_id);
      setAiState((prev) => ({
        ...prev,
        [r.course_id]: {
          loading: false,
          answer: data.reply.body,
          cites: data.reply.meta?.cites ?? [],
          degraded: data.reply.meta?.degraded,
        },
      }));
    } catch {
      setAiState((prev) => ({ ...prev, [r.course_id]: { loading: false, error: true } }));
    }
  }

  // Catalogue lookup for the recommendation cards (small, fetched once).
  const { data: courseData } = useList<Course>({ resource: "courses", pagination: { pageSize: 200 } });
  const { data: uniData } = useList<University>({ resource: "universities", pagination: { pageSize: 200 } });
  const courseById = useMemo(
    () => new Map((courseData?.data ?? []).map((c) => [c.id, c])),
    [courseData],
  );
  const uniById = useMemo(
    () => new Map((uniData?.data ?? []).map((u) => [u.id, u])),
    [uniData],
  );

  const sortedResults = useMemo(() => {
    if (!run) return [];
    const rows = [...run.results];
    if (sort === "cost") {
      rows.sort((a, b) => (courseById.get(a.course_id)?.tuition_fee ?? Infinity) - (courseById.get(b.course_id)?.tuition_fee ?? Infinity));
    } else if (sort === "deadline") {
      rows.sort((a, b) => {
        const da = courseById.get(a.course_id)?.application_deadline;
        const db = courseById.get(b.course_id)?.application_deadline;
        return new Date(da ?? "9999").getTime() - new Date(db ?? "9999").getTime();
      });
    }
    // "match" order is already what the backend returned (ranked by overall).
    return rows;
  }, [run, sort, courseById]);

  if (isLoading) return <LinearProgress sx={{ mt: 4 }} />;
  if (isError || !student) {
    return (
      <Box sx={{ maxWidth: 480, mx: "auto", mt: 8, textAlign: "center" }}>
        <Typography variant="h6" gutterBottom>
          Student not found
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Cannot run a match for <code>{id}</code>.
        </Typography>
        <Button variant="contained" onClick={() => navigate("/students")}>
          Back to students
        </Button>
      </Box>
    );
  }
  if (!run) return <LinearProgress sx={{ mt: 4 }} />;

  const p = run.profile;
  const realMatches = run.results.filter((r) => !r.knockout);
  const closestMisses = run.results.filter((r) => r.knockout);
  const topPick = realMatches[0];
  const topPickCourse = topPick && courseById.get(topPick.course_id);
  const topPickUni = topPick && uniById.get(topPick.university_id);
  const sharedDocuments = run.results[0]?.documents_required ?? [];

  return (
    <Box>
      <AppBreadcrumbs
        items={[
          { label: "Students", href: "/students" },
          { label: student.full_name, href: `/students/${id}` },
          { label: "Match report" },
        ]}
      />
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={1} sx={{ mt: 1.5, mb: 2 }}>
        <Monogram name={student.full_name} sx={{ width: 40, height: 40 }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            Match report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {student.full_name} · {student.id.slice(0, 8)}
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Button startIcon={<PersonOutlineIcon />} onClick={() => navigate(`/students/${id}`)}>
          Profile
        </Button>
        <Button startIcon={<EditOutlinedIcon />} onClick={() => navigate(`/students/${id}/edit`)}>
          Edit intake
        </Button>
        <Button
          startIcon={<RestartAltIcon />}
          onClick={() => setWeights({ ...DEFAULT_WEIGHTS })}
        >
          Reset weights
        </Button>
        <Button
          variant="outlined"
          disabled={running}
          onClick={async () => {
            const { data } = await axiosInstance.post<MatchRun>(`${BASE_URL}/match/runs`, {
              student_id: student.id,
              weights,
            });
            setRun(data);
          }}
        >
          Save run
        </Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={() => handlePrint?.()}>
          Export report
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        The ranking and per-dimension scores are the backend&rsquo;s deterministic matching engine —
        never an AI guess. The short &ldquo;why/concerns&rdquo; notes on each card are a templated
        summary of those scores. For a real grounded, cited narrative on any specific course (visa
        risk, scholarship terms, real requirements), click <strong>&ldquo;Get AI analysis&rdquo;</strong>{" "}
        on its card — that calls the RAG-grounded AI consultant, not a template. This is advice, not
        a guarantee of admission or visa grant.
      </Alert>

      {topPick && (
        <Paper
          variant="outlined"
          sx={{ p: 2, mb: 2, borderRadius: 2, borderColor: "success.main", bgcolor: "success.50" }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <EmojiEventsOutlinedIcon color="success" sx={{ fontSize: 32 }} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Best pick: {topPickCourse?.title ?? "—"} at {topPickUni?.name ?? "—"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {topPick.overall}% overall match · {realMatches.length} real match
                {realMatches.length === 1 ? "" : "es"} clear every hard filter
                {closestMisses.length > 0 && `, ${closestMisses.length} closest miss${closestMisses.length === 1 ? "" : "es"} shown below`}
                .
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}

      <div ref={printRef}>
        <Grid container spacing={2}>
          {/* ---- profile + weights rail ------------------------------------ */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
              <Typography variant="h6">{student.full_name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {student.current_city} · {student.nationality} · counsellor {student.counsellor}
              </Typography>
              <ProfileRow label="Canonical GPA" value={`${p.canonical_gpa} / 100`} />
              <ProfileRow label="English" value={p.english_band ? p.english_source : "no test on file"} />
              <ProfileRow label="Relevant experience" value={`${p.relevant_experience_months} months`} />
              <ProfileRow label="Household income" value={`A$ ${p.annual_household_income_aud.toLocaleString()}/yr`} />
              <ProfileRow label="Available study funds" value={`A$ ${p.available_funds_aud.toLocaleString()}`} />
              <ProfileRow label="Affordability" value={`${p.affordability_score} / 100`} />
              <ProfileRow label="PR intent" value={p.pr_intent} />
              <Typography variant="caption" color="text.secondary">
                profile v{p.version} · engine {run.engine_version}
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Box>
                  <Typography variant="subtitle2">Admission eligibility gate</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {enforceEligibility
                      ? "A course a student doesn't qualify for is excluded from the results below — not just downranked."
                      : "Off — ineligible courses are ranked normally; their eligibility check still shows on the card, informational only."}
                  </Typography>
                </Box>
                <Switch
                  checked={enforceEligibility}
                  onChange={(_, v) => setEnforceEligibility(v)}
                  size="small"
                />
              </Stack>
            </Paper>

            <WhatIfPanel
              student={student}
              realProfile={p}
              override={profileOverride}
              onChange={setProfileOverride}
            />

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Secondary match factors
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Matter once a course clears the eligibility gate above — not before. Raising one
                lowers the others proportionally — always totals 100%.
              </Typography>
              {DIMS.map((d) => (
                <Box key={d.key} sx={{ mt: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">{d.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {Math.round(weights[d.key] * 100)}%
                    </Typography>
                  </Stack>
                  <Slider
                    size="small"
                    min={0}
                    max={0.4}
                    step={0.01}
                    value={weights[d.key]}
                    onChange={(_, v) => setWeights((w) => redistributeWeights(w, d.key, v as number))}
                  />
                </Box>
              ))}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, textAlign: "right" }}>
                Total: {Math.round(Object.values(weights).reduce((a, b) => a + b, 0) * 100)}%
              </Typography>
            </Paper>

            {sharedDocuments.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Documents you&rsquo;ll need
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Same checklist across every option below — shown once here instead of repeated per
                  card.
                </Typography>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {sharedDocuments.map((doc, i) => (
                    <li key={i}>
                      <Typography variant="body2">{doc}</Typography>
                    </li>
                  ))}
                </ul>
              </Paper>
            )}
          </Grid>

          {/* ---- recommendation cards / table -------------------------------- */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} sx={{ mb: 2 }}>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={view}
                onChange={(_, v) => v && setView(v)}
              >
                <ToggleButton value="cards">
                  <ViewAgendaOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} /> Cards
                </ToggleButton>
                <ToggleButton value="table">
                  <TableRowsOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} /> Compare
                </ToggleButton>
              </ToggleButtonGroup>
              <Select size="small" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <MenuItem value="match">Sort: best match</MenuItem>
                <MenuItem value="cost">Sort: lowest tuition</MenuItem>
                <MenuItem value="deadline">Sort: soonest deadline</MenuItem>
              </Select>
              <Box sx={{ flexGrow: 1 }} />
              {running && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary">
                    Re-ranking…
                  </Typography>
                </Stack>
              )}
            </Stack>

            {run.results.length > 0 && run.results.every((r) => r.knockout) && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Nothing in the catalogue clears every hard filter (budget, minimum GPA, minimum
                English, or a passed deadline) — these are the <strong>closest options</strong> and
                exactly what&rsquo;s blocking each one. Adjust the intake (usually budget) and re-run
                for real matches.
              </Alert>
            )}
            {run.results.length === 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                The catalogue returned nothing at all for this profile. Adjust the intake and
                re-run.
              </Alert>
            )}

            {view === "table" ? (
              <ComparisonTable
                results={sortedResults}
                courseById={courseById}
                uniById={uniById}
                student={student}
                availableFundsAud={p.available_funds_aud}
              />
            ) : (
              <Stack spacing={2}>
                {sortedResults.map((r, i) => (
                  <RecommendationCard
                    key={r.course_id}
                    rank={i + 1}
                    isTopPick={topPick?.course_id === r.course_id}
                    result={r}
                    course={courseById.get(r.course_id)}
                    uni={uniById.get(r.university_id)}
                    student={student}
                    availableFundsAud={p.available_funds_aud}
                    defaultExpanded={i === 0}
                    ai={aiState[r.course_id]}
                    enforceEligibility={enforceEligibility}
                    onAskAi={() => getAiAnalysis(r, courseById.get(r.course_id), uniById.get(r.university_id))}
                    onContinueInChat={() =>
                      navigate(`/students/${id}?tab=ai`, {
                        state: {
                          prefillQuestion: `Tell me more about ${courseById.get(r.course_id)?.title ?? "this course"} at ${uniById.get(r.university_id)?.name ?? "this university"} — is it a good pick for this student?`,
                        },
                      })
                    }
                  />
                ))}
              </Stack>
            )}
          </Grid>
        </Grid>
      </div>
    </Box>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: "right" }}>
        {value}
      </Typography>
    </Stack>
  );
}

const VERDICT_META: Record<
  AdmissionEligibility["overall"],
  { label: string; color: "success" | "error" | "warning" | "default" }
> = {
  eligible: { label: "Eligible", color: "success" },
  not_eligible: { label: "Not eligible", color: "error" },
  conditionally_eligible: { label: "Conditionally eligible", color: "warning" },
  insufficient_data: { label: "Insufficient data", color: "default" },
};

const CHECK_ICON: Record<AdmissionCheck["status"], React.ReactNode> = {
  pass: <CheckCircleOutlineIcon fontSize="small" color="success" />,
  fail: <CancelOutlinedIcon fontSize="small" color="error" />,
  unknown: <HelpOutlineIcon fontSize="small" color="disabled" />,
  info: <InfoOutlinedIcon fontSize="small" color="info" />,
};

/**
 * The PRIMARY gate — rendered outside/above the (secondary) score-breakdown
 * accordion so it's never hidden in a collapsed section. Uniform for both a
 * real institution's admission-policy checks and a generic catalogue
 * course's synthesized entry-requirement checks (source distinguishes them).
 */
function AdmissionEligibilityPanel({
  eligibility,
  enforced,
}: {
  eligibility: AdmissionEligibility;
  enforced: boolean;
}) {
  const meta = VERDICT_META[eligibility.overall];
  const isRealPolicy = eligibility.source === "real_policy";
  return (
    <Box sx={{ mt: 1.5, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap spacing={1}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Admission eligibility — {eligibility.institution}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {isRealPolicy && (
            <Chip size="small" variant="outlined" label="Real institution requirements" />
          )}
          <Chip size="small" color={meta.color} label={meta.label} />
        </Stack>
      </Stack>
      {eligibility.overall === "not_eligible" && !enforced && (
        <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.5 }}>
          The eligibility gate is currently OFF — this course still appears in results despite
          not meeting the requirement(s) below.
        </Typography>
      )}
      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {eligibility.checks.map((c, i) => (
          <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
            {CHECK_ICON[c.status]}
            <Typography variant="caption" color="text.secondary">
              <strong>{c.rule}:</strong> {c.detail}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

/**
 * "What-if" exploration — every field defaults to the student's REAL value
 * (from `student.preferences` for preference fields, `realProfile` — the
 * un-overridden `canonical_gpa`/`english_band` the backend always echoes
 * back on `run.profile`, since it only ever replaces the keys actually
 * overridden — for the derived-profile fields) until the counsellor
 * explicitly changes one. Nothing here mutates the student's real record;
 * `onChange` only updates local state, which the parent sends as
 * `profile_override` on the next live `/match/preview` call.
 */
function WhatIfPanel({
  student,
  realProfile,
  override,
  onChange,
}: {
  student: Student;
  realProfile: StudentProfile;
  override: ProfileOverride;
  onChange: (next: ProfileOverride) => void;
}) {
  const set = <K extends keyof ProfileOverride>(key: K, value: ProfileOverride[K]) =>
    onChange({ ...override, [key]: value });

  const gpa = override.canonical_gpa ?? realProfile.canonical_gpa;
  const english = override.english_band ?? realProfile.english_band ?? 0;
  const budget = override.max_tuition_per_year ?? student.preferences.max_tuition_per_year;
  const countries = override.preferred_countries ?? student.preferences.preferred_countries;
  const cities = override.preferred_cities ?? student.preferences.preferred_cities;
  const degreeLevel = override.degree_level ?? student.preferences.degree_level;
  const field = override.field ?? student.preferences.field;

  const hasOverride = Object.keys(override).length > 0;

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="subtitle2">What-if student profile</Typography>
        {hasOverride && (
          <Button size="small" startIcon={<RestartAltIcon fontSize="small" />} onClick={() => onChange({})}>
            Reset all
          </Button>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        Explore a hypothetical without changing the student&rsquo;s real profile — re-ranks live,
        same as the sliders below.
      </Typography>

      <Stack spacing={1.5}>
        <TextField
          size="small"
          type="number"
          label="English band (IELTS-equivalent)"
          value={english}
          inputProps={{ step: 0.5, min: 0, max: 9 }}
          onChange={(e) => set("english_band", e.target.value === "" ? undefined : Number(e.target.value))}
        />
        <TextField
          size="small"
          type="number"
          label="Canonical GPA (0-100)"
          value={gpa}
          inputProps={{ step: 1, min: 0, max: 100 }}
          onChange={(e) => set("canonical_gpa", e.target.value === "" ? undefined : Number(e.target.value))}
        />
        <TextField
          size="small"
          type="number"
          label="Budget — max tuition/yr (AUD)"
          value={budget}
          inputProps={{ step: 1000, min: 0 }}
          onChange={(e) => set("max_tuition_per_year", e.target.value === "" ? undefined : Number(e.target.value))}
        />
        <Select
          size="small"
          multiple
          value={countries}
          onChange={(e) => set("preferred_countries", typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value)}
          renderValue={(v) => (v as string[]).join(", ")}
        >
          {OVERRIDE_COUNTRIES.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </Select>
        <Autocomplete
          multiple
          freeSolo
          size="small"
          options={[]}
          value={cities}
          onChange={(_, v) => set("preferred_cities", v as string[])}
          renderInput={(params) => <TextField {...params} label="Preferred cities" placeholder="Add a city" />}
        />
        <Select size="small" value={degreeLevel} onChange={(e) => set("degree_level", e.target.value)}>
          {OVERRIDE_DEGREE_LEVELS.map((d) => (
            <MenuItem key={d} value={d}>
              {d}
            </MenuItem>
          ))}
        </Select>
        <TextField size="small" label="Field of study" value={field} onChange={(e) => set("field", e.target.value)} />
      </Stack>
    </Paper>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ mb: 0.75 }}>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption">{label}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
          {value}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={value}
        color={band(value)}
        sx={{ height: 6, borderRadius: 3 }}
      />
    </Box>
  );
}

function Panel({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  if (!items.length && !empty) return null;
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </Typography>
      {items.length ? (
        <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
          {items.map((t, i) => (
            <li key={i}>
              <Typography variant="body2">{t}</Typography>
            </li>
          ))}
        </ul>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {empty}
        </Typography>
      )}
    </Box>
  );
}

function CostVsFundsBar({ student, availableFundsAud, course }: { student: Student; availableFundsAud: number; course?: Course }) {
  const c = costBreakdown(student, availableFundsAud, course);
  if (!c) return null;
  const pct = Math.min(100, c.coverage);
  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption" color="text.secondary">
          Total program cost ({c.years.toFixed(1)} yr tuition + estimated living) vs your available funds
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 700 }} color={`${band(c.coverage)}.main`}>
          {c.coverage}% covered
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={pct} color={band(c.coverage)} sx={{ height: 6, borderRadius: 3, my: 0.5 }} />
      <Typography variant="caption" color="text.secondary">
        {money(c.totalCost)} total · {money(c.funds)} available
        {c.coverage < 100 && ` · A$${Math.round(c.totalCost - c.funds).toLocaleString()} shortfall`}
      </Typography>
    </Box>
  );
}

function DeadlineChip({ course }: { course?: Course }) {
  const d = deadlineInfo(course);
  if (!d) return null;
  const color = d.days < 0 ? "error" : d.days <= 30 ? "warning" : "default";
  const label =
    d.days < 0
      ? `Deadline passed (${d.date})`
      : d.days <= 30
        ? `Apply by ${d.date} · ${d.days}d left`
        : `Apply by ${d.date}`;
  return <Chip size="small" color={color === "default" ? undefined : color} variant="outlined" label={label} />;
}

function CiteChips({ cites }: { cites?: { chunk_id: string; source_url: string }[] }) {
  if (!cites?.length) return null;
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
      {cites.map((c, i) => (
        <Tooltip key={c.chunk_id + i} title={c.source_url}>
          <Chip
            size="small"
            variant="outlined"
            clickable
            component="a"
            href={c.source_url}
            target="_blank"
            rel="noreferrer"
            label={`[${i + 1}]`}
            icon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
          />
        </Tooltip>
      ))}
    </Stack>
  );
}

function AiAnalysisSection({
  ai,
  onAskAi,
  onContinueInChat,
}: {
  ai?: AiAnalysisState;
  onAskAi: () => void;
  onContinueInChat: () => void;
}) {
  if (!ai) {
    return (
      <Button size="small" startIcon={<AutoAwesomeOutlinedIcon />} onClick={onAskAi} sx={{ mt: 1 }}>
        Get AI analysis
      </Button>
    );
  }
  if (ai.loading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="caption" color="text.secondary">
          Asking the AI consultant (grounded, cited)…
        </Typography>
      </Stack>
    );
  }
  if (ai.error) {
    return (
      <Stack spacing={1} sx={{ mt: 1 }}>
        <Alert severity="error" sx={{ py: 0 }}>
          Couldn&rsquo;t reach the AI consultant.
        </Alert>
        <Button size="small" onClick={onAskAi}>
          Retry
        </Button>
      </Stack>
    );
  }
  return (
    <Paper variant="outlined" sx={{ p: 1.5, mt: 1, borderRadius: 1.5, bgcolor: "grey.50" }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <AutoAwesomeOutlinedIcon fontSize="small" color="primary" />
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          AI analysis
        </Typography>
        {ai.degraded && <Chip size="small" color="warning" variant="outlined" label="Degraded" />}
      </Stack>
      <AiMarkdown>{ai.answer ?? ""}</AiMarkdown>
      <CiteChips cites={ai.cites} />
      <Button size="small" startIcon={<ForumOutlinedIcon />} onClick={onContinueInChat} sx={{ mt: 1 }}>
        Continue in AI Consultant
      </Button>
    </Paper>
  );
}

function RecommendationCard({
  rank,
  isTopPick,
  result,
  course,
  uni,
  student,
  availableFundsAud,
  defaultExpanded,
  ai,
  enforceEligibility,
  onAskAi,
  onContinueInChat,
}: {
  rank: number;
  isTopPick: boolean;
  result: MatchResult;
  course?: Course;
  uni?: University;
  student: Student;
  availableFundsAud: number;
  defaultExpanded: boolean;
  ai?: AiAnalysisState;
  enforceEligibility: boolean;
  onAskAi: () => void;
  onContinueInChat: () => void;
}) {
  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 2, borderColor: isTopPick ? "success.main" : undefined, borderWidth: isTopPick ? 2 : 1 }}
    >
      <CardContent>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip size="small" label={`#${rank}`} color={result.knockout ? "default" : "primary"} />
              {isTopPick && (
                <Chip size="small" color="success" icon={<EmojiEventsOutlinedIcon />} label="Best pick" />
              )}
              {result.knockout && <Chip size="small" color="warning" variant="outlined" label="Closest miss" />}
              <Typography variant="h6">{course?.title ?? result.course_id.slice(0, 8)}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {uni?.name ?? "—"} · {uni?.city}, {uni?.country} · CRICOS {course?.cricos ?? "—"} ·{" "}
              {course?.degree_level} · {course?.duration_months} months · A$
              {course?.tuition_fee?.toLocaleString() ?? "?"}/yr
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
              <DeadlineChip course={course} />
              <Chip size="small" variant="outlined" label={`Scholarship potential: ${result.scholarship_potential}`} />
            </Stack>
            <CostVsFundsBar student={student} availableFundsAud={availableFundsAud} course={course} />
          </Box>
          <Box sx={{ textAlign: "center", minWidth: 72 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: `${band(result.overall)}.main`, lineHeight: 1 }}>
              {result.overall}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              overall
            </Typography>
          </Box>
        </Stack>

        {result.admission_eligibility && (
          <AdmissionEligibilityPanel eligibility={result.admission_eligibility} enforced={enforceEligibility} />
        )}

        <Accordion
          defaultExpanded={defaultExpanded}
          disableGutters
          elevation={0}
          sx={{ mt: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5, "&:before": { display: "none" } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Secondary match factors
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 5 }}>
                {DIMS.map((d) => (
                  <Bar key={d.key} label={d.label} value={result.subscores[d.key]} />
                ))}
              </Grid>
              <Grid size={{ xs: 12, sm: 7 }}>
                {result.knockout && (
                  <Panel title="Why this doesn't clear the bar" items={result.knockout_reasons} />
                )}
                <Panel title="Why recommended" items={result.why} empty="No standout strengths." />
                <Panel title="Potential concerns" items={result.concerns} empty="None flagged." />
                <Panel title="Missing information" items={result.missing_info} empty="Nothing outstanding." />
                <Panel title="Scholarship opportunities" items={result.scholarship_opportunities} />
                <Panel title="Alternatives" items={result.alternatives} />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        <Divider sx={{ my: 1.5 }} />
        <AiAnalysisSection ai={ai} onAskAi={onAskAi} onContinueInChat={onContinueInChat} />
      </CardContent>
    </Card>
  );
}

function ComparisonTable({
  results,
  courseById,
  uniById,
  student,
  availableFundsAud,
}: {
  results: MatchResult[];
  courseById: Map<string, Course>;
  uniById: Map<string, University>;
  student: Student;
  availableFundsAud: number;
}) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Course</TableCell>
            <TableCell>University</TableCell>
            <TableCell align="right">Tuition/yr</TableCell>
            <TableCell align="right">Funds coverage</TableCell>
            <TableCell align="right">Overall</TableCell>
            <TableCell>Scholarship</TableCell>
            <TableCell>Deadline</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {results.map((r, i) => {
            const course = courseById.get(r.course_id);
            const uni = uniById.get(r.university_id);
            const c = costBreakdown(student, availableFundsAud, course);
            const d = deadlineInfo(course);
            return (
              <TableRow key={r.course_id} sx={{ opacity: r.knockout ? 0.65 : 1 }}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {course?.title ?? "—"}
                  </Typography>
                  {r.knockout && (
                    <Chip size="small" color="warning" variant="outlined" label="Closest miss" sx={{ mt: 0.5 }} />
                  )}
                </TableCell>
                <TableCell>
                  {uni?.name ?? "—"}
                  <br />
                  <Typography variant="caption" color="text.secondary">
                    {uni?.city}, {uni?.country}
                  </Typography>
                </TableCell>
                <TableCell align="right">{course ? money(course.tuition_fee) : "—"}</TableCell>
                <TableCell align="right">
                  {c ? (
                    <Typography variant="body2" color={`${band(c.coverage)}.main`} sx={{ fontWeight: 600 }}>
                      {c.coverage}%
                    </Typography>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" color={`${band(r.overall)}.main`} sx={{ fontWeight: 700 }}>
                    {r.overall}
                  </Typography>
                </TableCell>
                <TableCell>{r.scholarship_potential}</TableCell>
                <TableCell>
                  {d ? (
                    <Typography variant="caption" color={d.days < 0 ? "error.main" : d.days <= 30 ? "warning.main" : "text.secondary"}>
                      {d.date}
                    </Typography>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

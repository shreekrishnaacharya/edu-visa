import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { useOne, useUpdate } from "@refinedev/core";
import {
  Alert,
  Box,
  Button,
  Card as MuiCard,
  Chip,
  CircularProgress,
  Divider,
  Grid2 as Grid,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import TabContext from "@mui/lab/TabContext";
import TabList from "@mui/lab/TabList";
import TabPanel from "@mui/lab/TabPanel";
import InsightsIcon from "@mui/icons-material/Insights";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";

import { RefineShowView } from "@components/view/show";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import { Monogram } from "@components/other/monogram";
import { FollowUpTab, DocumentsTab } from "./records";
import { AiConsultantTab } from "./ai-consultant";
import { Card as SectionCard, ProfileItemCard } from "@components/card";
import { LabelData } from "@components/other/label.data";
import NoDataLabel from "@components/other/no.data";
import type { MatchRun, Student, StudentState } from "@mocks/types";
import { deriveProfile } from "@mocks/engine/derive";
import { toAud } from "@mocks/db/reference";
import { BASE_URL } from "@common/options";
import { axiosInstance } from "../../../_service/axious";

const STATE_COLOR: Record<string, "default" | "info" | "warning" | "success"> = {
  Enquiry: "default",
  Profiling: "info",
  Shortlisted: "warning",
  Applied: "success",
};

const money = (n: number) => `A$ ${Math.round(n).toLocaleString()}`;
const age = (dob: string) => {
  const d = new Date(dob);
  return Number.isNaN(d.getTime()) ? "—" : `${Math.floor((Date.now() - d.getTime()) / 3.15576e10)} yrs`;
};

export function StudentShowPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Lets the match report page ("Continue in AI Consultant") deep-link
  // straight into this tab, optionally with a question pre-filled.
  const [tab, setTab] = useState(searchParams.get("tab") || "academic");
  const prefillQuestion = (location.state as { prefillQuestion?: string } | null)?.prefillQuestion;

  const { data, isLoading, isError } = useOne<Student>({
    resource: "students",
    id,
    queryOptions: { retry: 0 },
  });
  const [lastRun, setLastRun] = useState<MatchRun | undefined>();
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    axiosInstance
      .get<MatchRun>(`${BASE_URL}/students/${id}/match-runs/latest`)
      .then(({ data: r }) => !cancelled && setLastRun(r))
      .catch(() => !cancelled && setLastRun(undefined));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoading) return <LinearProgress sx={{ mt: 4 }} />;
  if (isError || !data?.data) return <NotFound id={id} />;
  const s = data.data as Student & { profile?: ReturnType<typeof deriveProfile> | null };
  // Prefer the server's persisted, versioned profile; fall back to a local
  // derivation (identical maths — see server golden test) if it isn't present.
  const p = s.profile ?? deriveProfile(s);

  return (
    <RefineShowView
      resource="students"
      recordItemId={id}
      title={s.full_name}
      breadcrumb={<AppBreadcrumbs items={[{ label: "Students", href: "/students" }, { label: s.full_name }]} />}
      headerButtons={
        <Stack direction="row" spacing={1}>
          <Button startIcon={<EditOutlinedIcon />} onClick={() => navigate(`/students/${id}/edit`)}>
            Edit intake
          </Button>
          <Button
            variant="contained"
            startIcon={<InsightsIcon />}
            onClick={() => navigate(`/students/${id}/matches`)}
          >
            Match report
          </Button>
        </Stack>
      }
    >
      <Box sx={{ p: { xs: 1, sm: 2 } }}>
        <Grid container spacing={2}>
          {/* ---------------- left rail ---------------- */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={2}>
              <IdentityCard student={s} />
              <SnapshotCard student={s} profile={p} onOpenReport={() => navigate(`/students/${id}/matches`)} lastRun={lastRun} />
              <PersonalCard student={s} />
              <PreferencesCard student={s} />
            </Stack>
          </Grid>

          {/* ---------------- tabs ---------------- */}
          <Grid size={{ xs: 12, md: 8 }}>
            <TabContext value={tab}>
              <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
                <TabList onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
                  <Tab
                    label="AI Consultant"
                    value="ai"
                    icon={<SmartToyOutlinedIcon fontSize="small" />}
                    iconPosition="start"
                  />
                  <Tab label="Academic" value="academic" />
                  <Tab label="English" value="english" />
                  <Tab label="Work" value="work" />
                  <Tab label="Career" value="career" />
                  <Tab label="Financial" value="financial" />
                  <Tab label="Sponsors" value="sponsors" />
                  <Tab
                    label={`Dependants${s.dependants.length ? ` (${s.dependants.length})` : ""}`}
                    value="dependants"
                  />
                  <Tab label="Visa history" value="visa" />
                  <Tab label="Documents" value="documents" />
                  <Tab label="Follow-ups" value="followups" />
                </TabList>
              </Box>
              <TabPanel value="ai" sx={{ p: 0 }}>
                <AiConsultantTab studentId={id} initialQuestion={prefillQuestion} />
              </TabPanel>
              <TabPanel value="academic" sx={{ p: 0 }}><AcademicTab student={s} /></TabPanel>
              <TabPanel value="english" sx={{ p: 0 }}><EnglishTab student={s} profile={p} /></TabPanel>
              <TabPanel value="work" sx={{ p: 0 }}><WorkTab student={s} profile={p} /></TabPanel>
              <TabPanel value="career" sx={{ p: 0 }}><CareerTab student={s} /></TabPanel>
              <TabPanel value="financial" sx={{ p: 0 }}><FinancialTab student={s} profile={p} /></TabPanel>
              <TabPanel value="sponsors" sx={{ p: 0 }}><SponsorTab student={s} /></TabPanel>
              <TabPanel value="dependants" sx={{ p: 0 }}><DependantsTab student={s} profile={p} /></TabPanel>
              <TabPanel value="visa" sx={{ p: 0 }}><VisaTab student={s} /></TabPanel>
              <TabPanel value="documents" sx={{ p: 0 }}><DocumentsTab studentId={id} /></TabPanel>
              <TabPanel value="followups" sx={{ p: 0 }}><FollowUpTab studentId={id} /></TabPanel>
            </TabContext>
          </Grid>
        </Grid>
      </Box>
    </RefineShowView>
  );
}

// ---------------------------------------------------------------------------
// left rail
// ---------------------------------------------------------------------------

function IdentityCard({ student }: { student: Student }) {
  return (
    <MuiCard sx={{ overflow: "hidden" }}>
      <Box sx={{ height: 76, background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.primary.dark})` }} />
      <Stack alignItems="center" sx={{ px: 2, pb: 2, mt: -5 }}>
        <Monogram
          name={student.full_name}
          sx={{ width: 88, height: 88, fontSize: 28, border: "4px solid", borderColor: "background.paper", boxShadow: 2 }}
        />
        <Typography variant="h6" sx={{ mt: 1, textAlign: "center", lineHeight: 1.2 }}>
          {student.full_name}
        </Typography>
        <Typography variant="body2" color="primary" fontWeight={600}>
          {student.id.toUpperCase()}
        </Typography>
        <StateEditor student={student} />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {student.counsellor} · {student.branch}
        </Typography>
      </Stack>
    </MuiCard>
  );
}

const STUDENT_STATES: StudentState[] = ["Enquiry", "Profiling", "Shortlisted", "Applied"];

/** Editable stage chip — click to change the student's status inline. */
function StateEditor({ student }: { student: Student }) {
  const { mutate: update, isLoading } = useUpdate();
  const chipRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const choose = (state: StudentState) => {
    setAnchor(null);
    if (state === student.state) return;
    update({
      resource: "students",
      id: student.id,
      values: { state },
      successNotification: { type: "success", message: `Stage set to “${state}”` },
    });
  };

  return (
    <>
      <Chip
        ref={chipRef}
        size="small"
        sx={{ mt: 1, cursor: "pointer" }}
        color={STATE_COLOR[student.state] ?? "default"}
        variant="outlined"
        label={student.state}
        disabled={isLoading}
        onClick={() => setAnchor(chipRef.current)}
        onDelete={() => setAnchor(chipRef.current)}
        deleteIcon={isLoading ? <CircularProgress size={13} /> : <ArrowDropDownIcon />}
      />
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {STUDENT_STATES.map((s) => (
          <MenuItem key={s} selected={s === student.state} onClick={() => choose(s)}>
            <ListItemIcon>{s === student.state && <CheckIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{s}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function ScoreMeter({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "success" : value >= 55 ? "warning" : "error";
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption">{label}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
          {value}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={value} color={color} sx={{ height: 6, borderRadius: 3 }} />
    </Box>
  );
}

function SnapshotCard({
  student,
  profile,
  lastRun,
  onOpenReport,
}: {
  student: Student;
  profile: ReturnType<typeof deriveProfile>;
  lastRun?: MatchRun;
  onOpenReport: () => void;
}) {
  return (
    <SectionCard title="Match snapshot" icon={<InsightsIcon fontSize="small" />}>
      <Box sx={{ p: 2 }}>
        <Grid container rowSpacing={0.75} columnSpacing={2}>
          <Grid size={12}><LabelData label="Canonical GPA" value={`${profile.canonical_gpa} / 100`} /></Grid>
          <Grid size={12}><LabelData label="English" value={profile.english_band ? profile.english_source : "no test on file"} /></Grid>
          <Grid size={12}><LabelData label="Relevant experience" value={`${profile.relevant_experience_months} months`} /></Grid>
          <Grid size={12}><LabelData label="Household income" value={`${money(profile.annual_household_income_aud)}/yr`} /></Grid>
          <Grid size={12}><LabelData label="Available funds" value={money(profile.available_funds_aud)} /></Grid>
          <Grid size={12}><LabelData label="PR intent" value={profile.pr_intent} /></Grid>
        </Grid>
        <Box sx={{ mt: 1.5 }}>
          <ScoreMeter label="Affordability" value={profile.affordability_score} />
        </Box>
        <Divider sx={{ my: 1.5 }} />
        {lastRun ? (
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              Last run {new Date(lastRun.created_at).toLocaleDateString()} · top {lastRun.results.length}
            </Typography>
            {lastRun.results.slice(0, 3).map((r, i) => (
              <Typography key={r.course_id} variant="body2">
                {i + 1}. {r.overall}% — {r.course_id}
              </Typography>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No saved match run yet.
          </Typography>
        )}
        <Button fullWidth size="small" variant="outlined" sx={{ mt: 1.5 }} onClick={onOpenReport}>
          Open match report
        </Button>
      </Box>
    </SectionCard>
  );
}

function PersonalCard({ student }: { student: Student }) {
  return (
    <SectionCard title="Personal">
      <Box sx={{ p: 2 }}>
        <Grid container rowSpacing={0.75}>
          <Grid size={12}><LabelData label="Date of birth" value={`${student.date_of_birth} (${age(student.date_of_birth)})`} /></Grid>
          <Grid size={12}><LabelData label="Gender" value={student.gender} /></Grid>
          <Grid size={12}><LabelData label="Nationality" value={student.nationality} /></Grid>
          <Grid size={12}><LabelData label="Current city" value={student.current_city} /></Grid>
          <Grid size={12}><LabelData label="Passport" value={student.passport_status} /></Grid>
          <Grid size={12}><LabelData label="Marital status" value={student.marital_status} /></Grid>
          <Grid size={12}>
            <LabelData
              label="Dependants"
              value={
                student.dependants.length
                  ? `${student.dependants.length} (${student.dependants.filter((d) => d.accompanying).length} accompanying)`
                  : "none"
              }
            />
          </Grid>
          <Grid size={12}>
            <LabelData
              label="Consent"
              value={student.consent_given_at ? new Date(student.consent_given_at).toLocaleDateString() : "not captured"}
            />
          </Grid>
        </Grid>
      </Box>
    </SectionCard>
  );
}

function PreferencesCard({ student }: { student: Student }) {
  const pr = student.preferences;
  return (
    <SectionCard title="Preferences">
      <Box sx={{ p: 2 }}>
        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1.5 }}>
          {pr.preferred_countries.map((c) => (
            <Chip key={c} size="small" label={c} />
          ))}
        </Stack>
        <Grid container rowSpacing={0.75}>
          <Grid size={12}><LabelData label="Degree level" value={pr.degree_level} /></Grid>
          <Grid size={12}><LabelData label="Field" value={pr.field} /></Grid>
          <Grid size={12}><LabelData label="Budget / yr" value={money(toAud(pr.max_tuition_per_year, pr.tuition_currency))} /></Grid>
          <Grid size={12}><LabelData label="Intake" value={pr.intake} /></Grid>
          <Grid size={12}><LabelData label="Scholarship" value={pr.scholarship_required ? `required (≥ ${pr.min_scholarship_pct}%)` : "not required"} /></Grid>
          <Grid size={12}><LabelData label="City size" value={pr.city_size} /></Grid>
        </Grid>
      </Box>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// tabs
// ---------------------------------------------------------------------------

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <SectionCard title={title} sx={{ mb: 2 }}>
    <Box sx={{ p: 2 }}>{children}</Box>
  </SectionCard>
);

function AcademicTab({ student }: { student: Student }) {
  if (!student.academic.length) return <NoDataLabel message="No academic records" />;
  return (
    <Section title="Academic history">
      <Stack spacing={2}>
        {student.academic.map((a) => (
          <ProfileItemCard key={a.id} sx={{ alignItems: "flex-start" }}>
            <Monogram name={a.institution || a.course} variant="rounded" sx={{ width: 48, height: 48 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2">{a.course || "—"}</Typography>
              <Typography variant="caption" color="text.secondary">
                {a.institution} · {a.country} · {a.start_year}–{a.end_year}
              </Typography>
              <Grid container columnSpacing={2} rowSpacing={0.5} sx={{ mt: 0.5 }}>
                <Grid size={{ xs: 6, sm: 4 }}><LabelData direction="column" gap={0.25} label="Level" value={a.level} /></Grid>
                <Grid size={{ xs: 6, sm: 4 }}><LabelData direction="column" gap={0.25} label="GPA" value={`${a.gpa_value} (${a.gpa_scale})`} /></Grid>
                <Grid size={{ xs: 6, sm: 4 }}><LabelData direction="column" gap={0.25} label="Study gap" value={a.gap_months ? `${a.gap_months} months` : "none"} /></Grid>
              </Grid>
            </Box>
          </ProfileItemCard>
        ))}
      </Stack>
    </Section>
  );
}

function EnglishTab({ student, profile }: { student: Student; profile: ReturnType<typeof deriveProfile> }) {
  return (
    <Section title="English tests">
      {profile.english_band != null ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          Best: {profile.english_source}
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No test on file — the engine assumes a test at the entry minimum and flags it.
        </Alert>
      )}
      {student.language_tests.length === 0 ? (
        <NoDataLabel message="No tests recorded" />
      ) : (
        <Stack spacing={2}>
          {student.language_tests.map((lt) => (
            <ProfileItemCard key={lt.id}>
              <Chip label={lt.test} color="primary" variant="outlined" />
              <Box sx={{ flex: 1 }}>
                <Grid container columnSpacing={2} rowSpacing={0.5}>
                  <Grid size={{ xs: 6, sm: 3 }}><LabelData direction="column" gap={0.25} label="Overall" value={lt.overall} /></Grid>
                  <Grid size={{ xs: 6, sm: 3 }}><LabelData direction="column" gap={0.25} label="Test date" value={lt.test_date} /></Grid>
                  <Grid size={{ xs: 6, sm: 3 }}><LabelData direction="column" gap={0.25} label="L/R/W/S" value={[lt.listening, lt.reading, lt.writing, lt.speaking].filter((x) => x != null).join(" / ") || "—"} /></Grid>
                </Grid>
              </Box>
            </ProfileItemCard>
          ))}
        </Stack>
      )}
    </Section>
  );
}

function WorkTab({ student, profile }: { student: Student; profile: ReturnType<typeof deriveProfile> }) {
  return (
    <Section title={`Work experience — ${profile.relevant_experience_months} relevant months`}>
      {student.work.length === 0 ? (
        <NoDataLabel message="No work experience" />
      ) : (
        <Stack spacing={2}>
          {student.work.map((w) => (
            <ProfileItemCard key={w.id} sx={{ alignItems: "flex-start" }}>
              <Monogram name={w.employer || w.title} variant="rounded" sx={{ width: 48, height: 48 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle2">{w.title}</Typography>
                  {w.relevant && <Chip size="small" color="success" variant="outlined" label="relevant" />}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {w.employer} · {w.industry} · {w.country}
                </Typography>
                <Grid container columnSpacing={2} rowSpacing={0.5} sx={{ mt: 0.5 }}>
                  <Grid size={{ xs: 6, sm: 4 }}><LabelData direction="column" gap={0.25} label="From" value={w.start_date} /></Grid>
                  <Grid size={{ xs: 6, sm: 4 }}><LabelData direction="column" gap={0.25} label="To" value={w.end_date ?? "current"} /></Grid>
                  <Grid size={{ xs: 6, sm: 4 }}><LabelData direction="column" gap={0.25} label="Type" value={w.full_time ? "full-time" : "part-time"} /></Grid>
                </Grid>
              </Box>
            </ProfileItemCard>
          ))}
        </Stack>
      )}
    </Section>
  );
}

function CareerTab({ student }: { student: Student }) {
  const c = student.career_goal;
  return (
    <Section title="Career goals">
      <Grid container rowSpacing={0.75}>
        <Grid size={{ xs: 12, sm: 6 }}><LabelData direction="column" gap={0.25} label="Target occupation" value={c.target_occupation} /></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><LabelData direction="column" gap={0.25} label="Target industry" value={c.target_industry} /></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><LabelData direction="column" gap={0.25} label="Intended field" value={c.intended_field} /></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><LabelData direction="column" gap={0.25} label="Long-term goal" value={c.long_term} /></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><LabelData direction="column" gap={0.25} label="Changing field" value={c.change_field ? "yes" : "no"} /></Grid>
        <Grid size={12}><LabelData direction="column" gap={0.25} label="Reason" value={c.reason || "—"} /></Grid>
      </Grid>
    </Section>
  );
}

function MoneyTable({ rows }: { rows: { label: string; sub?: string; amount: string; tag?: string }[] }) {
  if (!rows.length) return <NoDataLabel message="Nothing recorded" />;
  return (
    <Stack divider={<Divider flexItem />} spacing={1}>
      {rows.map((r, i) => (
        <Stack key={i} direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="body2">{r.label}</Typography>
            {r.sub && <Typography variant="caption" color="text.secondary">{r.sub}</Typography>}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {r.tag && <Chip size="small" variant="outlined" label={r.tag} />}
            <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {r.amount}
            </Typography>
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}

function FinancialTab({ student, profile }: { student: Student; profile: ReturnType<typeof deriveProfile> }) {
  const f = student.finance;
  return (
    <>
      <Section title="Derived">
        <Grid container rowSpacing={0.75}>
          <Grid size={{ xs: 12, sm: 6 }}><LabelData direction="column" gap={0.25} label="Household income / yr" value={money(profile.annual_household_income_aud)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><LabelData direction="column" gap={0.25} label="Available study funds" value={money(profile.available_funds_aud)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><LabelData direction="column" gap={0.25} label="Affordability score" value={`${profile.affordability_score} / 100`} /></Grid>
        </Grid>
      </Section>
      <Section title="Income sources">
        <MoneyTable
          rows={f.income_sources.map((s) => ({
            label: s.kind,
            amount: money(toAud(s.amount, s.currency)),
            tag: s.evidence ? "evidence" : "no evidence",
          }))}
        />
      </Section>
      <Section title="Assets">
        <MoneyTable
          rows={f.assets.map((a) => ({
            label: a.kind,
            sub: a.liquid ? "liquid" : "illiquid",
            amount: money(toAud(a.amount, a.currency)),
          }))}
        />
      </Section>
      <Section title="Liabilities">
        <MoneyTable
          rows={f.liabilities.map((l) => ({
            label: l.kind,
            sub: `repayment ${money(toAud(l.monthly_repayment, l.currency))}/mo`,
            amount: money(toAud(l.amount, l.currency)),
          }))}
        />
      </Section>
    </>
  );
}

function SponsorTab({ student }: { student: Student }) {
  if (!student.sponsors.length) return <NoDataLabel message="No sponsors" />;
  return (
    <Section title="Sponsors">
      <Stack spacing={2}>
        {student.sponsors.map((sp) => (
          <ProfileItemCard key={sp.id}>
            <Monogram name={sp.relationship} variant="rounded" sx={{ width: 44, height: 44 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2">{sp.relationship}</Typography>
              <Grid container columnSpacing={2} rowSpacing={0.5}>
                <Grid size={{ xs: 6, sm: 4 }}><LabelData direction="column" gap={0.25} label="Occupation" value={sp.occupation} /></Grid>
                <Grid size={{ xs: 6, sm: 4 }}><LabelData direction="column" gap={0.25} label="Annual income" value={money(toAud(sp.annual_income, sp.currency))} /></Grid>
                <Grid size={{ xs: 6, sm: 4 }}><LabelData direction="column" gap={0.25} label="Evidence" value={sp.evidence ? "yes" : "no"} /></Grid>
              </Grid>
            </Box>
          </ProfileItemCard>
        ))}
      </Stack>
    </Section>
  );
}

function DependantsTab({
  student,
  profile,
}: {
  student: Student;
  profile: ReturnType<typeof deriveProfile>;
}) {
  const accompanying = student.dependants.filter((d) => d.accompanying).length;
  const relColor: Record<string, "primary" | "secondary" | "default"> = {
    spouse: "primary",
    child: "secondary",
    parent: "default",
    other: "default",
  };
  return (
    <Section title="Dependants">
      <Alert severity={accompanying ? "warning" : "info"} sx={{ mb: 2 }}>
        {accompanying
          ? `${accompanying} dependant${accompanying > 1 ? "s" : ""} travelling with the student — this adds about A$ ${(
              accompanying * 8000
            ).toLocaleString()}/yr to the visa financial-capacity requirement, reflected in the affordability score (${profile.affordability_score}/100).`
          : "No dependants travelling with the student — no effect on the financial requirement."}
      </Alert>
      {student.dependants.length === 0 ? (
        <NoDataLabel message="No dependants — applying alone" />
      ) : (
        <Stack spacing={2}>
          {student.dependants.map((d) => (
            <ProfileItemCard key={d.id} sx={{ alignItems: "flex-start" }}>
              <Chip
                label={d.relationship}
                color={relColor[d.relationship] ?? "default"}
                variant="outlined"
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="subtitle2">{d.full_name || d.relationship}</Typography>
                  {d.accompanying && (
                    <Chip size="small" color="warning" variant="outlined" label="accompanying" />
                  )}
                </Stack>
                <Grid container columnSpacing={2} rowSpacing={0.5}>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <LabelData
                      direction="column"
                      gap={0.25}
                      label="Date of birth"
                      value={d.date_of_birth ? `${d.date_of_birth} (${age(d.date_of_birth)})` : "—"}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <LabelData direction="column" gap={0.25} label="Passport" value={d.passport_status} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <LabelData
                      direction="column"
                      gap={0.25}
                      label="Travelling"
                      value={d.accompanying ? "with the student" : "staying home"}
                    />
                  </Grid>
                </Grid>
              </Box>
            </ProfileItemCard>
          ))}
        </Stack>
      )}
    </Section>
  );
}

function VisaTab({ student }: { student: Student }) {
  const refused = student.visa_history.some((v) => v.outcome === "refused");
  return (
    <Section title="Visa & immigration history">
      <Alert severity={refused ? "warning" : "info"} sx={{ mb: 2 }}>
        {refused
          ? "Prior refusal on file — address it directly in the application. Kept separate from the academic match score."
          : "No adverse visa history. This section never affects the academic match score."}
      </Alert>
      {student.visa_history.length === 0 ? (
        <NoDataLabel message="No previous visa applications" />
      ) : (
        <Stack spacing={2}>
          {student.visa_history.map((v) => (
            <ProfileItemCard key={v.id} sx={{ alignItems: "flex-start" }}>
              <Chip
                label={v.outcome}
                color={v.outcome === "refused" ? "error" : v.outcome === "granted" ? "success" : "default"}
                variant="outlined"
              />
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2">{v.country} · {v.visa_type}</Typography>
                <Typography variant="caption" color="text.secondary">Decision {v.decision_date}</Typography>
                {v.refusal_reason && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{v.refusal_reason}</Typography>
                )}
              </Box>
            </ProfileItemCard>
          ))}
        </Stack>
      )}
    </Section>
  );
}

function NotFound({ id }: { id: string }) {
  const navigate = useNavigate();
  return (
    <Box sx={{ maxWidth: 480, mx: "auto", mt: 8, textAlign: "center" }}>
      <Typography variant="h6" gutterBottom>
        Student not found
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        No student matches <code>{id}</code>. It may have been removed, or the link is stale
        (the prototype's data resets on reload).
      </Typography>
      <Button variant="contained" onClick={() => navigate("/students")}>
        Back to students
      </Button>
    </Box>
  );
}

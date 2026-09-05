import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { useCreate, useOne, useUpdate } from "@refinedev/core";
import {
  Box,
  Button,
  Divider,
  Grid2 as Grid,
  IconButton,
  Paper,
  Stack,
  Step,
  StepButton,
  Stepper,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";

import { RefineCreateView } from "@components/view/create";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import type { Student } from "@mocks/types";
import { emptyIntake, STEP_LABELS, type IntakeForm } from "./defaults";
import { Text, Num, Select, MultiSelect, Toggle, DateField, StepIntro } from "./fields";

type Props = { mode: "create" | "edit" };

const COUNTRIES = ["AU", "NZ", "UK", "CA", "US"];
const DEGREE_LEVELS = ["Bachelor", "PG Diploma", "Master", "PhD"];
const CURRENCIES = ["NPR", "AUD", "GBP", "CAD", "USD"];

export function StudentIntakePage({ mode }: Props) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [active, setActive] = useState(0);

  const { data: existing, isLoading } = useOne<Student>({
    resource: "students",
    id: id ?? "",
    queryOptions: { enabled: mode === "edit" && Boolean(id), retry: 0 },
  });

  const { control, handleSubmit, reset, trigger, formState } = useForm<IntakeForm>({
    defaultValues: emptyIntake(),
    mode: "onTouched",
  });

  useEffect(() => {
    if (mode === "edit" && existing?.data) {
      const { id: _a, created_at: _b, ...rest } = existing.data as Student;
      reset(rest as IntakeForm);
    }
  }, [existing, mode, reset]);

  const { mutateAsync: create, isLoading: creating } = useCreate();
  const { mutateAsync: update, isLoading: updating } = useUpdate();

  const onSubmit = async (values: IntakeForm) => {
    if (mode === "edit" && id) {
      await update({ resource: "students", id, values, successNotification: false });
      navigate(`/students/${id}`);
    } else {
      const res = await create({
        resource: "students",
        values: { ...values, consent_given_at: new Date().toISOString() },
        successNotification: false,
      });
      const newId = (res as any)?.data?.id;
      navigate(newId ? `/students/${newId}/matches` : "/students");
    }
  };

  const onInvalid = () => {
    // jump to the first step that has an error
    const errs = formState.errors as Record<string, unknown>;
    const idx = STEP_FIELDS.findIndex((fields) => fields.some((f) => f.split(".")[0] in errs));
    if (idx >= 0) setActive(idx);
  };

  const steps = useMemo(
    () => [
      <PersonalStep key="p" control={control} />,
      <AcademicStep key="a" control={control} />,
      <EnglishStep key="e" control={control} />,
      <WorkStep key="w" control={control} />,
      <CareerStep key="c" control={control} />,
      <FinanceStep key="f" control={control} />,
      <SponsorStep key="s" control={control} />,
      <DestinationStep key="d" control={control} />,
      <PreferencesStep key="pr" control={control} />,
      <VisaStep key="v" control={control} />,
    ],
    [control],
  );

  const last = active === steps.length - 1;
  const busy = creating || updating;

  const next = async () => {
    const ok = await trigger(STEP_FIELDS[active] as any);
    if (ok) setActive((s) => Math.min(s + 1, steps.length - 1));
  };

  if (mode === "edit" && isLoading) {
    return <Typography sx={{ p: 4 }}>Loading student…</Typography>;
  }

  const studentName = existing?.data?.full_name;
  const cancelHref = mode === "edit" && id ? `/students/${id}` : "/students";
  const crumbs =
    mode === "edit" && id
      ? [
          { label: "Students", href: "/students" },
          { label: studentName ?? "Student", href: `/students/${id}` },
          { label: "Edit intake" },
        ]
      : [{ label: "Students", href: "/students" }, { label: "New intake" }];

  const pct = Math.round(((active + 1) / STEP_LABELS.length) * 100);

  return (
    <RefineCreateView
      title={mode === "edit" ? `Edit intake${studentName ? ` — ${studentName}` : ""}` : "New student intake"}
      breadcrumb={<AppBreadcrumbs items={crumbs} />}
      headerButtons={
        <Button startIcon={<CloseIcon />} onClick={() => navigate(cancelHref)}>
          Cancel
        </Button>
      }
      footerButtons={<></>}
      goBack={false}
    >
      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        noValidate
        sx={{ maxWidth: 940, mx: "auto", p: { xs: 1, sm: 2 } }}
      >
        <Stepper activeStep={active} alternativeLabel nonLinear sx={{ mb: 1, flexWrap: "wrap", rowGap: 1 }}>
          {STEP_LABELS.map((label, i) => (
            <Step key={label} completed={i < active}>
              <StepButton onClick={() => setActive(i)}>{label}</StepButton>
            </Step>
          ))}
        </Stepper>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mb: 2.5 }}>
          Step {active + 1} of {STEP_LABELS.length} · {pct}% complete
        </Typography>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            {STEP_LABELS[active]}
          </Typography>
          {steps[active]}
        </Paper>

        <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
          <Button disabled={active === 0} onClick={() => setActive((s) => s - 1)}>
            Back
          </Button>
          <Stack direction="row" spacing={1}>
            <Button color="inherit" onClick={() => navigate(cancelHref)}>
              Cancel
            </Button>
            {!last && (
              <Button variant="outlined" onClick={next}>
                Next
              </Button>
            )}
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Create & run match"}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </RefineCreateView>
  );
}

// ---------------------------------------------------------------------------
// which fields each step "owns" (for per-step validation + error routing)
// ---------------------------------------------------------------------------
const STEP_FIELDS: string[][] = [
  ["full_name", "date_of_birth", "nationality", "current_city"],
  ["academic"],
  ["language_tests"],
  ["work"],
  ["career_goal.target_occupation", "career_goal.intended_field"],
  ["finance"],
  ["sponsors"],
  ["preferences.preferred_countries"],
  ["preferences.degree_level", "preferences.field", "preferences.max_tuition_per_year"],
  ["visa_history"],
];

// ---------------------------------------------------------------------------
// layout helpers
// ---------------------------------------------------------------------------
type SP = { control: Control<IntakeForm> };

const Row = ({ children }: { children: React.ReactNode }) => (
  <Grid container spacing={2} columnSpacing={2}>
    {children}
  </Grid>
);
const Half = ({ children }: { children: React.ReactNode }) => <Grid size={{ xs: 12, sm: 6 }}>{children}</Grid>;
const Third = ({ children }: { children: React.ReactNode }) => (
  <Grid size={{ xs: 12, sm: 6, md: 4 }}>{children}</Grid>
);
const Full = ({ children }: { children: React.ReactNode }) => <Grid size={12}>{children}</Grid>;

function ArrayCard({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        {onRemove && (
          <IconButton size="small" onClick={onRemove} aria-label={`Remove ${title}`}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
      <Row>{children}</Row>
    </Paper>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button startIcon={<AddIcon />} onClick={onClick} sx={{ mt: 0.5 }}>
      {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// steps
// ---------------------------------------------------------------------------

function PersonalStep({ control }: SP) {
  const deps = useFieldArray({ control, name: "dependants" });
  return (
    <>
      <StepIntro>Who the student is. Name and country of citizenship feed eligibility and visa checks.</StepIntro>
      <Row>
        <Half><Text control={control} name="full_name" label="Full name" required /></Half>
        <Half><DateField control={control} name="date_of_birth" label="Date of birth" required helper="Used for age-based visa rules" /></Half>
        <Third><Select control={control} name="gender" label="Gender" options={["male", "female", "other"]} /></Third>
        <Third><Text control={control} name="nationality" label="Nationality" required /></Third>
        <Third><Text control={control} name="current_city" label="Current city" /></Third>
        <Third><Select control={control} name="passport_status" label="Passport" options={["none", "applied", "held"]} /></Third>
        <Third><Select control={control} name="marital_status" label="Marital status" options={["single", "married"]} /></Third>
        <Third><Select control={control} name="counsellor" label="Counsellor" options={["Bina Rai", "Suman K.C."]} /></Third>
      </Row>

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        Dependants
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Family members who would apply on the student's visa. Anyone marked "travelling with the
        student" raises the visa financial-capacity requirement and the affordability check.
      </Typography>
      {deps.fields.length === 0 && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 2, textAlign: "center", color: "text.secondary" }}>
          <Typography variant="body2">No dependants — applying alone.</Typography>
        </Paper>
      )}
      {deps.fields.map((f, i) => (
        <ArrayCard key={f.id} title={`Dependant ${i + 1}`} onRemove={() => deps.remove(i)}>
          <Third>
            <Select
              control={control}
              name={`dependants.${i}.relationship`}
              label="Relationship"
              options={["spouse", "child", "parent", "other"]}
            />
          </Third>
          <Third><Text control={control} name={`dependants.${i}.full_name`} label="Full name" /></Third>
          <Third><DateField control={control} name={`dependants.${i}.date_of_birth`} label="Date of birth" /></Third>
          <Third>
            <Select
              control={control}
              name={`dependants.${i}.passport_status`}
              label="Passport"
              options={["none", "applied", "held"]}
            />
          </Third>
          <Half><Toggle control={control} name={`dependants.${i}.accompanying`} label="Travelling with the student" /></Half>
        </ArrayCard>
      ))}
      <AddButton
        label="Add dependant"
        onClick={() =>
          deps.append({
            id: `dep-${Date.now()}`,
            relationship: "spouse",
            full_name: "",
            date_of_birth: "",
            accompanying: true,
            passport_status: "none",
          })
        }
      />
    </>
  );
}

function AcademicStep({ control }: SP) {
  const fa = useFieldArray({ control, name: "academic" });
  return (
    <>
      <StepIntro>Every qualification. The highest one drives the academic-fit score, so GPA and its scale matter.</StepIntro>
      {fa.fields.map((f, i) => (
        <ArrayCard key={f.id} title={`Qualification ${i + 1}`} onRemove={fa.fields.length > 1 ? () => fa.remove(i) : undefined}>
          <Half><Select control={control} name={`academic.${i}.level`} label="Level" options={["High School", "Bachelor", "PG Diploma", "Master", "PhD"]} /></Half>
          <Half><Text control={control} name={`academic.${i}.course`} label="Course / major" /></Half>
          <Half><Text control={control} name={`academic.${i}.institution`} label="Institution" /></Half>
          <Third><Text control={control} name={`academic.${i}.country`} label="Country" /></Third>
          <Third><Num control={control} name={`academic.${i}.end_year`} label="Completion year" /></Third>
          <Grid size={{ xs: 6, sm: 3 }}><Num control={control} name={`academic.${i}.gpa_value`} label="GPA / %" required /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><Select control={control} name={`academic.${i}.gpa_scale`} label="Scale" options={["4.0", "10.0", "percentage", "division"]} /></Grid>
          <Third><Num control={control} name={`academic.${i}.gap_months`} label="Study gap (months)" min={0} /></Third>
        </ArrayCard>
      ))}
      <AddButton label="Add qualification" onClick={() => fa.append({ ...emptyIntake().academic[0], id: `ac-${Date.now()}` })} />
    </>
  );
}

function EnglishStep({ control }: SP) {
  const fa = useFieldArray({ control, name: "language_tests" });
  return (
    <>
      <StepIntro>English test results, if any. No test is fine — it's flagged and the engine assumes an entry-level score.</StepIntro>
      {fa.fields.length === 0 && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 2, textAlign: "center", color: "text.secondary" }}>
          <Typography variant="body2">No English test recorded yet.</Typography>
        </Paper>
      )}
      {fa.fields.map((f, i) => (
        <ArrayCard key={f.id} title={`Test ${i + 1}`} onRemove={() => fa.remove(i)}>
          <Third><Select control={control} name={`language_tests.${i}.test`} label="Test" options={["IELTS", "PTE", "TOEFL", "Duolingo"]} /></Third>
          <Third><Num control={control} name={`language_tests.${i}.overall`} label="Overall band" step={0.5} /></Third>
          <Third><DateField control={control} name={`language_tests.${i}.test_date`} label="Test date" /></Third>
        </ArrayCard>
      ))}
      <AddButton label="Add test" onClick={() => fa.append({ id: `lt-${Date.now()}`, test: "IELTS", overall: 6.5, test_date: "" })} />
    </>
  );
}

function WorkStep({ control }: SP) {
  const fa = useFieldArray({ control, name: "work" });
  return (
    <>
      <StepIntro>Paid work history. Mark whichever roles are relevant to the intended field — that's what counts toward experience.</StepIntro>
      {fa.fields.length === 0 && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 2, textAlign: "center", color: "text.secondary" }}>
          <Typography variant="body2">No work experience added.</Typography>
        </Paper>
      )}
      {fa.fields.map((f, i) => (
        <ArrayCard key={f.id} title={`Job ${i + 1}`} onRemove={() => fa.remove(i)}>
          <Half><Text control={control} name={`work.${i}.title`} label="Job title" /></Half>
          <Half><Text control={control} name={`work.${i}.employer`} label="Employer" /></Half>
          <Third><Text control={control} name={`work.${i}.industry`} label="Industry" /></Third>
          <Third><DateField control={control} name={`work.${i}.start_date`} label="Start date" /></Third>
          <Third><DateField control={control} name={`work.${i}.end_date`} label="End date" helper="Leave blank if current" /></Third>
          <Half><Toggle control={control} name={`work.${i}.full_time`} label="Full-time" /></Half>
          <Half><Toggle control={control} name={`work.${i}.relevant`} label="Relevant to the intended field" /></Half>
        </ArrayCard>
      ))}
      <AddButton
        label="Add job"
        onClick={() =>
          fa.append({
            id: `wk-${Date.now()}`,
            title: "",
            employer: "",
            industry: "",
            country: "Nepal",
            start_date: "",
            end_date: null,
            full_time: true,
            relevant: true,
          })
        }
      />
    </>
  );
}

function CareerStep({ control }: SP) {
  return (
    <>
      <StepIntro>What the student is aiming for after study. Field alignment and degree level here shape the career-fit score.</StepIntro>
      <Row>
        <Half><Text control={control} name="career_goal.target_occupation" label="Target occupation" /></Half>
        <Half><Text control={control} name="career_goal.target_industry" label="Target industry" /></Half>
        <Half><Text control={control} name="career_goal.intended_field" label="Intended field of study" /></Half>
        <Third><Select control={control} name="career_goal.long_term" label="Long-term goal" options={["employment", "PR", "return home", "business", "further study"]} /></Third>
        <Third><Toggle control={control} name="career_goal.change_field" label="Changing career field" /></Third>
        <Full><Text control={control} name="career_goal.reason" label="Why this course?" multiline={3} /></Full>
      </Row>
    </>
  );
}

function MoneyRow({ control, base }: { control: Control<IntakeForm>; base: string; }) {
  return (
    <>
      <Grid size={{ xs: 8, sm: 5 }}><Num control={control} name={`${base}.amount`} label="Amount / year" /></Grid>
      <Grid size={{ xs: 4, sm: 3 }}><Select control={control} name={`${base}.currency`} label="Currency" options={CURRENCIES} /></Grid>
    </>
  );
}

function FinanceStep({ control }: SP) {
  const income = useFieldArray({ control, name: "finance.income_sources" });
  const assets = useFieldArray({ control, name: "finance.assets" });
  const liab = useFieldArray({ control, name: "finance.liabilities" });
  return (
    <>
      <StepIntro>Family funds available for study. All amounts are normalised to a common currency for the affordability score.</StepIntro>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Income sources</Typography>
      {income.fields.map((f, i) => (
        <ArrayCard key={f.id} title={`Income ${i + 1}`} onRemove={income.fields.length > 1 ? () => income.remove(i) : undefined}>
          <Grid size={{ xs: 12, sm: 4 }}><Select control={control} name={`finance.income_sources.${i}.kind`} label="Source" options={["father", "mother", "spouse", "self", "business", "rental", "other"]} /></Grid>
          <MoneyRow control={control} base={`finance.income_sources.${i}`} />
          <Full><Toggle control={control} name={`finance.income_sources.${i}.evidence`} label="Documentary evidence available" /></Full>
        </ArrayCard>
      ))}
      <AddButton label="Add income source" onClick={() => income.append({ id: `in-${Date.now()}`, kind: "other", amount: 0, currency: "NPR", evidence: false })} />

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Assets &amp; available funds</Typography>
      {assets.fields.map((f, i) => (
        <ArrayCard key={f.id} title={`Asset ${i + 1}`} onRemove={assets.fields.length > 1 ? () => assets.remove(i) : undefined}>
          <Grid size={{ xs: 12, sm: 4 }}><Select control={control} name={`finance.assets.${i}.kind`} label="Type" options={["bank savings", "fixed deposit", "education loan", "property", "sponsor", "other"]} /></Grid>
          <MoneyRow control={control} base={`finance.assets.${i}`} />
          <Full><Toggle control={control} name={`finance.assets.${i}.liquid`} label="Liquid (available at short notice)" /></Full>
        </ArrayCard>
      ))}
      <AddButton label="Add asset" onClick={() => assets.append({ id: `as-${Date.now()}`, kind: "bank savings", amount: 0, currency: "NPR", liquid: true })} />

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Liabilities</Typography>
      {liab.fields.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>None recorded.</Typography>
      )}
      {liab.fields.map((f, i) => (
        <ArrayCard key={f.id} title={`Liability ${i + 1}`} onRemove={() => liab.remove(i)}>
          <Half><Text control={control} name={`finance.liabilities.${i}.kind`} label="Description" /></Half>
          <Grid size={{ xs: 6, sm: 3 }}><Num control={control} name={`finance.liabilities.${i}.amount`} label="Balance" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><Num control={control} name={`finance.liabilities.${i}.monthly_repayment`} label="Monthly repayment" /></Grid>
        </ArrayCard>
      ))}
      <AddButton label="Add liability" onClick={() => liab.append({ id: `li-${Date.now()}`, kind: "", amount: 0, currency: "NPR", monthly_repayment: 0 })} />
    </>
  );
}

function SponsorStep({ control }: SP) {
  const fa = useFieldArray({ control, name: "sponsors" });
  return (
    <>
      <StepIntro>Whoever is funding the study, and their capacity to do so.</StepIntro>
      {fa.fields.map((f, i) => (
        <ArrayCard key={f.id} title={`Sponsor ${i + 1}`} onRemove={fa.fields.length > 1 ? () => fa.remove(i) : undefined}>
          <Half><Text control={control} name={`sponsors.${i}.relationship`} label="Relationship" /></Half>
          <Half><Text control={control} name={`sponsors.${i}.occupation`} label="Occupation" /></Half>
          <MoneyRow control={control} base={`sponsors.${i}`} />
          <Grid size={{ xs: 12, sm: 4 }}>
            <Text control={control} name={`sponsors.${i}.annual_income`} label="Annual income" />
          </Grid>
          <Full><Toggle control={control} name={`sponsors.${i}.evidence`} label="Documentary evidence available" /></Full>
        </ArrayCard>
      ))}
      <AddButton label="Add sponsor" onClick={() => fa.append({ id: `sp-${Date.now()}`, relationship: "", occupation: "", annual_income: 0, currency: "NPR", evidence: false })} />
    </>
  );
}

function DestinationStep({ control }: SP) {
  return (
    <>
      <StepIntro>Where and how the student wants to study. These shape the location score and filter the shortlist.</StepIntro>
      <Row>
        <Full><MultiSelect control={control} name="preferences.preferred_countries" label="Preferred countries" options={COUNTRIES} required /></Full>
        <Third><Select control={control} name="preferences.city_size" label="City size" options={["big", "small", "either"]} /></Third>
        <Third><Select control={control} name="preferences.cost_sensitivity" label="Cost sensitivity" options={["low", "high"]} /></Third>
        <Third><Toggle control={control} name="preferences.part_time_work_important" label="Part-time work matters" /></Third>
      </Row>
    </>
  );
}

function PreferencesStep({ control }: SP) {
  return (
    <>
      <StepIntro>What the student is looking for in a course. Budget and level are hard filters; the rest are ranking signals.</StepIntro>
      <Row>
        <Third><Select control={control} name="preferences.degree_level" label="Degree level" options={DEGREE_LEVELS} required /></Third>
        <Third><Text control={control} name="preferences.field" label="Preferred field" /></Third>
        <Third><Text control={control} name="preferences.intake" label="Preferred intake" /></Third>
        <Half><Num control={control} name="preferences.max_tuition_per_year" label="Max tuition / year" required adornment="A$" /></Half>
        <Grid size={{ xs: 12, sm: 3 }}><Select control={control} name="preferences.tuition_currency" label="Currency" options={CURRENCIES} /></Grid>
        <Grid size={{ xs: 12, sm: 3 }}><Num control={control} name="preferences.min_scholarship_pct" label="Min scholarship %" min={0} max={100} /></Grid>
        <Half><Toggle control={control} name="preferences.scholarship_required" label="Scholarship required" /></Half>
        <Half><Toggle control={control} name="preferences.ranking_matters" label="University ranking matters" /></Half>
      </Row>
    </>
  );
}

function VisaStep({ control }: SP) {
  const fa = useFieldArray({ control, name: "visa_history" });
  return (
    <>
      <StepIntro>
        Previous visa applications for any country. Recorded for the counsellor and the visa-risk view only — this never
        affects the academic match score.
      </StepIntro>
      {fa.fields.length === 0 && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 2, textAlign: "center", color: "text.secondary" }}>
          <Typography variant="body2">No previous visa applications.</Typography>
        </Paper>
      )}
      {fa.fields.map((f, i) => (
        <ArrayCard key={f.id} title={`Visa record ${i + 1}`} onRemove={() => fa.remove(i)}>
          <Third><Text control={control} name={`visa_history.${i}.country`} label="Country" /></Third>
          <Third><Text control={control} name={`visa_history.${i}.visa_type`} label="Visa type" /></Third>
          <Grid size={{ xs: 6, sm: 6, md: 2 }}><Select control={control} name={`visa_history.${i}.outcome`} label="Outcome" options={["granted", "refused", "withdrawn"]} /></Grid>
          <Grid size={{ xs: 6, sm: 6, md: 2 }}><DateField control={control} name={`visa_history.${i}.decision_date`} label="Decision date" /></Grid>
          <Full><Text control={control} name={`visa_history.${i}.refusal_reason`} label="Refusal reason (if any)" multiline={2} /></Full>
        </ArrayCard>
      ))}
      <AddButton
        label="Add visa record"
        onClick={() => fa.append({ id: `vh-${Date.now()}`, country: "", visa_type: "", outcome: "granted", decision_date: "", refusal_reason: "" })}
      />
    </>
  );
}

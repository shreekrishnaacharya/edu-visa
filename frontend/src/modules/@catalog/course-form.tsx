import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { useCreate, useUpdate, useOne, useList } from "@refinedev/core";
import { Box, Button, Grid2 as Grid, IconButton, Paper, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";

import { RefineCreateView } from "@components/view/create";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import { Text, Num, Select, MultiSelect } from "@components/form/fields";
import type { Course, University } from "@mocks/types";

type Props = { mode: "create" | "edit" };

const DEGREE_LEVELS = ["Bachelor", "PG Diploma", "Master", "PhD"];
const CURRENCIES = ["NPR", "AUD", "GBP", "CAD", "USD"];
const INTAKE_MONTHS = ["Feb", "Mar", "Jun", "Jul", "Sep", "Nov"];

interface ScholarshipForm {
  id: string;
  name: string;
  pct: number;
  criteria: string;
  min_gpa: number;
}

interface CourseForm {
  university_id: string;
  university_name: string;
  country: string;
  city: string;
  world_rank: number;
  title: string;
  degree_level: string;
  field: string;
  duration_months: number;
  tuition_fee: number;
  currency: string;
  intakes: string[];
  next_intake_date: string;
  application_deadline: string;
  cricos: string;
  entry: {
    min_gpa: number;
    min_english_band: number;
    work_experience_months: number;
    prerequisites: string; // comma-separated in the form, split on submit
  };
  career_outcomes: string; // comma-separated in the form, split on submit
  scholarships: ScholarshipForm[];
}

const emptyCourse = (): CourseForm => ({
  university_id: "",
  university_name: "",
  country: "",
  city: "",
  world_rank: 999,
  title: "",
  degree_level: "Master",
  field: "",
  duration_months: 24,
  tuition_fee: 30000,
  currency: "AUD",
  intakes: ["Feb", "Jul"],
  next_intake_date: "",
  application_deadline: "",
  cricos: "",
  entry: { min_gpa: 50, min_english_band: 6, work_experience_months: 0, prerequisites: "" },
  career_outcomes: "",
  scholarships: [],
});

export function CourseFormPage({ mode }: Props) {
  const navigate = useNavigate();
  const { id } = useParams();

  const { data: existing, isLoading } = useOne<Course>({
    resource: "courses",
    id: id ?? "",
    queryOptions: { enabled: mode === "edit" && Boolean(id), retry: 0 },
  });

  const { data: uniData } = useList<University>({
    resource: "universities",
    pagination: { pageSize: 500 },
    sorters: [{ field: "name", order: "asc" }],
  });
  const universities = uniData?.data ?? [];

  const { control, handleSubmit, reset, setValue, watch } = useForm<CourseForm>({
    defaultValues: emptyCourse(),
  });

  useEffect(() => {
    if (mode === "edit" && existing?.data) {
      const c = existing.data;
      reset({
        university_id: c.university_id,
        university_name: c.university_name,
        country: c.country,
        city: c.city,
        world_rank: c.world_rank,
        title: c.title,
        degree_level: c.degree_level,
        field: c.field,
        duration_months: c.duration_months,
        tuition_fee: c.tuition_fee,
        currency: c.currency,
        intakes: c.intakes,
        next_intake_date: c.next_intake_date,
        application_deadline: c.application_deadline,
        cricos: c.cricos ?? "",
        entry: {
          min_gpa: c.entry.min_gpa,
          min_english_band: c.entry.min_english_band,
          work_experience_months: c.entry.work_experience_months,
          prerequisites: c.entry.prerequisites.join(", "),
        },
        career_outcomes: c.career_outcomes.join(", "),
        scholarships: c.scholarships.map((s) => ({ id: s.id, name: s.name, pct: s.pct, criteria: s.criteria, min_gpa: s.min_gpa })),
      });
    }
  }, [existing, mode, reset]);

  // Country/city/world_rank/university_name are denormalised FROM the
  // university, not independently editable — keeps the catalogue's grid
  // columns (and the deterministic engine's location scoring) honest with
  // whatever the university record actually says.
  const universityId = watch("university_id");
  useEffect(() => {
    const uni = universities.find((u) => u.id === universityId);
    if (uni) {
      setValue("university_name", uni.name);
      setValue("country", uni.country);
      setValue("city", uni.city);
      setValue("world_rank", uni.world_rank);
    }
  }, [universityId, universities, setValue]);

  const fa = useFieldArray({ control, name: "scholarships" });

  const { mutateAsync: create, isLoading: creating } = useCreate();
  const { mutateAsync: update, isLoading: updating } = useUpdate();
  const busy = creating || updating;

  const onSubmit = async (values: CourseForm) => {
    const payload = {
      ...values,
      entry: {
        min_gpa: values.entry.min_gpa,
        min_english_band: values.entry.min_english_band,
        work_experience_months: values.entry.work_experience_months,
        accepted_tests: ["IELTS", "PTE", "TOEFL"],
        prerequisites: values.entry.prerequisites.split(",").map((s) => s.trim()).filter(Boolean),
      },
      career_outcomes: values.career_outcomes.split(",").map((s) => s.trim()).filter(Boolean),
      scholarships: values.scholarships.map((s) => ({ name: s.name, pct: Number(s.pct), criteria: s.criteria, min_gpa: Number(s.min_gpa) })),
    };
    if (mode === "edit" && id) {
      await update({ resource: "courses", id, values: payload, successNotification: false });
      navigate("/catalogue");
    } else {
      await create({ resource: "courses", values: payload, successNotification: false });
      navigate("/catalogue");
    }
  };

  const uniOptions = useMemo(() => universities.map((u) => ({ value: u.id, label: `${u.name} (${u.country})` })), [universities]);

  if (mode === "edit" && isLoading) {
    return <Typography sx={{ p: 4 }}>Loading course…</Typography>;
  }

  return (
    <RefineCreateView
      title={mode === "edit" ? "Edit course" : "New course"}
      breadcrumb={
        <AppBreadcrumbs
          items={[{ label: "Course catalogue", href: "/catalogue" }, { label: mode === "edit" ? "Edit" : "New course" }]}
        />
      }
      headerButtons={
        <Button startIcon={<CloseIcon />} onClick={() => navigate("/catalogue")}>
          Cancel
        </Button>
      }
      footerButtons={<></>}
      goBack={false}
    >
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ maxWidth: 900, mx: "auto", p: { xs: 1, sm: 2 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Course details
          </Typography>
          <Grid container spacing={2}>
            <Grid size={12}>
              <Select<CourseForm> control={control} name="university_id" label="University" required options={uniOptions} />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <Text<CourseForm> control={control} name="title" label="Course title" required />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Select<CourseForm> control={control} name="degree_level" label="Degree level" required options={DEGREE_LEVELS} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Text<CourseForm> control={control} name="field" label="Field" required helper="e.g. Information Technology" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Num<CourseForm> control={control} name="duration_months" label="Duration (months)" required min={1} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Text<CourseForm> control={control} name="cricos" label="CRICOS code" helper="Required for AU courses" />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Num<CourseForm> control={control} name="tuition_fee" label="Tuition / year" required adornment="A$" />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Select<CourseForm> control={control} name="currency" label="Currency" options={CURRENCIES} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <MultiSelect<CourseForm> control={control} name="intakes" label="Intake months" options={INTAKE_MONTHS} />
            </Grid>
            <Grid size={{ xs: 6, sm: 6 }}>
              <Text<CourseForm> control={control} name="next_intake_date" label="Next intake date" type="date" />
            </Grid>
            <Grid size={{ xs: 6, sm: 6 }}>
              <Text<CourseForm> control={control} name="application_deadline" label="Application deadline" type="date" />
            </Grid>
          </Grid>

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
            University-derived (read from the selected university, not independently editable): {watch("university_name") || "—"} ·{" "}
            {watch("city") || "—"}, {watch("country") || "—"} · world rank {watch("world_rank")}
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Entry requirements
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Num<CourseForm> control={control} name="entry.min_gpa" label="Min GPA (canonical /100)" required min={0} max={100} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Num<CourseForm> control={control} name="entry.min_english_band" label="Min English (IELTS-eq.)" required min={0} max={9} step={0.5} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Num<CourseForm> control={control} name="entry.work_experience_months" label="Work experience required (months)" min={0} />
            </Grid>
            <Grid size={12}>
              <Text<CourseForm> control={control} name="entry.prerequisites" label="Prerequisites" helper="Comma-separated — e.g. Statistics, Programming" />
            </Grid>
            <Grid size={12}>
              <Text<CourseForm> control={control} name="career_outcomes" label="Career outcomes" helper="Comma-separated" />
            </Grid>
          </Grid>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Scholarships</Typography>
          </Stack>
          <Stack spacing={2}>
            {fa.fields.map((f, i) => (
              <Paper key={f.id} variant="outlined" sx={{ p: 2, borderRadius: 2, position: "relative" }}>
                <IconButton size="small" onClick={() => fa.remove(i)} sx={{ position: "absolute", right: 8, top: 8 }}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Text<CourseForm> control={control} name={`scholarships.${i}.name`} label="Name" required />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Num<CourseForm> control={control} name={`scholarships.${i}.pct`} label="% of tuition" adornment="%" />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Num<CourseForm> control={control} name={`scholarships.${i}.min_gpa`} label="Min GPA (/100)" />
                  </Grid>
                  <Grid size={12}>
                    <Text<CourseForm> control={control} name={`scholarships.${i}.criteria`} label="Criteria" />
                  </Grid>
                </Grid>
              </Paper>
            ))}
          </Stack>
          <Button
            startIcon={<AddIcon />}
            sx={{ mt: 1.5 }}
            onClick={() => fa.append({ id: `sch-${Date.now()}`, name: "", pct: 15, criteria: "", min_gpa: 60 })}
          >
            Add scholarship
          </Button>
        </Paper>

        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button color="inherit" onClick={() => navigate("/catalogue")}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Create course"}
          </Button>
        </Stack>
      </Box>
    </RefineCreateView>
  );
}

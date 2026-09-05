import { useMemo, useState } from "react";
import { type HttpError } from "@refinedev/core";
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid2 as Grid,
  IconButton,
  MenuItem,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import { RefineListView } from "@components/view/list";
import { TableGrid } from "@components/table/table.body";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import { Monogram } from "@components/other/monogram";
import { LabelData } from "@components/other/label.data";
import { useRefineDataGrid } from "@hooks/useDataGrid";
import type { Course } from "@mocks/types";

const LEVELS = ["Bachelor", "PG Diploma", "Master", "PhD"];
const COUNTRIES = ["AU", "NZ", "UK", "CA", "US"];

export function CatalogueListPage() {
  const [country, setCountry] = useState("");
  const [level, setLevel] = useState("");
  const [field, setField] = useState("");
  // Real CRICOS catalogue fees range ~$12k (Bachelor) to ~$160k/yr (Medicine/
  // Dentistry) — default the ceiling above the real max so the list isn't
  // silently pre-filtered before the user touches the slider.
  const [maxFee, setMaxFee] = useState(170000);
  const [selected, setSelected] = useState<Course | null>(null);

  const { dataGridProps, setFilters } = useRefineDataGrid<Course, HttpError>({
    resource: "courses",
    sorters: { initial: [{ field: "world_rank", order: "asc" }] },
    pagination: { pageSize: 25 },
  });

  const apply = (patch?: Partial<{ country: string; level: string; field: string; maxFee: number }>) => {
    const c = patch?.country ?? country;
    const l = patch?.level ?? level;
    const f = patch?.field ?? field;
    const m = patch?.maxFee ?? maxFee;
    setFilters([
      { field: "country", operator: "eq", value: c || undefined },
      { field: "degree_level", operator: "eq", value: l || undefined },
      { field: "field", operator: "contains", value: f || undefined },
      { field: "tuition_fee", operator: "lte", value: m },
    ]);
  };

  const columns = useMemo(
    () => [
      {
        field: "title",
        headerName: "Course",
        minWidth: 240,
        flex: 1.5,
        renderCell: ({ row }: any) => (
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ py: 0.5 }}>
            <Monogram name={row.university_name} variant="rounded" sx={{ width: 30, height: 30, fontSize: 12 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                {row.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {row.university_name}
              </Typography>
            </Box>
          </Stack>
        ),
      },
      {
        field: "country",
        headerName: "Location",
        width: 130,
        renderCell: ({ row }: any) => <Chip size="small" variant="outlined" label={`${row.country} · ${row.city}`} />,
      },
      { field: "degree_level", headerName: "Level", width: 110 },
      {
        field: "tuition_fee",
        headerName: "Tuition/yr",
        width: 120,
        renderCell: ({ row }: any) => `A$ ${row.tuition_fee.toLocaleString()}`,
      },
      {
        field: "entry",
        headerName: "GPA / IELTS",
        width: 120,
        sortable: false,
        renderCell: ({ row }: any) => `${row.entry.min_gpa} / ${row.entry.min_english_band}`,
      },
      { field: "world_rank", headerName: "Rank", width: 75 },
      { field: "next_intake_date", headerName: "Next intake", width: 120 },
    ],
    [],
  );

  return (
    <RefineListView
      resource="courses"
      title="Course catalogue"
      breadcrumb={<AppBreadcrumbs items={[{ label: "Course catalogue" }]} />}
    >
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
            <TextField size="small" select label="Country" value={country} sx={{ minWidth: 130 }}
              onChange={(e) => { setCountry(e.target.value); apply({ country: e.target.value }); }}>
              <MenuItem value="">Any</MenuItem>
              {COUNTRIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField size="small" select label="Level" value={level} sx={{ minWidth: 140 }}
              onChange={(e) => { setLevel(e.target.value); apply({ level: e.target.value }); }}>
              <MenuItem value="">Any</MenuItem>
              {LEVELS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </TextField>
            <TextField size="small" label="Field contains" value={field}
              onChange={(e) => setField(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apply()} />
            <Box sx={{ minWidth: 230, px: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Max tuition/yr · A$ {maxFee.toLocaleString()}
              </Typography>
              <Slider size="small" min={10000} max={170000} step={2500} value={maxFee}
                onChange={(_, v) => setMaxFee(v as number)}
                onChangeCommitted={(_, v) => apply({ maxFee: v as number })} />
            </Box>
          </Stack>
        </Paper>
      </Box>

      <Box
        sx={{
          px: 2,
          pb: 2,
          "& .MuiDataGrid-row": { cursor: "pointer", minHeight: "48px !important" },
          "& .MuiDataGrid-cell": { display: "flex", alignItems: "center", maxHeight: "none !important", py: 0.75 },
        }}
      >
        <TableGrid
          {...dataGridProps}
          columns={columns}
          serial
          autoHeight
          disableColumnMenu
          getRowHeight={() => "auto"}
          onRowClick={(p: any) => setSelected(p.row as Course)}
        />
      </Box>

      <CourseDialog course={selected} onClose={() => setSelected(null)} />
    </RefineListView>
  );
}

function CourseDialog({ course, onClose }: { course: Course | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(course)} onClose={onClose} maxWidth="sm" fullWidth>
      {course && (
        <>
          <DialogTitle sx={{ pr: 6 }}>
            {course.title}
            <Typography variant="body2" color="text.secondary">
              {course.university_name} · {course.city}, {course.country} · CRICOS {course.cricos}
            </Typography>
            <IconButton onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Grid container rowSpacing={0.75} columnSpacing={2}>
              <Grid size={6}><LabelData label="Level" value={course.degree_level} /></Grid>
              <Grid size={6}><LabelData label="Field" value={course.field} /></Grid>
              <Grid size={6}><LabelData label="Duration" value={`${course.duration_months} months`} /></Grid>
              <Grid size={6}><LabelData label="Tuition / yr" value={`A$ ${course.tuition_fee.toLocaleString()}`} /></Grid>
              <Grid size={6}><LabelData label="Intakes" value={course.intakes.join(", ")} /></Grid>
              <Grid size={6}><LabelData label="Next intake" value={course.next_intake_date} /></Grid>
              <Grid size={6}><LabelData label="Deadline" value={course.application_deadline} /></Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Entry requirements</Typography>
            <Grid container rowSpacing={0.75} columnSpacing={2}>
              <Grid size={6}><LabelData label="Min GPA (/100)" value={course.entry.min_gpa} /></Grid>
              <Grid size={6}><LabelData label="Min English (IELTS)" value={course.entry.min_english_band} /></Grid>
              <Grid size={6}><LabelData label="Accepted tests" value={course.entry.accepted_tests.join(", ")} /></Grid>
              <Grid size={6}><LabelData label="Work experience" value={course.entry.work_experience_months ? `${course.entry.work_experience_months} months` : "not required"} /></Grid>
              <Grid size={12}><LabelData label="Prerequisites" value={course.entry.prerequisites.join(", ") || "none"} /></Grid>
            </Grid>

            {course.scholarships.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Scholarships</Typography>
                <Stack spacing={1}>
                  {course.scholarships.map((sc) => (
                    <Paper key={sc.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{sc.name}</Typography>
                        <Chip size="small" label={`${sc.pct}% of tuition`} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {sc.criteria} · min GPA {sc.min_gpa}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Career outcomes</Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {course.career_outcomes.map((o) => <Chip key={o} size="small" variant="outlined" label={o} />)}
            </Stack>
          </DialogContent>
        </>
      )}
    </Dialog>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { type HttpError } from "@refinedev/core";
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import InsightsIcon from "@mui/icons-material/Insights";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { GridActionsCellItem } from "@mui/x-data-grid";

import { RefineListView } from "@components/view/list";
import { TableGrid } from "@components/table/table.body";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import { Monogram } from "@components/other/monogram";
import { useRefineDataGrid } from "@hooks/useDataGrid";
import type { Student, StudentProfile } from "@mocks/types";

// The list endpoint embeds the latest derived profile on every row
// (server/src/modules/student/student.controller.ts).
type StudentRow = Student & { profile?: StudentProfile | null };
const shortId = (id: string) => (id.length > 12 ? id.slice(0, 8) : id.toUpperCase());

const STATES = ["Enquiry", "Profiling", "Shortlisted", "Applied"];
const stateColor: Record<string, "default" | "info" | "warning" | "success"> = {
  Enquiry: "default",
  Profiling: "info",
  Shortlisted: "warning",
  Applied: "success",
};

export function StudentListPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");

  const { dataGridProps, setFilters } = useRefineDataGrid<StudentRow, HttpError>({
    resource: "students",
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
    pagination: { pageSize: 25 },
  });

  const applyFilters = () => {
    setFilters([
      { field: "full_name", operator: "contains", value: name || undefined },
      { field: "state", operator: "eq", value: state || undefined },
      { field: "preferences.preferred_countries", operator: "contains", value: country || undefined },
    ]);
  };

  // The server embeds the derived profile on each row.
  const rows: StudentRow[] = (dataGridProps.rows as StudentRow[]) ?? [];
  const derived = useMemo(() => {
    const m = new Map<string, StudentProfile | null | undefined>();
    rows.forEach((r) => m.set(r.id, r.profile));
    return m;
  }, [rows]);

  const columns = useMemo(
    () => [
      {
        field: "full_name",
        headerName: "Student",
        minWidth: 190,
        flex: 1,
        renderCell: ({ row }: { row: Student }) => (
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, py: 0.5 }}>
            <Monogram name={row.full_name} sx={{ width: 32, height: 32, fontSize: 13, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                {row.full_name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                {shortId(row.id)} · {row.current_city}
              </Typography>
            </Box>
          </Stack>
        ),
      },
      {
        field: "state",
        headerName: "Stage",
        width: 116,
        renderCell: ({ row }: { row: Student }) => (
          <Chip size="small" label={row.state} color={stateColor[row.state] ?? "default"} variant="outlined" />
        ),
      },
      {
        field: "gpa",
        headerName: "GPA",
        width: 84,
        sortable: false,
        renderCell: ({ row }: { row: Student }) => derived.get(row.id)?.canonical_gpa ?? "—",
      },
      {
        field: "english",
        headerName: "English",
        width: 118,
        sortable: false,
        renderCell: ({ row }: { row: Student }) => {
          const b = derived.get(row.id)?.english_band;
          return b == null ? <Chip size="small" color="warning" variant="outlined" label="no test" /> : `IELTS ${b}`;
        },
      },
      {
        field: "afford",
        headerName: "Afford",
        width: 84,
        sortable: false,
        renderCell: ({ row }: { row: Student }) => {
          const a = derived.get(row.id)?.affordability_score ?? 0;
          const c = a >= 80 ? "success" : a >= 55 ? "warning" : "error";
          return <Chip size="small" color={c} variant="outlined" label={a} />;
        },
      },
      { field: "counsellor", headerName: "Counsellor", width: 116 },
      {
        field: "actions",
        type: "actions",
        headerName: "",
        width: 108,
        getActions: ({ row }: { row: Student }) => [
          <GridActionsCellItem key="view" icon={<VisibilityOutlinedIcon />} label="Open profile" onClick={() => navigate(`/students/${row.id}`)} />,
          <GridActionsCellItem key="match" icon={<InsightsIcon />} label="Match report" onClick={() => navigate(`/students/${row.id}/matches`)} />,
          <GridActionsCellItem key="edit" icon={<EditOutlinedIcon />} label="Edit intake" showInMenu onClick={() => navigate(`/students/${row.id}/edit`)} />,
        ],
      },
    ],
    [navigate, derived],
  );

  return (
    <RefineListView
      resource="students"
      title="Students"
      breadcrumb={<AppBreadcrumbs items={[{ label: "Students" }]} />}
      headerButtons={
        <Button variant="contained" startIcon={<PersonAddAlt1Icon />} onClick={() => navigate("/students/new")}>
          New intake
        </Button>
      }
    >
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
            <TextField
              size="small"
              label="Search name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              sx={{ minWidth: 200 }}
            />
            <TextField size="small" select label="Stage" value={state} onChange={(e) => setState(e.target.value)} sx={{ minWidth: 150 }}>
              <MenuItem value="">Any</MenuItem>
              {STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            <TextField size="small" select label="Target country" value={country} onChange={(e) => setCountry(e.target.value)} sx={{ minWidth: 160 }}>
              <MenuItem value="">Any</MenuItem>
              {["AU", "NZ", "UK", "CA", "US"].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <Button variant="contained" onClick={applyFilters}>Filter</Button>
            <Box sx={{ flexGrow: 1 }} />
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
          onRowClick={(p: any) => navigate(`/students/${p.id}`)}
        />
      </Box>
    </RefineListView>
  );
}

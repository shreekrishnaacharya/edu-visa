import { useMemo } from "react";
import { useNavigate } from "react-router";
import { type HttpError, useCan, useDelete } from "@refinedev/core";
import { Box, Button, Chip, IconButton, Stack } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { RefineListView } from "@components/view/list";
import { TableGrid } from "@components/table/table.body";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import { Monogram } from "@components/other/monogram";
import { useRefineDataGrid } from "@hooks/useDataGrid";
import { computeUniversityGaps } from "@utils/university-data-gaps";
import type { University } from "@mocks/types";

export function UniversityListPage() {
  const navigate = useNavigate();
  const { data: canWrite } = useCan({ resource: "universities", action: "create" });
  const { mutate: remove } = useDelete();

  const { dataGridProps } = useRefineDataGrid<University, HttpError>({
    resource: "universities",
    sorters: { initial: [{ field: "name", order: "asc" }] },
    pagination: { pageSize: 25 },
  });

  const columns = useMemo(
    () => [
      {
        field: "name",
        headerName: "University",
        minWidth: 260,
        flex: 1.5,
        renderCell: ({ row }: any) => (
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ py: 0.5 }}>
            <Monogram name={row.name} hue={row.logo_hue} variant="rounded" sx={{ width: 30, height: 30, fontSize: 12 }} />
            <Box sx={{ fontWeight: 600 }}>{row.name}</Box>
          </Stack>
        ),
      },
      {
        field: "country",
        headerName: "Location",
        width: 150,
        renderCell: ({ row }: any) => <Chip size="small" variant="outlined" label={`${row.country} · ${row.city}`} />,
      },
      { field: "world_rank", headerName: "Rank", width: 90 },
      {
        field: "policy_key",
        headerName: "Admission policy",
        width: 160,
        renderCell: ({ row }: any) =>
          row.policy_key ? <Chip size="small" color="primary" variant="outlined" label={row.policy_key} /> : "—",
      },
      {
        field: "verified_at",
        headerName: "Verified",
        width: 130,
        renderCell: ({ row }: any) => (row.verified_at ? new Date(row.verified_at).toLocaleDateString() : "not verified"),
      },
      {
        field: "data_gaps",
        headerName: "Data gaps",
        width: 140,
        sortable: false,
        filterable: false,
        renderCell: ({ row }: any) => {
          const gaps = computeUniversityGaps(row);
          if (!gaps.length) return <Chip size="small" color="success" variant="outlined" label="Complete" />;
          const hasWarning = gaps.some((g) => g.severity === "warning");
          return (
            <Chip
              size="small"
              color={hasWarning ? "warning" : "default"}
              variant="outlined"
              label={`${gaps.length} gap${gaps.length > 1 ? "s" : ""}`}
              title={gaps.map((g) => g.label).join("\n")}
            />
          );
        },
      },
      ...(canWrite?.can
        ? [
            {
              field: "actions",
              headerName: "",
              width: 90,
              sortable: false,
              filterable: false,
              renderCell: ({ row }: any) => (
                <Stack direction="row" spacing={0.5} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <IconButton size="small" onClick={() => navigate(`/universities/${row.id}/edit`)}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (confirm(`Delete "${row.name}"? This also removes its courses.`))
                        remove({ resource: "universities", id: row.id, successNotification: false });
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ),
            },
          ]
        : []),
    ],
    [canWrite, navigate, remove],
  );

  return (
    <RefineListView
      resource="universities"
      title="Universities"
      breadcrumb={<AppBreadcrumbs items={[{ label: "Universities" }]} />}
      headerButtons={
        canWrite?.can ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/universities/new")}>
            New university
          </Button>
        ) : undefined
      }
    >
      <Box
        sx={{
          px: 2,
          pb: 2,
          pt: 2,
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
          onRowClick={(p: any) => navigate(`/universities/${p.row.id}`)}
        />
      </Box>
    </RefineListView>
  );
}

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Collapse,
  IconButton,
  Box,
  Paper,
} from "@mui/material";
import { KeyboardArrowDown, KeyboardArrowUp } from "@mui/icons-material";
import { useRefineDataGrid } from "@hooks/useDataGrid";
import React, { useState } from "react";
import {
  DataGridProps,
  GridFilterModel,
  GridPaginationModel,
  GridSortModel,
} from "@mui/x-data-grid";

type DataGridPropsOverride = Omit<DataGridProps, "onFilterModelChange"> & {
  onFilterModelChange: (model: GridFilterModel) => void;
};

type ITableGrid = Required<
  Pick<
    DataGridPropsOverride,
    | "rows"
    | "loading"
    | "rowCount"
    | "sortingMode"
    | "sortModel"
    | "onSortModelChange"
    | "filterMode"
    | "onFilterModelChange"
    | "sx"
    | "disableRowSelectionOnClick"
    | "onStateChange"
    | "paginationMode"
  >
> &
  Pick<
    DataGridProps,
    | "checkboxSelection"
    | "onRowSelectionModelChange"
    | "editMode"
    | "paginationModel"
    | "onPaginationModelChange"
    | "filterModel"
    | "processRowUpdate"
  > & {
    columns: Array<{
      field: string;
      headerName: string;
      sortable?: boolean;
      renderCell?: ({ row }: { row: any }) => React.ReactNode;
      align?: "left" | "center" | "right";
      width?: number;
      headerAlign?: "left" | "center" | "right";
    }>;
    autoColumn?: boolean;
    expandable?: boolean;
    renderExpandableRow?: ({ row }: any) => JSX.Element;
    search?: boolean;
    tableMaxHeight?: number | string;
    serial?: boolean;
    hidePagination?: boolean;
  } & {
    setCurrent: (page: number) => void;
    setPageSize: (size: number) => void;
  };

export const ExpandableTableGrid = (props: ITableGrid) => {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const handleExpand = (id: number) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleSort = (field: string) => {
    const existing = props.sortModel.find((s) => s.field === field);
    const newOrder = existing?.sort === "asc" ? "desc" : "asc";
    const newSortModel: GridSortModel = [{ field, sort: newOrder }];
    props.onSortModelChange(newSortModel, {} as any);
  };

  const getCellContent = (col: ITableGrid["columns"][0], row: any) => {
    if (col.renderCell) return col.renderCell({ row });
    return row[col.field];
  };
  let columns = props.columns;
  // if (props.serial) {
  //   columns = [
  //     {
  //       field: "sn",
  //       headerName: "#",
  //       width: 20,
  //       sortable: false,
  //       renderCell: (params: any) => {
  //         console.log(params)
  //         // const { page, pageSize } =
  //         //   params.api.state.pagination.paginationModel;
  //         // const rowIndex = params.api.getRowIndexRelativeToVisibleRows(
  //         //   params.id,
  //         // );
  //         return "page * pageSize + rowIndex + 1";
  //       },
  //     },
  //     ...columns,
  //   ];
  // }

  return (
    <Paper sx={{ width: "100%", ...props.sx }}>
      <TableContainer
        sx={
          props.tableMaxHeight
            ? { height: props.tableMaxHeight, overflow: "auto" }
            : undefined
        }
      >
        <Table size="small" stickyHeader={!!props.tableMaxHeight}>
          <TableHead>
            <TableRow>
              {props.expandable && <TableCell />}
              {columns.map((col) => (
                <TableCell
                  key={col.field}
                  align={col.headerAlign ?? "left"}
                  sx={{ width: col.width }}
                >
                  {col.sortable ? (
                    <TableSortLabel
                      active={props.sortModel[0]?.field === col.field}
                      direction={
                        props.sortModel[0]?.sort === "desc" ? "desc" : "asc"
                      }
                      onClick={() => handleSort(col.field)}
                    >
                      {col.headerName}
                    </TableSortLabel>
                  ) : (
                    col.headerName
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {props.rows.map((row: any) => (
              <React.Fragment key={row.id}>
                <TableRow hover>
                  {props.expandable && (
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleExpand(row.id)}
                      >
                        {expandedRow === row.id ? (
                          <KeyboardArrowUp />
                        ) : (
                          <KeyboardArrowDown />
                        )}
                      </IconButton>
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell key={col.field} align={col.align ?? "left"}>
                      {getCellContent(col, row)}
                    </TableCell>
                  ))}
                </TableRow>
                {props.expandable && (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} sx={{ p: 0 }}>
                      <Collapse
                        sx={{ backgroundColor: "#dff6ff8f" }}
                        in={expandedRow === row.id}
                        timeout="auto"
                        unmountOnExit
                      >
                        <Box m={1}>{props.renderExpandableRow?.({ row })}</Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {!props.hidePagination && (
        <TablePagination
          component="div"
          count={props.rowCount}
          page={props.paginationModel?.page ?? 0}
          rowsPerPage={props.paginationModel?.pageSize ?? 25}
          onPageChange={(_, newPage) => {
            const model: GridPaginationModel = {
              pageSize: props.paginationModel?.pageSize ?? 25,
              ...props.paginationModel,
              page: newPage,
            };
            props.onPaginationModelChange?.(model, {} as any);
            props.setCurrent(newPage + 1); // 1-based index for useRefineDataGrid
          }}
          onRowsPerPageChange={(e) => {
            const pageSize = parseInt(e.target.value, 10);
            const model: GridPaginationModel = {
              ...props.paginationModel,
              pageSize,
              page: 0,
            };
            props.onPaginationModelChange?.(model, {} as any);
            props.setPageSize(pageSize);
          }}
          rowsPerPageOptions={[25, 50, 100]}
        />
      )}
    </Paper>
  );
};

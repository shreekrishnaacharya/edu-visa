import { useEffect, useRef, useState } from "react";
import { Box, ListItemIcon, ListItemText, MenuItem } from "@mui/material";
import {
  DataGrid,
  DataGridProps,
  GridColumnMenu,
  GridColumnMenuHideItem,
  GridColumnMenuItemProps,
  GridColumnMenuProps,
  GridFilterModel,
} from "@mui/x-data-grid";
import SettingsApplicationsIcon from "@mui/icons-material/SettingsApplications";
import { TextLabel } from "@components/other/text.label";

// Render the grid only once its wrapper has a measured non-zero width. Inside
// the simplebar scroll container the width is 0 for the first layout pass,
// which makes MUI X log "useResizeContainer … empty width".
function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return { ref, ready: w > 1 };
}

type DataGridPropsOverride = Omit<DataGridProps, "onFilterModelChange"> & {
  onFilterModelChange: (model: GridFilterModel) => void;
};
export type ITableGrid = Required<
  Pick<
    DataGridPropsOverride,
    "rows"
    // | "sortingMode"
    // | "sortModel"
    // | "onSortModelChange"
    // | "filterMode"
    // | "onFilterModelChange"
    // | "sx"
    // | "disableRowSelectionOnClick"
    // | "onStateChange"
    // | "paginationMode"
  >
> &
  Pick<
    DataGridProps,
    | "onProcessRowUpdateError"
    | "apiRef"
    | "rowModesModel"
    | "onRowModesModelChange"
    | "processRowUpdate"
    | "onRowEditStop"
    | "isRowSelectable"
    // | "showToolbar"
    | "rowCount"
    | "slotProps"
    | "getCellClassName"
    | "slots"
    | "getRowId"
    | "checkboxSelection"
    | "onRowSelectionModelChange"
    | "editMode"
    | "isCellEditable"
    | "onCellDoubleClick"
    | "paginationModel"
    | "onPaginationModelChange"
    | "filterModel"
    | "processRowUpdate"
    | "sortingMode"
    | "sortModel"
    | "onSortModelChange"
    | "filterMode"
    | "onFilterModelChange"
    | "disableColumnFilter"
    | "disableDensitySelector"
    | "disableColumnSelector"
    | "sx"
    | "disableRowSelectionOnClick"
    | "onStateChange"
    | "paginationMode"
    | "pagination"
    | "hideFooterPagination"
    | "pageSizeOptions"
    | "autoPageSize"
    | "loading"
    | "getRowClassName"
    | "rowSelectionModel"
    | "experimentalFeatures"
    | "autoHeight"
    | "onRowClick"
    | "columnVisibilityModel"
    | "initialState"
    | "rowHeight"
    | "getRowHeight"
    | "columnHeaderHeight"
    | "disableColumnMenu"
    | "hideFooter"
  > & {
    columns: Array<any>;
    autoColumn?: boolean;
    exportable?: boolean;
    serial?: boolean;
  };

export function TableGrid(props: ITableGrid) {
  let columns = props.columns.map((e: any) => {
    if (e.type === "actions") {
      return {
        ...e,
        sortable: false,
        filterable: false,
        width: 150,
        renderHeader: (params: any) => params.colDef.headerName,
      };
    }
    if (e.width) {
      return {
        ...e,
        renderCell:
          e.renderCell ??
          (({ row }: any) => (
            <TextLabel
              TypoProps={{ py: 1 }}
              text={row[e.field]}
              width={e.width}
            />
          )),
      };
    }
    if (e.field === "actions") {
      return {
        ...e,
        sortable: false,
        filterable: false,
        width: 150,
        renderHeader: (params: any) => params.colDef.headerName,
      };
    }
    return {
      ...e,
      flex: 1,
      renderCell:
        e.renderCell ??
        (({ row }: any) => (
          <TextLabel
            TypoProps={{ py: 1 }}
            text={String(row[e.field])}
            width={e.width}
          />
        )),
    };
  });
  if (props.serial) {
    columns = [
      {
        field: "sn",
        headerName: "#",
        width: 10,
        sortable: false,
        filterable: false,
        renderCell: (params: any) => {
          const { page, pageSize } =
            params.api.state.pagination.paginationModel;
          const rowIndex = params.api.getRowIndexRelativeToVisibleRows(
            params.id,
          );
          return page * pageSize + rowIndex + 1;
        },
      },
      ...columns,
    ];
  }
  return <DeferredGrid props={props} columns={columns} />;
}

function DeferredGrid({ props, columns }: { props: any; columns: any[] }) {
  const { ref, ready } = useMeasuredWidth();
  return (
    <Box ref={ref} sx={{ width: "100%", minWidth: 0, minHeight: ready ? undefined : 240 }}>
      {ready && (
        <DataGrid
          autoHeight
          density="compact"
          pageSizeOptions={[25, 50, 100]}
          {...props}
          columns={columns}
          slots={{
            columnMenu: (p) => {
              if (p.colDef.field === "actions") {
                return <CustomColumnMenu {...p} />;
              }
              return <GridColumnMenu {...p} />;
            },
          }}
        />
      )}
    </Box>
  );
}

function GeneralColumnMenu(props: GridColumnMenuProps) {
  return (
    <GridColumnMenu
      {...props}
      slots={{
        // Add new item
        columnMenuUserItem: CustomUserItem,
      }}
    />
  );
}

function CustomColumnMenu(props: GridColumnMenuProps) {
  return (
    <GridColumnMenu
      {...props}
      slots={{
        columnMenuHideItem: GridColumnMenuHideItem,
        // disable others
        columnMenuSortItem: null,
        columnMenuFilterItem: null,
        columnMenuColumnsItem: null,
      }}
    />
  );
}

function CustomUserItem(props: GridColumnMenuItemProps) {
  const { myCustomHandler, myCustomValue } = props;
  return (
    <MenuItem onClick={myCustomHandler}>
      <ListItemIcon>
        <SettingsApplicationsIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText>{myCustomValue}</ListItemText>
    </MenuItem>
  );
}

const calculateColumnWidth = (content: string) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (context?.font) {
    context.font = "16px Arial";
  }
  // Customize font settings based on your table
  const metrics = context?.measureText(content);
  return Math.ceil(metrics?.width ?? 0) + 20; // Add padding to width
};

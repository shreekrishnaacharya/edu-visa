import * as React from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Close";
import {
  GridRowsProp,
  GridRowModesModel,
  GridRowModes,
  GridEventListener,
  GridRowModel,
  GridRowEditStopReasons,
  GridSlotProps,
  GridSlots,
  GridActionsCellItem,
  GridRenderEditCellParams,
  useGridApiRef,
} from "@mui/x-data-grid";
import { ITableGrid, TableGrid } from "./table.body";
import { Button, TextField, Toolbar } from "@mui/material";
import { useTranslate } from "@hooks/useTranslate";
import { LANG_COMMON } from "@common/constant";

// Module augmentation for toolbar props
declare module "@mui/x-data-grid" {
  interface ToolbarPropsOverrides {
    setRows: React.Dispatch<React.SetStateAction<GridRowsProp>>;
    setRowModesModel: React.Dispatch<React.SetStateAction<GridRowModesModel>>;
  }
}

interface IEditableTable extends Omit<ITableGrid, "rows"> {
  rows: any;
  handleSaveClick?: (row: any) => Promise<any | null>;
  handleDeleteClick?: (row: any) => Promise<boolean>;
  hideEditActions?: boolean;
  hideDeleteActions?: boolean;
  hideAddAction?: boolean;
}

/**
 * Custom Edit Cell Component
 */
function InputEditInputCell(props: GridRenderEditCellParams) {
  // Destructure the required props for integration and our custom props
  const { id, field, value, api, required, colDef, error, ...otherProps } =
    props;
  const headerName = colDef.headerName || field;
  const requiredFlag = (colDef as any).required;
  let customError = null;
  if (requiredFlag && !value) {
    customError = `${headerName} is a required.`;
  }
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    api.setEditCellValue({ id, field, value: event.target.value ?? "" }, event);
  };
  return (
    <TextField
      fullWidth
      type={colDef.type === "number" ? "number" : "text"}
      value={value}
      onChange={handleChange}
      placeholder={`Enter ${headerName}`}
      // helperText={customError}
      error={!!customError}
      variant="standard"
      sx={{
        // ".MuiInput-root:before": { borderBottom: "none !important" },
        // ".MuiInput-root:after": { borderBottom: "none !important" },
        ".MuiInput-root": { height: "100%", paddingTop: "0 !important" },
        ".MuiInputBase-input": { padding: 0, height: "100%" },
      }}
      {...otherProps}
    />
  );
}

/**
 * Toolbar for Adding Records
 */
function EditToolbar(props: GridSlotProps["toolbar"], t: any) {
  const { setRows, setRowModesModel, hideAddAction } = props as any;

  const handleClick = () => {
    const id = "NEW_" + Math.random(); // Recommend using uuid or similar in production
    setRows((oldRows: any) => [{ id, name: "", isNew: true }, ...oldRows]);
    setRowModesModel((oldModel: any) => ({
      ...oldModel,
      [id]: { mode: GridRowModes.Edit, fieldToFocus: "name" },
    }));
  };

  if (hideAddAction) return null;

  return (
    <Toolbar sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Button color="primary" startIcon={<AddIcon />} onClick={handleClick}>
        {t("actions.addRecord")}
      </Button>
    </Toolbar>
  );
}

export function EditableTable(props: IEditableTable) {
  const [rows, setRows] = React.useState<GridRowsProp>(props.rows);
  const [rowModesModel, setRowModesModel] = React.useState<GridRowModesModel>(
    {},
  );
  const t = useTranslate(LANG_COMMON);
  const apiRef = useGridApiRef();

  // Sync rows if props change
  React.useEffect(() => {
    setRows(props.rows);
  }, [props.rows]);

  const handleRowEditStop: GridEventListener<"rowEditStop"> = (
    params,
    event,
  ) => {
    if (params.reason === GridRowEditStopReasons.rowFocusOut) {
      event.defaultMuiPrevented = true;
    }
  };

  const processRowUpdate = async (
    newRow: GridRowModel,
    oldRow: GridRowModel,
  ) => {
    let updatedRow = { ...newRow, isNew: false, id: newRow.id } as any;

    if (props.handleSaveClick) {
      const newData = await props.handleSaveClick(updatedRow);

      if (newData === null) {
        // DO NOT setRowModesModel to View here.
        // Throwing an error tells DataGrid the update failed.
        throw new Error("Save failed");
      }
      updatedRow.id = newData.id;
    }

    // Success logic: update state and return the new row to commit changes
    setRows((prev) => prev.map((r) => (r.id === newRow.id ? updatedRow : r)));
    return updatedRow;
  };

  const columns = React.useMemo(() => {
    return [
      ...props.columns.map((column) => ({
        ...column,
        editable: true,
        renderEditCell: (params: GridRenderEditCellParams) => {
          return <InputEditInputCell {...params} />;
        },
      })),
      {
        field: "actions",
        type: "actions",
        headerName: t("table.actions"),
        cellClassName: "actions",
        getActions: (params: any) => {
          const isInEditMode =
            rowModesModel[params.id]?.mode === GridRowModes.Edit;
          if (isInEditMode) {
            return [
              <GridActionsCellItem
                key="save"
                icon={<SaveIcon />}
                label={t("actions.save")}
                onClick={() =>
                  apiRef.current.stopRowEditMode({
                    id: params.id,
                    ignoreModifications: false,
                  })
                }
                color="primary"
              />,
              <GridActionsCellItem
                key="cancel"
                icon={<CancelIcon />}
                label={t("actions.cancel")}
                className="textPrimary"
                onClick={() => {
                  setRowModesModel({
                    ...rowModesModel,
                    [params.id]: {
                      mode: GridRowModes.View,
                      ignoreModifications: true,
                    },
                  });
                  const editedRow = rows.find((row) => row.id === params.id);
                  if (editedRow?.isNew) {
                    setRows((prev) =>
                      prev.filter((row) => row.id !== params.id),
                    );
                  }
                }}
                color="error"
              />,
            ];
          }

          return [
            ...(props.hideEditActions
              ? []
              : [
                  <GridActionsCellItem
                    key="edit"
                    icon={<EditIcon />}
                    label={t("actions.edit")}
                    className="textPrimary"
                    onClick={() =>
                      setRowModesModel({
                        ...rowModesModel,
                        [params.id]: { mode: GridRowModes.Edit },
                      })
                    }
                    color="inherit"
                  />,
                ]),
            ...(props.hideDeleteActions
              ? []
              : [
                  <GridActionsCellItem
                    key="delete"
                    icon={<DeleteIcon />}
                    label={t("actions.delete")}
                    onClick={async () => {
                      const success = props.handleDeleteClick
                        ? await props.handleDeleteClick(params.row)
                        : true;
                      if (success)
                        setRows((prev) =>
                          prev.filter((row) => row.id !== params.id),
                        );
                    }}
                    color="error"
                  />,
                ]),
          ];
        },
      },
    ];
  }, [
    props.columns,
    props.hideEditActions,
    props.hideDeleteActions,
    rowModesModel,
  ]);
  return (
    <Box sx={{ height: 500, width: "100%" }}>
      <TableGrid
        {...props}
        apiRef={apiRef}
        rows={rows}
        columns={columns}
        editMode="row"
        rowModesModel={rowModesModel}
        onRowModesModelChange={(newModel) => setRowModesModel(newModel)}
        onRowEditStop={handleRowEditStop}
        processRowUpdate={processRowUpdate}
        slots={{
          toolbar: (props) => EditToolbar(props, t),
        }}
        slotProps={{
          toolbar: {
            setRows,
            setRowModesModel,
            hideAddAction: props.hideAddAction,
          } as any,
        }}
      />
    </Box>
  );
}

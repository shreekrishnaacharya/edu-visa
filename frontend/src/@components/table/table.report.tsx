import { useLayoutEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
  useTheme,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";

export interface Column<T> {
  key: string;
  label: string | React.ReactNode;
  sortable?: boolean;
  sortKey?: string;
  width?: number;
  render?: (item: T, idx: number) => React.ReactNode;
  align?: "left" | "right" | "center";
  sticky?: boolean;
  resizable?: boolean; // defaults to true; set false to disable on a specific column
  cellSx?: (item: T, idx: number) => object | undefined;
  exportValue?: (item: T, idx: number) => string | number | null;
  skipExport?: boolean;
  exportLabel?: string;
}

export interface ColumnGroup {
  label: string | React.ReactNode;
  keys: string[];
}

export interface FooterCell {
  value: React.ReactNode;
  colSpan?: number;
  align?: "left" | "right" | "center";
}

interface TableWithSearchAndSortProps<T> {
  data: T[];
  columns: Column<T>[];
  sortKey?: string | null;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string) => void;
  /** Legacy: raw JSX footer row (no sticky support). Prefer footerCells. */
  footer?: React.ReactNode;
  /** Typed footer cells — sticky offsets are applied automatically. */
  footerCells?: FooterCell[];
  maxHeight?: string | number;
  /**
   * When provided, renders a two-row header: row 1 has sticky columns (rowSpan=2)
   * plus group label cells; row 2 has the individual sub-column labels.
   */
  columnGroups?: ColumnGroup[];
  onExport?: () => void;
}

const DEFAULT_COL_WIDTH = 120;
const MIN_COL_WIDTH = 40;

export function TableWithSearchAndSort<T>({
  data,
  columns,
  sortKey,
  sortOrder,
  onSort,
  footer,
  footerCells,
  maxHeight,
  columnGroups,
  onExport,
}: TableWithSearchAndSortProps<T>) {
  const theme = useTheme();
  const bg = theme.palette.background.paper;

  // Stores user-dragged overrides; falls back to col.width or DEFAULT_COL_WIDTH
  const [colWidths, setColWidths] = useState<Map<string, number>>(new Map());
  const dragRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  // Measure the actual first header row height so row-2 sticky top is exact.
  // stickyHeader is disabled in grouped mode to avoid MUI's two-class specificity
  // overriding our manual top values; we set position/top/zIndex ourselves.
  const headerRow1Ref = useRef<HTMLTableRowElement>(null);
  const [row1Height, setRow1Height] = useState(0);
  useLayoutEffect(() => {
    if (columnGroups && headerRow1Ref.current) {
      setRow1Height(headerRow1Ref.current.offsetHeight);
    }
  }, [columnGroups]);

  const getColWidth = (col: Column<T>) =>
    colWidths.get(col.key) ?? col.width ?? DEFAULT_COL_WIDTH;

  // Sticky offsets re-derived on every render so they track resize changes
  const stickyOffsets = new Map<string, number>();
  let stickyOffset = 0;
  let lastStickyKey: string | null = null;
  for (const col of columns) {
    if (col.sticky) {
      stickyOffsets.set(col.key, stickyOffset);
      stickyOffset += getColWidth(col);
      lastStickyKey = col.key;
    }
  }

  const tableMinWidth = columns.reduce((sum, col) => sum + getColWidth(col), 0);

  const getStickyStyle = (col: Column<T>, isHeader = false) => {
    if (!col.sticky) return {};
    return {
      position: "sticky" as const,
      left: stickyOffsets.get(col.key) ?? 0,
      zIndex: isHeader ? 3 : 1,
      backgroundColor: bg,
      ...(col.key === lastStickyKey && {
        boxShadow: `3px 0 6px -2px ${theme.palette.divider}`,
      }),
    };
  };

  const handleResizeStart = (e: React.MouseEvent, col: Column<T>) => {
    e.preventDefault();
    e.stopPropagation(); // don't trigger sort
    dragRef.current = { key: col.key, startX: e.clientX, startWidth: getColWidth(col) };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const { key, startX, startWidth } = dragRef.current;
      const newWidth = Math.max(MIN_COL_WIDTH, startWidth + (ev.clientX - startX));
      setColWidths((prev) => new Map(prev).set(key, newWidth));
    };

    const onMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const resizeHandleSx = {
    position: "absolute" as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: 6,
    cursor: "col-resize",
    zIndex: 1,
    opacity: 0,
    backgroundColor: "primary.main",
    transition: "opacity 0.15s",
    "th:hover &": { opacity: 0.5 },
  };

  const renderHeaderCellInner = (col: Column<T>) => (
    <>
      {col.sortable ? (
        <TableSortLabel
          active={sortKey === (col.sortKey ?? col.key)}
          direction={sortKey === (col.sortKey ?? col.key) ? sortOrder : "asc"}
          onClick={() => onSort?.(col.sortKey ?? col.key)}
        >
          {col.label}
        </TableSortLabel>
      ) : (
        <Typography>{col.label}</Typography>
      )}
      {col.resizable !== false && (
        <Box
          component="div"
          onMouseDown={(e) => handleResizeStart(e, col)}
          sx={resizeHandleSx}
        />
      )}
    </>
  );

  const stickyColumns = columns.filter((c) => c.sticky);
  const nonStickyColumns = columns.filter((c) => !c.sticky);

  return (
    <Box>
      {onExport && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={onExport}
          >
            Export Excel
          </Button>
        </Box>
      )}
    <TableContainer component={Paper} sx={{ maxHeight, overflowX: "auto" }}>
      <Table
        size="small"
        className="borderedTable miniTable"
        // Disable MUI's stickyHeader in grouped mode — its two-class CSS selector
        // (.MuiTable-stickyHeader .MuiTableCell-stickyHeader) would win over our sx
        // overrides. We set position/top/zIndex manually for all header cells instead.
        stickyHeader={!columnGroups}
        sx={{
          tableLayout: "fixed",
          minWidth: tableMinWidth,
          borderSpacing: 0,
        }}
      >
        {/* colgroup is the authoritative source of column widths under table-layout:fixed.
            Without it, browsers ignore row-2 widths when row-1 has colSpan cells. */}
        <colgroup>
          {columns.map((col) => (
            <col key={col.key} style={{ width: getColWidth(col) }} />
          ))}
        </colgroup>
        <TableHead>
          {columnGroups ? (
            <>
              {/* Row 1: sticky fixed cols (rowSpan=2) + group name headers */}
              <TableRow ref={headerRow1Ref}>
                {stickyColumns.map((col) => (
                  <TableCell
                    key={col.key}
                    align={col.align ?? "left"}
                    rowSpan={2}
                    sx={{
                      width: getColWidth(col),
                      minWidth: getColWidth(col),
                      overflow: "hidden",
                      userSelect: "none",
                      verticalAlign: "middle",
                      position: "sticky",
                      top: 0,
                      left: stickyOffsets.get(col.key) ?? 0,
                      zIndex: 4,
                      backgroundColor: bg,
                      ...(col.key === lastStickyKey && {
                        boxShadow: `3px 0 6px -2px ${theme.palette.divider}`,
                      }),
                    }}
                  >
                    {renderHeaderCellInner(col)}
                  </TableCell>
                ))}
                {columnGroups.map((grp, i) => (
                  <TableCell
                    key={i}
                    colSpan={grp.keys.length}
                    align="center"
                    sx={{
                      position: "sticky",
                      top: 0,
                      zIndex: 2,
                      backgroundColor: bg,
                    }}
                  >
                    <Typography variant="body2" fontWeight="bold">
                      {grp.label}
                    </Typography>
                  </TableCell>
                ))}
              </TableRow>
              {/* Row 2: individual sub-column labels */}
              <TableRow>
                {nonStickyColumns.map((col) => (
                  <TableCell
                    key={col.key}
                    align={col.align ?? "left"}
                    sx={{
                      width: getColWidth(col),
                      minWidth: getColWidth(col),
                      overflow: "hidden",
                      userSelect: "none",
                      position: "sticky",
                      top: row1Height,
                      zIndex: 2,
                      backgroundColor: bg,
                    }}
                  >
                    {renderHeaderCellInner(col)}
                  </TableCell>
                ))}
              </TableRow>
            </>
          ) : (
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  align={col.align ?? "left"}
                  sx={{
                    width: getColWidth(col),
                    minWidth: getColWidth(col),
                    overflow: "hidden",
                    position: "relative",
                    userSelect: "none",
                    ...getStickyStyle(col, true),
                  }}
                >
                  {renderHeaderCellInner(col)}
                </TableCell>
              ))}
            </TableRow>
          )}
        </TableHead>
        <TableBody>
          {data.map((item, idx) => (
            <TableRow key={idx}>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  align={col.align ?? "left"}
                  sx={{ overflow: "hidden", ...getStickyStyle(col), ...(col.cellSx?.(item, idx) ?? {}) }}
                >
                  {col.render ? col.render(item, idx) : getNestedValue(item, col.key)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {footerCells && (
          <TableFooter>
            <TableRow>
              {(() => {
                let colIdx = 0;
                return footerCells.map((cell, i) => {
                  const col = columns[colIdx];
                  const span = cell.colSpan ?? 1;
                  const isSticky = col?.sticky ?? false;
                  const left = col ? (stickyOffsets.get(col.key) ?? 0) : 0;
                  const spannedCols = columns.slice(colIdx, colIdx + span);
                  const spansLastSticky = spannedCols.some((c) => c.key === lastStickyKey);
                  colIdx += span;
                  return (
                    <TableCell
                      key={i}
                      colSpan={span}
                      align={cell.align ?? "left"}
                      sx={{
                        ...(isSticky && {
                          position: "sticky",
                          left,
                          zIndex: 1,
                          backgroundColor: bg,
                          ...(spansLastSticky && {
                            boxShadow: `3px 0 6px -2px ${theme.palette.divider}`,
                          }),
                        }),
                      }}
                    >
                      {cell.value}
                    </TableCell>
                  );
                });
              })()}
            </TableRow>
          </TableFooter>
        )}
        {!footerCells && footer && <TableFooter>{footer}</TableFooter>}
      </Table>
    </TableContainer>
    </Box>
  );
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((o, key) => (o ? o[key] : undefined), obj);
}

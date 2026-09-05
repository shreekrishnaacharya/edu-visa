import { ExcelJsonType } from "src/interfaces";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

export const exportToExcel = (
  fileName: string,
  rows: any[],
  columns: any[]
) => {
  // Create worksheet data
  const rowData = [columns, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(rowData);

  // Style the first row
  const range = XLSX.utils.decode_range(ws["!ref"]!); // Get the range of the sheet

  for (let C = range.s.c; C <= range.e.c; C++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C }); // Get cell address in first row
    if (!ws[cellAddress]) continue; // Skip if no cell exists
    ws[cellAddress].s = {
      fill: {
        fgColor: { rgb: "90EE90" }, // Light green background
      },
      font: {
        color: { rgb: "FFFFFF" }, // White text color
        bold: true, // Optional: Make it bold
      },
    };
  }

  ws["!freeze"] = {
    xSplit: 0, // No columns frozen
    ySplit: 1, // Freeze the first row
    topLeftCell: "A2", // Top-left cell to start scrolling
    activePane: "bottomLeft",
    state: "frozen",
  };
  // Enable styles in the workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  // Export to Excel with styles
  XLSX.writeFile(wb, `${fileName}.xlsx`, {
    bookType: "xlsx",
    cellStyles: true,
  });
};

type ExportCol<T> = {
  key: string;
  label?: any;
  exportLabel?: string;
  skipExport?: boolean;
  exportValue?: (item: T, idx: number) => string | number | null;
};

function nestedGet(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}

export async function exportColumnsToExcel<T>(
  columns: ExportCol<T>[],
  data: T[],
  fileName: string,
  footerRow?: (string | number | null)[]
): Promise<void> {
  const cols = columns.filter((c) => !c.skipExport);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Report");
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true },
    alignment: { horizontal: "center", vertical: "middle" },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "C6EFCE" } },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };
  const footerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "DDDDDD" } },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };
  const cellStyle: Partial<ExcelJS.Style> = {
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };

  // Header
  const hdr = ws.addRow(
    cols.map((c) => c.exportLabel ?? (typeof c.label === "string" ? c.label : c.key))
  );
  hdr.height = 20;
  hdr.eachCell((cell) => Object.assign(cell, { style: headerStyle }));

  // Data
  data.forEach((item, idx) => {
    const row = ws.addRow(
      cols.map((col) => {
        if (col.exportValue) return col.exportValue(item, idx) ?? "";
        const v = nestedGet(item, col.key);
        return v ?? "";
      })
    );
    row.eachCell((cell) => Object.assign(cell, { style: cellStyle }));
  });

  // Footer
  if (footerRow) {
    const fr = ws.addRow(footerRow.map((v) => v ?? ""));
    fr.eachCell((cell) => Object.assign(cell, { style: footerStyle }));
  }

  ws.columns = cols.map((c) => ({
    width: Math.max(12, ((c.exportLabel ?? (typeof c.label === "string" ? c.label : c.key)) as string).length + 4),
  }));

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const excelToJson = (file: any): Promise<(string | number)[][]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: (string | number)[][] = XLSX.utils.sheet_to_json(
        worksheet,
        {
          header: 1,
        }
      );
      resolve(jsonData);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
};

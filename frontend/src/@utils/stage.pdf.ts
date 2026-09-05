import Konva from "konva";
import jsPDF from "jspdf";
import { ensureStageImagesCORS } from "./stage.print";

export type CardOrientation = "portrait" | "landscape";

/**
 * Group the top-level card nodes of a Konva stage into visual rows based on
 * their rendered Y position, returning each row's vertical extent.
 */
const getCardRows = (stage: Konva.Stage) => {
  const layer = stage.getLayers()[0];
  if (!layer) return [] as { top: number; bottom: number }[];

  // Each card is a direct Group child of the layer.
  const cards = layer
    .getChildren((node) => node.getClassName() === "Group")
    .map((node) => {
      const rect = node.getClientRect({ skipShadow: true });
      return { top: rect.y, bottom: rect.y + rect.height };
    })
    .sort((a, b) => a.top - b.top);

  const rows: { top: number; bottom: number }[] = [];
  cards.forEach((card) => {
    const current = rows[rows.length - 1];
    // Cards whose tops are close belong to the same row.
    if (current && Math.abs(card.top - current.top) < card.bottom - card.top) {
      current.top = Math.min(current.top, card.top);
      current.bottom = Math.max(current.bottom, card.bottom);
    } else {
      rows.push({ top: card.top, bottom: card.bottom });
    }
  });
  return rows;
};

/**
 * Export a Konva card stage to a multi-page PDF, slicing it into A4 pages that
 * match the chosen orientation:
 *   - landscape -> 2 rows of cards per page
 *   - portrait  -> 4 rows of cards per page
 * Pages are cropped at the actual card boundaries so no card is split, and each
 * crop is fit to the page preserving its aspect ratio.
 */
export const handleStageExportPdf = async (
  stageList: Konva.Stage[],
  orientation: CardOrientation = "landscape",
  fileName = "cards.pdf",
) => {
  const rowsPerPage = orientation === "portrait" ? 4 : 2;
  const margin = 16; // px of breathing room around each page crop

  const pdf = new jsPDF(orientation === "portrait" ? "p" : "l", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let addedPages = 0;

  for (const stage of stageList) {
    try {
      // Make sure cross-origin images won't taint the canvas before exporting.
      await ensureStageImagesCORS(stage);

      const stageWidth = stage.width();
      const stageHeight = stage.height();
      const rows = getCardRows(stage);
      if (rows.length === 0) continue;

      for (let i = 0; i < rows.length; i += rowsPerPage) {
        const pageRows = rows.slice(i, i + rowsPerPage);
        const cropTop = Math.max(0, pageRows[0].top - margin);
        const cropBottom = Math.min(
          stageHeight,
          pageRows[pageRows.length - 1].bottom + margin,
        );

        const imageDataUrl = stage.toDataURL({
          x: 0,
          y: cropTop,
          width: stageWidth,
          height: cropBottom - cropTop,
          pixelRatio: 2, // higher resolution
        });

        if (addedPages > 0) {
          pdf.addPage("a4", orientation === "portrait" ? "p" : "l");
        }

        const imgProps = pdf.getImageProperties(imageDataUrl);
        const ratio = Math.min(
          pageWidth / imgProps.width,
          pageHeight / imgProps.height,
        );
        const imgWidth = imgProps.width * ratio;
        const imgHeight = imgProps.height * ratio;
        const x = (pageWidth - imgWidth) / 2;
        const y = (pageHeight - imgHeight) / 2;

        pdf.addImage(imageDataUrl, "PNG", x, y, imgWidth, imgHeight);
        addedPages++;
      }
    } catch (err) {
      console.error("Failed to export stage to PDF:", err);
      alert(
        "Failed to generate PDF. This may be due to cross-origin image " +
          "restrictions. Please ensure all images are from the same domain " +
          "or have CORS enabled.",
      );
      return;
    }
  }

  if (addedPages === 0) {
    alert("Unable to generate PDF content. Please check console for details.");
    return;
  }

  pdf.save(fileName);
};

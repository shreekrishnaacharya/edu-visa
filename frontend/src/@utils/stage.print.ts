import Konva from "konva";

/**
 * Reload any cross-origin images on the stage with crossOrigin='anonymous' so
 * the canvas is not tainted and can be exported to a data URL.
 */
export const ensureStageImagesCORS = async (stage: Konva.Stage) => {
  const imgNodes = stage.find("Image");
  const reloadPromises: Promise<boolean>[] = [];

  imgNodes.forEach((imgNode: any) => {
    const imgEl = imgNode.image?.();
    if (imgEl && imgEl instanceof HTMLImageElement) {
      const src = imgEl.src || "";
      const isData = src.startsWith("data:");
      const isBlob = src.startsWith("blob:");

      // If image is not data/blob URL and crossOrigin not set, attempt to reload with anonymous
      if (!isData && !isBlob && imgEl.crossOrigin !== "anonymous") {
        const p = new Promise<boolean>((res) => {
          const newImg = new Image();
          newImg.crossOrigin = "anonymous";

          newImg.onload = () => {
            try {
              imgNode.image(newImg);
              res(true);
            } catch (e) {
              console.warn("Failed to replace image node:", e);
              res(false);
            }
          };

          newImg.onerror = (err) => {
            console.warn("Failed to reload image with CORS:", src, err);
            res(false);
          };

          // Start loading after assigning handlers
          newImg.src = src;
        });
        reloadPromises.push(p);
      }
    }
  });

  if (reloadPromises.length > 0) {
    const results = await Promise.all(reloadPromises);
    const successCount = results.filter((r) => r).length;
    console.log(`Reloaded ${successCount}/${reloadPromises.length} images with CORS`);

    // Give the stage a moment to fully redraw after image updates
    stage.batchDraw();
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
};

/**
 * Convert a list of Konva stages into high-resolution base64 image data URLs.
 * Ensures images are CORS-safe so the canvas is not tainted, and renders at 2x
 * for better quality. Stages that fail to export are skipped (returned as null).
 */
export const stageListToImageUrls = async (
  stageList: Konva.Stage[],
): Promise<string[]> => {
  const ensureImagesHaveCORS = ensureStageImagesCORS;

  const imageUrls = await Promise.all(
    stageList.map(async (stage: Konva.Stage, index: number) => {
      try {
        // First, ensure all images have CORS enabled
        await ensureImagesHaveCORS(stage);

        const scaleX = 2; // Increase by 2x or more for better resolution
        const scaleY = 2; // Same scaling for height and width

        // Save the original scale and size
        const originalWidth = stage.width();
        const originalHeight = stage.height();
        const originalScaleX = stage.scaleX();
        const originalScaleY = stage.scaleY();

        // Set the scale for better quality
        stage.scale({ x: scaleX, y: scaleY });
        stage.width(originalWidth * scaleX); // Increase width for higher resolution
        stage.height(originalHeight * scaleY); // Increase height for higher resolution

        // Generate the high-resolution base64 image
        const imageDataUrl = stage.toDataURL();

        // Restore the original scale and size
        stage.scale({ x: originalScaleX, y: originalScaleY });
        stage.width(originalWidth); // Restore original width
        stage.height(originalHeight); // Restore original height

        return imageDataUrl;
      } catch (err) {
        console.error(`Failed to export stage ${index} to data URL:`, err);
        alert(
          `Failed to generate printable image for page ${index + 1}. ` +
          `This may be due to cross-origin image restrictions. ` +
          `Please ensure all images are from the same domain or have CORS enabled.`
        );
        return null;
      }
    })
  );

  return imageUrls.filter((u): u is string => Boolean(u));
};

export const handleStagePrint = async (stageList: Konva.Stage[]) => {
  const validUrls = await stageListToImageUrls(stageList);
  if (validUrls.length === 0) {
    console.error("No printable stage images generated (possible CORS/tainted canvas).");
    alert("Unable to generate printable content. Please check console for details.");
    return;
  }

  // Create a hidden iframe element to hold the images
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.top = "-9999px"; // Hide the iframe off-screen
  iframe.style.width = "0";
  iframe.style.height = "0";

  // Append iframe to the body
  document.body.appendChild(iframe);

  // Get the iframe's document and inject the images content
  const iframeDocument = iframe.contentWindow!.document;
  iframeDocument.open();
  iframeDocument.write(`
      <html>
        <head>
          <style>
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              img {
                width: 100%;
                page-break-after: always; /* Ensure each bill starts on a new page */
              }
            }
          </style>
        </head>
        <body>
          ${validUrls.map((img: string) => `<img src="${img}" />`).join("")}
        </body>
      </html>
    `);
  iframeDocument.close();

  // Trigger the print dialog
  setTimeout(() => {
    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();

    // Clean up the iframe after printing
    document.body.removeChild(iframe);
  }, stageList.length * 100);
};

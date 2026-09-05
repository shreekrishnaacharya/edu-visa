// import { FileType } from "@common/all.enum";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { UPLOAD_URL } from "@common/options";
import { IFileResponse } from "src/interfaces";

export function CapLetter(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function extractContent(url: string) {
  const regex = /^\/([^/]+)\//; // Updated regex
  const match = url.match(regex);
  if (match) {
    const [, content] = match;
    return content;
  }
  return "";
}

export function getQueryParam(
  query: string,
  params: any,
  full: boolean = false,
) {
  if (full) {
    const baseUrl =
      window.location.origin +
      "/" +
      (query.startsWith("/") ? query.substring(1) : query);
    return baseUrl.replace(/:([a-zA-Z0-9_]+)/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }
  return query.replace(/:([a-zA-Z0-9_]+)/g, (match, key) => {
    return params[key] !== undefined ? params[key] : match;
  });
}

export function getUrlQuery(url: string, query: object) {
  return (
    url +
    (url.includes("?") ? "&" : "?") +
    Object.entries(query)
      .map(([key, value]) => `${key}=${value}`)
      .join("&")
  );
}

// export const getFileType = (mimeType: string): FileType => {
//   if (/^image\/(jpeg|png|gif|bmp|webp|svg\+xml)$/.test(mimeType)) {
//     return "image";
//   } else if (/^video\/(mp4|webm|ogg|x-msvideo|mpeg)$/.test(mimeType)) {
//     return "video";
//   } else if (/^audio\/(mpeg|ogg|wav|webm|aac)$/.test(mimeType)) {
//     return "audio";
//   } else if (/^application\/pdf$/.test(mimeType)) {
//     return "pdf";
//   } else if (
//     /^application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet$/.test(
//       mimeType
//     )
//   ) {
//     return "excel";
//   } else if (
//     /^application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$/.test(
//       mimeType
//     )
//   ) {
//     return "word";
//   } else if (
//     /^application\/vnd\.ms-powerpoint|application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation$/.test(
//       mimeType
//     )
//   ) {
//     return "powerpoint";
//   } else if (
//     /^application\/(zip|gzip|x-tar|x-rar-compressed)$/.test(mimeType)
//   ) {
//     return "zip";
//   } else {
//     return "other";
//   }
// };

interface IShowingFooter {
  current: number;
  pageSize: number;
  total: number;
}
export const showingFooter = ({
  current,
  pageSize,
  total,
}: IShowingFooter): String => {
  console.log(current, pageSize, total);
  if (current * pageSize - pageSize + 1 > total) {
    return `Showing ${current * pageSize - pageSize + 1} to -- of page ${
      pageSize + 1
    }`;
  }
  if (current * pageSize > total) {
    return `Showing ${current * pageSize - pageSize + 1} to ${total}`;
  }
  return `Showing ${current * pageSize - pageSize + 1} to ${
    current * pageSize
  } of ${total}`;
};

export function downloadFile(file: IFileResponse) {
  fetch(`${UPLOAD_URL}/download/${file.id}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name; // Use the provided name for the downloaded file

      // Trigger the download
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      // Cleanup
      URL.revokeObjectURL(url);
    })
    .catch((error) => {
      console.error("Error downloading the file:", error);
    });
}

export function copyToClipboard(text: string): void {
  navigator.clipboard
    .writeText(text)
    .then(() => console.log("Text copied to clipboard!"))
    .catch((err) => console.error("Failed to copy text:", err));
}

export function getLibraryDueDays(dueDate: string) {
  const oneDayInMs = 24 * 60 * 60 * 1000; // Number of milliseconds in one day
  const diffInMs = new Date(dueDate).getTime() - new Date().getTime();
  return Math.ceil(diffInMs / oneDayInMs); // Convert milliseconds to days
}

export function adjustArraySize(array: any[], size: number) {
  const targetSize = Math.max(array.length, size);
  if (array.length < targetSize) {
    return [...array, ...Array(targetSize - array.length)];
  }
  return array;
}

export function roundTo(value: number, decimals: number = 2): number {
  return Number(Math.round(Number(`${value}e${decimals}`)) + `e-${decimals}`);
}

export async function generateQRBarCodes(qrData: string, barcodeData: string) {
  const qr = await QRCode.toDataURL(qrData, {
    margin: 2,
  });
  return {
    qr,
    barcode: generateBarcode(barcodeData, 40),
  };
}

export function generateBarcode(data: string, height: number = 40) {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, data, {
    format: "CODE128",
    height: height,
    displayValue: false,
  });

  return canvas.toDataURL();
}

export function getUpdatedFields(oldObj: any, newObj: any) {
  return Object.keys(newObj).reduce((acc, key) => {
    if (oldObj[key] !== newObj[key]) {
      acc[key] = newObj[key];
    }
    return acc;
  }, {} as any);
}


export function chunkArray(array: any[], size: number) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
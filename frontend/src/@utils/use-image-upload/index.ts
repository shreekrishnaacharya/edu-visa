import axios from "axios";
import type { IFile, IFileResponse } from "../../interfaces";
import { BASE_URL, UPLOAD_URL } from "@common/options";

type ImageUploadProps = {
  file: any;
};

export const useImageUpload = async ({ file }: ImageUploadProps) => {
  const formData = new FormData();
  formData.append("file", file);

  const res: any = await axios.post<{ url: string }>(
    `${UPLOAD_URL}/image`,
    formData,
    {
      withCredentials: false,
      headers: {
        "Access-Control-Allow-Origin": "*",
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  const imagePaylod: IFileResponse[] = [{ ...res.data }];

  return imagePaylod;
};

type ImageUploadsProps = {
  files: File[];
};

export const useImageUploads = async ({ files }: ImageUploadsProps) => {
  const formData = new FormData();
  Array.from(files).forEach((file, index) => {
    formData.append(`files[${index}]`, file);
  });
  const res: any = await axios.post<{ url: string }>(
    `${UPLOAD_URL}/images`,
    formData,
    {
      withCredentials: false,
      headers: {
        "Access-Control-Allow-Origin": "*",
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  const imagePaylod: IFileResponse[] = [...res.data];

  return imagePaylod;
};

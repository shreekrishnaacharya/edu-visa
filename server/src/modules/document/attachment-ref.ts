/** A reference to an object in the S3/MinIO bucket — replaces the prototype's inline data: URL. */
export interface AttachmentRef {
  name: string;
  type: string; // MIME
  size: number; // bytes
  storage_key: string;
}

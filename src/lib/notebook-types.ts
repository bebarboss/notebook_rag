export type SourceStatus = "uploading" | "ingested" | "error";

export type SourceItem = {
  id: string;
  filename: string;
  ext: string;
  service: string | null;
  status: SourceStatus;
  uploadedAt: string;
  selected: boolean;
  error?: string;
  savedPath?: string;
};

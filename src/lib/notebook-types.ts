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

// รูปที่ผู้ใช้แนบกับคำถาม — previewUrl คือ object URL ไว้โชว์ thumbnail ในแชท ส่วน text คือ
// ข้อความที่ OCR อ่านได้ (ตัวรูปเองไม่ถูกส่งไป /ask ส่งแค่ข้อความ)
export type ThreadImage = { previewUrl: string; text: string };

// รวมข้อความ OCR ของหลายรูปเป็นก้อนเดียวสำหรับส่งเป็น image_text (มีหัว "รูปที่ n" เมื่อมีหลายรูป)
export function joinImageText(images: ThreadImage[] | undefined): string {
  const list = (images ?? []).filter((im) => im.text.trim());
  if (list.length === 0) return "";
  return list
    .map((im, i) => (list.length > 1 ? `รูปที่ ${i + 1}:\n${im.text.trim()}` : im.text.trim()))
    .join("\n\n");
}

import { useState } from "react";
import { BookOpen, ExternalLink, FileText, Loader2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchSourceFile, type Citation } from "@/lib/notebook-api";

// เปิดไฟล์ PDF ต้นฉบับในแท็บใหม่ เลื่อนไปหน้าที่อ้างอิงด้วย URL fragment #page=N (ใช้ตัว
// PDF viewer ในตัวของเบราว์เซอร์ — รองรับ Chrome/Firefox/Edge บนเดสก์ท็อป)
// โหลดผ่าน fetch + Bearer token ก่อน (ไม่ใช้ <a href> ตรงๆ เพราะ endpoint ต้องการ auth header
// ซึ่งการเปิดลิงก์ตรงๆ ของเบราว์เซอร์ส่งให้ไม่ได้) แล้วค่อยเปิด blob URL ที่ได้ในแท็บใหม่
async function openPdfAtPage(source: string, page: number | null | undefined) {
  const blob = await fetchSourceFile(source);
  const url = URL.createObjectURL(blob);
  window.open(page ? `${url}#page=${page}` : url, "_blank");
}

export function CitationPanel({ citation, onClose }: { citation: Citation; onClose: () => void }) {
  const [openingPdf, setOpeningPdf] = useState(false);
  const pct = Math.round(Math.max(0, Math.min(1, citation.score)) * 100);
  const isPdf = citation.kind === "doc" && citation.source.toLowerCase().endsWith(".pdf");

  const handleOpenPdf = async () => {
    setOpeningPdf(true);
    try {
      await openPdfAtPage(citation.source, citation.page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เปิดไฟล์ไม่สำเร็จ");
    } finally {
      setOpeningPdf(false);
    }
  };

  const incidentRows: Array<[string, string | null | undefined]> = [
    ["ปัญหา", citation.problem],
    ["สาเหตุ", citation.cause],
    ["วิธีแก้ไข", citation.workaround],
  ];

  const icon =
    citation.kind === "incident" ? (
      <TriangleAlert className="size-4 shrink-0 text-warning" />
    ) : citation.kind === "case_category" ? (
      <BookOpen className="size-4 shrink-0 text-primary" />
    ) : (
      <FileText className="size-4 shrink-0 text-primary" />
    );

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-2 border-b p-4">
        {icon}
        <h2 className="flex-1 truncate text-sm font-semibold">อ้างอิง [{citation.number}]</h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="ปิด">
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={pct >= 70 ? "default" : "secondary"}>{pct}% เกี่ยวข้อง</Badge>
          {citation.service && <Badge variant="outline">{citation.service}</Badge>}
          {citation.kind === "case_category" && <Badge variant="secondary">หมวดปัญหา</Badge>}
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {citation.kind === "case_category" ? "ชื่อหมวดปัญหา" : "แหล่งที่มา"}
          </p>
          <p className="break-words text-sm">{citation.source}</p>
        </div>

        {citation.kind === "doc" && (
          <>
            <div className="flex gap-6">
              {citation.page !== null && citation.page !== undefined && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">หน้า</p>
                  <p className="text-sm">{citation.page}</p>
                </div>
              )}
              {citation.chunk_index !== null && citation.chunk_index !== undefined && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Chunk</p>
                  <p className="text-sm">{citation.chunk_index}</p>
                </div>
              )}
            </div>
            {isPdf && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleOpenPdf()}
                disabled={openingPdf}
                className="gap-1.5"
              >
                {openingPdf ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="size-3.5" />
                )}
                เปิดดู PDF
                {citation.page !== null && citation.page !== undefined
                  ? ` (หน้า ${citation.page})`
                  : ""}
              </Button>
            )}
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">เนื้อหา</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{citation.content}</p>
            </div>
          </>
        )}

        {citation.kind === "case_category" && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              ขั้นตอนการตรวจสอบโดยละเอียด
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{citation.content}</p>
          </div>
        )}

        {citation.kind === "incident" && (
          <>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Incident No.
              </p>
              <p className="text-sm">{citation.incident_no}</p>
            </div>
            {incidentRows.map(([label, value]) => (
              <div key={label}>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {value?.trim() ? value : "—"}
                </p>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

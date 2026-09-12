import { FileText, Info, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SourceItem } from "@/lib/notebook-types";

export function DetailsPanel({
  source,
  onRemove,
  isAdmin,
}: {
  source: SourceItem | null;
  onRemove: (id: string) => void;
  isAdmin: boolean;
}) {
  if (!source) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-surface p-6 text-center">
        <Info className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">เลือกแหล่งข้อมูลทางซ้ายเพื่อดูรายละเอียด</p>
      </div>
    );
  }

  const rows: Array<[string, string]> = [
    ["ชื่อไฟล์", source.filename],
    ["Service", source.service ?? "—"],
    ["นามสกุล", source.ext || "—"],
    ["เวลาที่อัปโหลด", new Date(source.uploadedAt).toLocaleString("th-TH")],
    [
      "สถานะ ingest",
      source.status === "ingested"
        ? "ingested"
        : source.status === "uploading"
          ? "กำลังประมวลผล..."
          : `error: ${source.error ?? "ไม่ทราบสาเหตุ"}`,
    ],
  ];

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-2 border-b p-4">
        {source.ext === ".csv" ? (
          <TriangleAlert className="size-4 text-warning" />
        ) : (
          <FileText className="size-4 text-primary" />
        )}
        <h2 className="truncate text-sm font-semibold">รายละเอียดแหล่งข้อมูล</h2>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-3">
          {rows.map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
              <p className="break-words text-sm">{v}</p>
            </div>
          ))}
        </div>

        {source.savedPath && (
          <>
            <Separator />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Saved path
              </p>
              <p className="break-all text-xs text-muted-foreground">{source.savedPath}</p>
            </div>
          </>
        )}

        <Separator />
        <Badge variant={source.selected ? "default" : "secondary"}>
          {source.selected ? "ใช้กรองผลค้นหา" : "ไม่ถูกเลือกในการค้นหา"}
        </Badge>
      </div>

      {isAdmin && (
        <div className="border-t p-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="w-full text-destructive"
                onClick={() => onRemove(source.id)}
              >
                <Trash2 className="size-4" />
                ลบออกจากรายการ
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              ลบข้อมูลที่ ingest ไว้บนเซิร์ฟเวอร์ถาวร (รวมไฟล์ที่อัปโหลดไว้ด้วย)
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

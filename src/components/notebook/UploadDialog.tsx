import { useRef, useState } from "react";
import { Upload, FileUp, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACCEPTED_EXT, MAX_FILE_SIZE, fileExt } from "@/lib/notebook-api";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (file: File, service: string) => void;
};

export function UploadDialog({ open, onOpenChange, onSubmit }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [service, setService] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (list: FileList | null | undefined) => {
    if (!list || list.length === 0) return;
    const next: File[] = [];
    for (const f of Array.from(list)) {
      if (!ACCEPTED_EXT.includes(fileExt(f.name))) {
        toast.error(`${f.name}: ไม่รองรับนามสกุลไฟล์นี้ (${ACCEPTED_EXT.join(" ")})`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name}: ไฟล์ใหญ่เกิน 50MB`);
        continue;
      }
      next.push(f);
    }
    if (next.length === 0) return;
    setFiles((prev) => [...prev, ...next]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const reset = () => {
    setFiles([]);
    setService("");
    setDragging(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>เพิ่มแหล่งข้อมูล</DialogTitle>
          <DialogDescription>
            รองรับ {ACCEPTED_EXT.join(" ")} ขนาดไม่เกิน 50MB ต่อไฟล์ (เลือกได้หลายไฟล์พร้อมกัน) —
            ไฟล์ .csv ต้องมีคอลัมน์ incident_no, service, problem, cause, workaround
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragging ? "border-primary bg-accent" : "border-border hover:bg-muted"
          }`}
        >
          <FileUp className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            {files.length > 0
              ? `เลือกแล้ว ${files.length} ไฟล์ (คลิกเพื่อเพิ่มอีก)`
              : "ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์ (เลือกได้หลายไฟล์)"}
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept={ACCEPTED_EXT.join(",")}
            onChange={(e) => {
              pick(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${f.lastModified}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted"
              >
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {(f.size / 1024 / 1024).toFixed(2)} MB
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  aria-label={`เอา ${f.name} ออก`}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <Label htmlFor="service">Service (ไม่บังคับ)</Label>
          <Input
            id="service"
            placeholder="เช่น payment, core-banking"
            value={service}
            onChange={(e) => setService(e.target.value)}
          />
          {files.length > 1 && (
            <p className="text-xs text-muted-foreground">
              service เดียวกันนี้จะถูกใช้กับทุกไฟล์ที่เลือก
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button
            disabled={files.length === 0}
            onClick={() => {
              if (files.length === 0) return;
              for (const f of files) {
                onSubmit(f, service.trim());
              }
              reset();
              onOpenChange(false);
            }}
          >
            <Upload className="size-4" />
            อัปโหลด{files.length > 1 ? ` (${files.length} ไฟล์)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

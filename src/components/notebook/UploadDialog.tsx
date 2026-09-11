import { useRef, useState } from "react";
import { Upload, FileUp } from "lucide-react";
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
  const [file, setFile] = useState<File | null>(null);
  const [service, setService] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    if (!ACCEPTED_EXT.includes(fileExt(f.name))) {
      toast.error(`ไม่รองรับนามสกุลไฟล์นี้ (${ACCEPTED_EXT.join(" ")})`);
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error("ไฟล์ใหญ่เกิน 50MB");
      return;
    }
    setFile(f);
  };

  const reset = () => {
    setFile(null);
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
            รองรับ {ACCEPTED_EXT.join(" ")} ขนาดไม่เกิน 50MB — ไฟล์ .csv ต้องมีคอลัมน์
            incident_no, service, problem, cause, workaround
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
            pick(e.dataTransfer.files?.[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragging ? "border-primary bg-accent" : "border-border hover:bg-muted"
          }`}
        >
          <FileUp className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            {file ? file.name : "ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์"}
          </p>
          {file && (
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_EXT.join(",")}
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="service">Service (ไม่บังคับ)</Label>
          <Input
            id="service"
            placeholder="เช่น payment, core-banking"
            value={service}
            onChange={(e) => setService(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button
            disabled={!file}
            onClick={() => {
              if (!file) return;
              onSubmit(file, service.trim());
              reset();
              onOpenChange(false);
            }}
          >
            <Upload className="size-4" />
            อัปโหลด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

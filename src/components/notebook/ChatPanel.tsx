import { useRef, useState } from "react";
import {
  Check,
  ChevronsUpDown,
  FileText,
  ImagePlus,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ocrImage, type Citation } from "@/lib/notebook-api";
import type { ThreadImage } from "@/lib/notebook-types";

export type ThreadItem = {
  id: string;
  question: string;
  topK: number;
  service: string;
  documentsOnly: boolean;
  loading: boolean;
  error?: string;
  answer?: string;
  citations?: Citation[];
  // AI ขอข้อมูลเพิ่มจาก user แทนที่จะตอบเลย — ข้อความถัดไปของ user คือคำตอบของคำถามนี้
  needsClarification?: boolean;
  images?: ThreadImage[];
};

type Attachment = {
  id: string;
  name: string;
  previewUrl: string;
  status: "reading" | "done" | "error";
  text: string;
};

const MAX_ATTACHMENTS = 3;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type Props = {
  thread: ThreadItem[];
  availableChannels: string[];
  activeChannel: string;
  onChannelChange: (channel: string) => void;
  hasSources: boolean;
  onAsk: (q: string, documentsOnly: boolean, images: ThreadImage[]) => void;
  onAddSource: () => void;
  onCiteClick: (citation: Citation) => void;
};

// แยกข้อความส่วนที่เหลือ (นอก code block) ตามรูปแบบ [n] แล้วแปลงให้เป็นปุ่มคลิกได้ที่ map ไปยัง citations[n-1]
// ปุ่มโชว์แค่ [n] ดิบๆ (ไม่ใช่ "Manual result n") เพื่อให้กระชับ กดแล้วเปิดรายละเอียดเหมือนเดิม
function renderWithCitations(
  text: string,
  citations: Citation[],
  onCiteClick: (c: Citation) => void,
  keyPrefix: string,
) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const m = /^\[(\d+)\]$/.exec(part);
    const citation = m ? citations[Number(m[1]) - 1] : undefined;
    if (!citation) return <span key={`${keyPrefix}-${i}`}>{part}</span>;
    return (
      <button
        key={`${keyPrefix}-${i}`}
        type="button"
        onClick={() => onCiteClick(citation)}
        className="mx-0.5 inline-flex items-center rounded bg-primary/15 px-1.5 py-0.5 align-middle text-xs font-semibold text-primary underline decoration-dotted hover:bg-primary/25"
      >
        {part}
      </button>
    );
  });
}

// แยกข้อความคำตอบเป็นส่วน code block (```...```) กับข้อความปกติ — code block render เป็น
// <pre><code> ตัวเอกซ์เตี้ยม (monospace) ไม่ต้อง parse [n] ข้างในเพราะโค้ด/query ไม่มีการอ้างอิง
function AnswerText({
  text,
  citations,
  onCiteClick,
}: {
  text: string;
  citations: Citation[];
  onCiteClick: (c: Citation) => void;
}) {
  const segments = text.split(/(```[a-zA-Z]*\n?[\s\S]*?```)/g);
  return (
    <>
      {segments.map((seg, si) => {
        const codeMatch = /^```([a-zA-Z]*)\n?([\s\S]*?)```$/.exec(seg);
        if (codeMatch) {
          const code = (codeMatch[2] ?? "").replace(/\n$/, "");
          return (
            <pre
              key={si}
              className="my-2 overflow-x-auto rounded-lg border bg-muted p-3 font-mono text-xs"
            >
              <code>{code}</code>
            </pre>
          );
        }
        return <span key={si}>{renderWithCitations(seg, citations, onCiteClick, `${si}`)}</span>;
      })}
    </>
  );
}

export function ChatPanel({
  thread,
  availableChannels,
  activeChannel,
  onChannelChange,
  hasSources,
  onAsk,
  onAddSource,
  onCiteClick,
}: Props) {
  const [q, setQ] = useState("");
  const [channelPickerOpen, setChannelPickerOpen] = useState(false);
  const [documentsOnly, setDocumentsOnly] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readyImages = attachments.filter((a) => a.status === "done" && a.text.trim());
  const readingImages = attachments.some((a) => a.status === "reading");

  const updateAttachment = (id: string, patch: Partial<Attachment>) =>
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  // แนบรูป: เริ่ม OCR ทันทีที่เลือก/วาง เพื่อให้ผู้ใช้เห็นสถานะและได้ผลก่อนกดส่ง
  const addImages = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      toast.error(`แนบรูปได้สูงสุด ${MAX_ATTACHMENTS} รูปต่อข้อความ`);
      return;
    }
    if (images.length > room) toast.error(`แนบได้อีก ${room} รูป ส่วนที่เกินถูกข้าม`);

    for (const file of images.slice(0, room)) {
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name || "รูป"}: ใหญ่เกิน 10 MB`);
        continue;
      }
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      setAttachments((prev) => [
        ...prev,
        { id, name: file.name || "รูป", previewUrl, status: "reading", text: "" },
      ]);
      ocrImage(file)
        .then((res) => {
          updateAttachment(id, { status: "done", text: res.text });
          if (!res.text.trim()) toast.warning("ไม่พบข้อความในรูปนี้ ลองใช้รูปที่ชัดขึ้น");
        })
        .catch((e) => {
          updateAttachment(id, { status: "error" });
          toast.error(e instanceof Error ? e.message : "อ่านรูปไม่สำเร็จ");
        });
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const canSend =
    !!activeChannel && !readingImages && (q.trim().length > 0 || readyImages.length > 0);

  const lastItem = thread[thread.length - 1];
  const awaitingReply = !!lastItem?.needsClarification && !lastItem.loading && !lastItem.error;

  const submit = () => {
    if (!canSend) return;
    // แนบรูปอย่างเดียวไม่พิมพ์คำถาม → ใช้คำถามตั้งต้น (API ต้องมีคำถามอย่างน้อย 1 ตัวอักษร)
    const question = q.trim() || "ช่วยดูข้อความจากรูปที่แนบ และแนะนำแนวทางตรวจสอบ";
    onAsk(
      question,
      documentsOnly,
      readyImages.map((a) => ({ previewUrl: a.previewUrl, text: a.text })),
    );
    // รูปที่ส่งไปแล้วต้องคง object URL ไว้ให้ thread โชว์ thumbnail — revoke เฉพาะรูปที่ไม่ได้ส่ง
    // (อ่านไม่สำเร็จ/ไม่มีข้อความ)
    for (const a of attachments) {
      if (!readyImages.includes(a)) URL.revokeObjectURL(a.previewUrl);
    }
    setAttachments([]);
    setQ("");
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex flex-wrap items-center gap-3 border-b bg-surface px-4 py-3">
        {availableChannels.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            ยังไม่มี service ให้เลือก ติดต่อ admin เพื่อขอสิทธิ์เข้าถึง
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Service</span>
            <Popover open={channelPickerOpen} onOpenChange={setChannelPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={channelPickerOpen}
                  className="w-[200px] justify-between font-normal"
                >
                  {activeChannel || "เลือก service"}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0">
                <Command>
                  <CommandInput placeholder="ค้นหา service..." />
                  <CommandList>
                    <CommandEmpty>ไม่พบ service</CommandEmpty>
                    <CommandGroup>
                      {availableChannels.map((ch) => (
                        <CommandItem
                          key={ch}
                          value={ch}
                          onSelect={(value) => {
                            onChannelChange(value);
                            setChannelPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4",
                              activeChannel === ch ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {ch}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-8 p-4 pb-8 md:p-6">
          {thread.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
                <Sparkles className="size-6" />
              </div>
              <h1 className="text-xl font-semibold">Notebook RAG</h1>
              {hasSources ? (
                <p className="max-w-sm text-sm text-muted-foreground">
                  พิมพ์คำถามด้านล่าง ระบบจะค้นหาทั้งเอกสารและ incident ที่เกี่ยวข้อง แล้วให้ AI
                  สรุปคำตอบพร้อมอ้างอิงแหล่งที่มา
                </p>
              ) : (
                <>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    เริ่มต้นด้วยการอัปโหลดไฟล์แรกของคุณ (PDF, TXT, EPUB หรือ CSV ของ incident)
                    แล้วถามคำถามเป็นภาษาไทยได้ทันที
                  </p>
                  <Button onClick={onAddSource}>อัปโหลดไฟล์แรก</Button>
                </>
              )}
            </div>
          )}

          {thread.map((t) => (
            <section key={t.id} className="space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                  {t.question}
                </div>
              </div>
              {t.images && t.images.length > 0 && (
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {t.images.map((img, i) => (
                      <img
                        key={i}
                        src={img.previewUrl}
                        alt={`รูปที่แนบ ${i + 1}`}
                        className="size-16 rounded-lg border object-cover"
                      />
                    ))}
                  </div>
                  <details className="max-w-[85%] text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none text-right">
                      ดูข้อความที่อ่านได้จากรูป
                    </summary>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border bg-muted p-2 text-left font-sans">
                      {t.images
                        .map((img, i) => `รูปที่ ${i + 1}:\n${img.text.trim()}`)
                        .join("\n\n")}
                    </pre>
                  </details>
                </div>
              )}
              {(t.service || t.documentsOnly) && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {t.service && <Badge variant="outline">service: {t.service}</Badge>}
                  {t.documentsOnly && (
                    <Badge variant="outline" className="gap-1">
                      <FileText className="size-3" />
                      เฉพาะ Documents
                    </Badge>
                  )}
                </div>
              )}

              {t.loading && (
                <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  กำลังค้นหาและให้ AI สรุปคำตอบ อาจใช้เวลาถึง 1-2 นาที...
                </div>
              )}

              {t.error && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  {t.error}
                </div>
              )}

              {!t.loading && !t.error && t.answer && (
                <div className="flex justify-start">
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-sm leading-relaxed",
                      t.needsClarification && "border-warning/60 bg-warning/5",
                    )}
                  >
                    <AnswerText
                      text={t.answer}
                      citations={t.citations ?? []}
                      onCiteClick={onCiteClick}
                    />
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>

      <div className="border-t bg-surface p-3 md:p-4">
        <div className="mx-auto w-full max-w-3xl space-y-2">
          <button
            type="button"
            onClick={() => setDocumentsOnly((v) => !v)}
            aria-pressed={documentsOnly}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              documentsOnly
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-transparent text-muted-foreground hover:bg-muted"
            }`}
          >
            <FileText className="size-3.5" />
            ค้นหาเฉพาะ Documents
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={attachments.length >= MAX_ATTACHMENTS}
            className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImagePlus className="size-3.5" />
            แนบรูป (OCR)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addImages(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    "group relative size-16 overflow-hidden rounded-lg border bg-card",
                    a.status === "error" && "border-destructive",
                    a.status === "done" && !a.text.trim() && "border-warning",
                  )}
                  title={
                    a.status === "reading"
                      ? "กำลังอ่านข้อความจากรูป..."
                      : a.status === "error"
                        ? "อ่านรูปไม่สำเร็จ"
                        : a.text.trim()
                          ? `อ่านได้ ${a.text.trim().length} ตัวอักษร`
                          : "ไม่พบข้อความในรูป"
                  }
                >
                  <img src={a.previewUrl} alt={a.name} className="size-full object-cover" />
                  {a.status === "reading" && (
                    <div className="absolute inset-0 grid place-items-center bg-background/70">
                      <Loader2 className="size-4 animate-spin" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    aria-label={`เอา ${a.name} ออก`}
                    className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 shadow hover:bg-background"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex w-full items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm">
            <Textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files).filter((f) =>
                  f.type.startsWith("image/"),
                );
                if (files.length > 0) {
                  e.preventDefault();
                  addImages(files);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              disabled={!activeChannel}
              placeholder={
                !activeChannel
                  ? "เลือก service ด้านบนก่อนเริ่มถามคำถาม"
                  : awaitingReply
                    ? "พิมพ์ข้อมูลเพิ่มเติมตามที่ AI ถามด้านบน (หรือพิมพ์คำถามใหม่เพื่อเริ่มเรื่องอื่น)..."
                    : "ถามเกี่ยวกับเอกสารหรือ incident ของคุณ..."
              }
              className="max-h-40 min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <Button size="icon" onClick={submit} disabled={!canSend} aria-label="ส่งคำถาม">
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Check, ChevronsUpDown, Loader2, Send, Sparkles } from "lucide-react";
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
import type { Citation } from "@/lib/notebook-api";

export type ThreadItem = {
  id: string;
  question: string;
  topK: number;
  service: string;
  loading: boolean;
  error?: string;
  answer?: string;
  citations?: Citation[];
};

type Props = {
  thread: ThreadItem[];
  availableChannels: string[];
  activeChannel: string;
  onChannelChange: (channel: string) => void;
  hasSources: boolean;
  onAsk: (q: string) => void;
  onAddSource: () => void;
  onCiteClick: (citation: Citation) => void;
};

// ป้ายกำกับปุ่มอ้างอิง ให้สื่อว่ามาจากแหล่งไหน (Manual/Incident/Known Issue) แทนที่จะโชว์แค่ [n] ดิบๆ
function citationLabel(citation: Citation) {
  const kindLabel =
    citation.kind === "doc"
      ? "Manual result"
      : citation.kind === "incident"
        ? "Incident result"
        : "Known Issue result";
  return `${kindLabel} ${citation.number}`;
}

// แยกข้อความส่วนที่เหลือ (นอก code block) ตามรูปแบบ [n] แล้วแปลงให้เป็นปุ่มคลิกได้ที่ map ไปยัง citations[n-1]
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
        {citationLabel(citation)}
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

  const submit = () => {
    if (!q.trim()) return;
    onAsk(q.trim());
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
              {t.service && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline">service: {t.service}</Badge>
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
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-sm leading-relaxed">
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
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm">
          <Textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            disabled={!activeChannel}
            placeholder={
              activeChannel
                ? "ถามเกี่ยวกับเอกสารหรือ incident ของคุณ..."
                : "เลือก service ด้านบนก่อนเริ่มถามคำถาม"
            }
            className="max-h-40 min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button
            size="icon"
            onClick={submit}
            disabled={!q.trim() || !activeChannel}
            aria-label="ส่งคำถาม"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

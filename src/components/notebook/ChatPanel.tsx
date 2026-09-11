import { useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocResultCard, IncidentResultCard } from "./ResultCard";
import type { DocResult, IncidentResult, SearchMode } from "@/lib/notebook-api";

export type ThreadItem = {
  id: string;
  question: string;
  mode: SearchMode;
  topK: number;
  service: string;
  loading: boolean;
  error?: string;
  docs?: DocResult[];
  incidents?: IncidentResult[];
};

type Props = {
  thread: ThreadItem[];
  mode: SearchMode;
  setMode: (m: SearchMode) => void;
  topK: number;
  setTopK: (n: number) => void;
  service: string;
  setService: (s: string) => void;
  hasSources: boolean;
  onAsk: (q: string) => void;
  onAddSource: () => void;
};

export function ChatPanel({
  thread,
  mode,
  setMode,
  topK,
  setTopK,
  service,
  setService,
  hasSources,
  onAsk,
  onAddSource,
}: Props) {
  const [q, setQ] = useState("");

  const submit = () => {
    if (!q.trim()) return;
    onAsk(q.trim());
    setQ("");
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex flex-wrap items-center gap-3 border-b bg-surface px-4 py-3">
        <Tabs value={mode} onValueChange={(v) => setMode(v as SearchMode)}>
          <TabsList>
            <TabsTrigger value="docs">เอกสาร</TabsTrigger>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex min-w-[180px] items-center gap-2">
          <span className="whitespace-nowrap text-xs text-muted-foreground">top_k</span>
          <Slider
            value={[topK]}
            min={1}
            max={50}
            step={1}
            onValueChange={(v) => setTopK(v[0] ?? 5)}
            className="w-28"
          />
          <Badge variant="secondary">{topK}</Badge>
        </div>
        <Input
          className="h-9 w-44"
          placeholder="กรองตาม service"
          value={service}
          onChange={(e) => setService(e.target.value)}
        />
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
                  พิมพ์คำถามด้านล่าง ระบบจะค้นหาแหล่งอ้างอิงที่เกี่ยวข้องที่สุดจากไฟล์ของคุณ
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
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="outline">{t.mode === "docs" ? "เอกสาร" : "Incidents"}</Badge>
                <Badge variant="outline">top_k {t.topK}</Badge>
                {t.service && <Badge variant="outline">service: {t.service}</Badge>}
              </div>

              {t.loading && (
                <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  กำลังค้นหาแหล่งอ้างอิง...
                </div>
              )}

              {t.error && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  {t.error}
                </div>
              )}

              {!t.loading && !t.error && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    แหล่งอ้างอิงที่เกี่ยวข้องที่สุด (
                    {(t.mode === "docs" ? t.docs : t.incidents)?.length ?? 0})
                  </p>
                  <div className="space-y-3">
                    {t.mode === "docs"
                      ? t.docs?.map((r, i) => <DocResultCard key={r.id} r={r} index={i} />)
                      : t.incidents?.map((r, i) => (
                          <IncidentResultCard key={r.id} r={r} index={i} />
                        ))}
                    {((t.mode === "docs" ? t.docs : t.incidents)?.length ?? 0) === 0 && (
                      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                        ไม่พบผลลัพธ์ที่เกี่ยวข้อง ลองปรับคำค้นหรือเพิ่มค่า top_k
                      </div>
                    )}
                  </div>
                </>
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
            placeholder={
              mode === "docs" ? "ถามเกี่ยวกับเอกสารของคุณ..." : "ค้นหา incident ที่คล้ายกัน..."
            }
            className="max-h-40 min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button size="icon" onClick={submit} disabled={!q.trim()} aria-label="ส่งคำถาม">
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

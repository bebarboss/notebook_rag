import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, LogOut, Menu, Moon, PanelRight, Settings, Sun } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SourcesPanel } from "@/components/notebook/SourcesPanel";
import { DetailsPanel } from "@/components/notebook/DetailsPanel";
import { CitationPanel } from "@/components/notebook/CitationPanel";
import { ChatPanel, type ThreadItem } from "@/components/notebook/ChatPanel";
import { UploadDialog } from "@/components/notebook/UploadDialog";
import {
  askQuestion,
  checkHealth,
  deleteSource,
  fileExt,
  getSettings,
  listSources,
  uploadSource,
  type Citation,
  type HistoryMessage,
} from "@/lib/notebook-api";
import { clearSession, getToken } from "@/lib/auth";
import { joinImageText, type SourceItem, type ThreadImage } from "@/lib/notebook-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Notebook RAG — ค้นหาเอกสารและ Incident ด้วย Semantic Search" },
      {
        name: "description",
        content:
          "อัปโหลด PDF, TXT, EPUB หรือ CSV ของ incident แล้วค้นหาแหล่งอ้างอิงที่เกี่ยวข้องที่สุดได้ทันที",
      },
      { property: "og:title", content: "Notebook RAG" },
      {
        property: "og:description",
        content: "ค้นหาเอกสารและ incident ด้วย semantic search จากไฟล์ที่คุณอัปโหลด",
      },
    ],
  }),
  component: NotebookPage,
});

const TOP_K = 5;

function NotebookPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!getToken()) void navigate({ to: "/login" });
  }, [navigate]);

  const [sources, setSources] = useState<SourceItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [threadsByChannel, setThreadsByChannel] = useState<Record<string, ThreadItem[]>>({});
  const [activeChannel, setActiveChannel] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const health = useQuery({
    queryKey: ["health"],
    queryFn: checkHealth,
    refetchInterval: 30_000,
  });

  const sourcesQuery = useQuery({ queryKey: ["sources"], queryFn: listSources });
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current || !sourcesQuery.data) return;
    hydrated.current = true;
    setSources(
      sourcesQuery.data.sources.map((s) => ({
        id: `${s.source}::${s.service ?? ""}`,
        filename: s.filename,
        ext: s.ext,
        service: s.service,
        status: "ingested",
        uploadedAt: s.created_at,
        selected: true,
        savedPath: s.source,
      })),
    );
  }, [sourcesQuery.data]);

  const activeSource = useMemo(
    () => sources.find((s) => s.id === activeId) ?? null,
    [sources, activeId],
  );

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const availableChannels = settingsQuery.data?.channels ?? [];
  const isAdmin = settingsQuery.data?.is_admin ?? false;

  useEffect(() => {
    const first = settingsQuery.data?.channels[0];
    if (!activeChannel && first) {
      setActiveChannel(first);
    }
  }, [activeChannel, settingsQuery.data]);

  const currentThread = threadsByChannel[activeChannel] ?? [];

  const visibleSources = activeChannel
    ? sources.filter((s) => s.service === activeChannel)
    : sources;

  const handleUpload = useCallback(async (file: File, svc: string) => {
    const id = crypto.randomUUID();
    setSources((prev) => [
      {
        id,
        filename: file.name,
        ext: fileExt(file.name),
        service: svc,
        status: "uploading",
        uploadedAt: new Date().toISOString(),
        selected: true,
      },
      ...prev,
    ]);
    setActiveId(id);
    try {
      const res = await uploadSource(file, svc);
      setSources((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: "ingested", service: res.service, savedPath: res.saved_path }
            : s,
        ),
      );
      toast.success(`อัปโหลด ${res.filename} สำเร็จ`);
    } catch (e) {
      const detail = e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ";
      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "error", error: detail } : s)),
      );
      toast.error(detail);
    }
  }, []);

  const handleAsk = useCallback(
    async (question: string, documentsOnly: boolean, images: ThreadImage[]) => {
      const channel = activeChannel; // capture ตอนถาม กันกรณีสลับ channel ระหว่างรอคำตอบ

      // ส่งบทสนทนาก่อนหน้าไปด้วยเฉพาะตอนที่ AI เพิ่งขอข้อมูลเพิ่ม (ข้อความล่าสุดใน thread เป็น
      // needsClarification) — เดินย้อนกลับตามลูกโซ่ของรอบที่ขอข้อมูลติดกัน จำกัด 4 คู่ตามที่
      // backend รับได้ (8 ข้อความ = CLARIFICATION_ROUND_CAP ใน ai_client.py, AI ถามทีละ 1 ข้อ x 4
      // รอบ) คำถามใหม่ที่ไม่เกี่ยวกันจึงเป็นคำถามเดี่ยวเหมือนเดิม ไม่ปนบริบทเก่า
      // โหมด documents only ไม่ขอข้อมูลเพิ่ม จึงไม่ส่ง history
      const history: HistoryMessage[] = [];
      if (!documentsOnly) {
        const chain: ThreadItem[] = [];
        const items = threadsByChannel[channel] ?? [];
        for (let i = items.length - 1; i >= 0 && chain.length < 4; i--) {
          const t = items[i];
          if (!t || !t.needsClarification || !t.answer) break;
          chain.unshift(t);
        }
        for (const t of chain) {
          // รอบก่อนที่แนบรูป: ข้อความจากรูปต้องไปกับ history ด้วย ไม่งั้นรอบตอบกลับจะเสียบริบทของรูป
          const prevImageText = joinImageText(t.images);
          history.push({
            role: "user",
            content: prevImageText
              ? `${t.question}\n\n[ข้อความจากรูปที่แนบ]\n${prevImageText}`
              : t.question,
          });
          history.push({ role: "assistant", content: t.answer ?? "" });
        }
      }

      const id = crypto.randomUUID();
      const item: ThreadItem = {
        id,
        question,
        topK: TOP_K,
        service: channel,
        documentsOnly,
        loading: true,
        ...(images.length > 0 ? { images } : {}),
        ...(history.length > 0 ? { usedContext: true } : {}),
      };
      setThreadsByChannel((prev) => ({
        ...prev,
        [channel]: [...(prev[channel] ?? []), item],
      }));

      try {
        const res = await askQuestion({
          question,
          top_k: TOP_K,
          service: channel || undefined,
          documents_only: documentsOnly,
          history,
          image_text: joinImageText(images),
        });
        setThreadsByChannel((prev) => ({
          ...prev,
          [channel]: (prev[channel] ?? []).map((t) =>
            t.id === id
              ? {
                  ...t,
                  loading: false,
                  answer: res.answer,
                  citations: res.citations,
                  needsClarification: res.needs_clarification,
                }
              : t,
          ),
        }));
      } catch (e) {
        const detail = e instanceof Error ? e.message : "ถามไม่สำเร็จ";
        setThreadsByChannel((prev) => ({
          ...prev,
          [channel]: (prev[channel] ?? []).map((t) =>
            t.id === id ? { ...t, loading: false, error: detail } : t,
          ),
        }));
        toast.error(detail);
      }
    },
    [activeChannel, threadsByChannel],
  );

  const handleCiteClick = useCallback((citation: Citation) => {
    setActiveCitation(citation);
    setRightOpen(true);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    void navigate({ to: "/login" });
  }, [navigate]);

  const sourcesPanel = (
    <SourcesPanel
      sources={visibleSources}
      activeId={activeId}
      onAdd={() => setUploadOpen(true)}
      onToggle={(id) =>
        setSources((prev) => prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)))
      }
      onSelect={(id) => {
        setActiveId(id);
        setActiveCitation(null);
        setLeftOpen(false);
        setRightOpen(true);
      }}
    />
  );

  const handleRemove = useCallback(
    async (id: string) => {
      const target = sources.find((s) => s.id === id);
      if (!target) return;

      // ยังไม่เคย ingest สำเร็จ (เช่น upload พัง) — เอาออกจาก UI อย่างเดียวพอ
      if (!target.savedPath) {
        setSources((prev) => prev.filter((s) => s.id !== id));
        setActiveId(null);
        setRightOpen(false);
        return;
      }

      const confirmed = window.confirm(
        `ลบ "${target.filename}" ออกจากระบบถาวร (รวมข้อมูลที่ ingest ไว้บน server) ต้องการดำเนินการต่อหรือไม่?`,
      );
      if (!confirmed) return;

      try {
        await deleteSource(target.savedPath, target.service);
        setSources((prev) => prev.filter((s) => s.id !== id));
        setActiveId(null);
        setRightOpen(false);
        queryClient.invalidateQueries({ queryKey: ["sources"] });
        toast.success(`ลบ ${target.filename} ออกจากระบบแล้ว`);
      } catch (e) {
        const detail = e instanceof Error ? e.message : "ลบไม่สำเร็จ";
        toast.error(detail);
      }
    },
    [sources, queryClient],
  );

  const detailsPanel = (
    <DetailsPanel source={activeSource} onRemove={handleRemove} isAdmin={isAdmin} />
  );

  const rightPanel = activeCitation ? (
    <CitationPanel citation={activeCitation} onClose={() => setActiveCitation(null)} />
  ) : (
    detailsPanel
  );

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-surface px-3 md:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setLeftOpen(true)}
            aria-label="เปิดรายการแหล่งข้อมูล"
          >
            <Menu className="size-4" />
          </Button>
          <span className="text-sm font-semibold tracking-tight">Notebook RAG</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
              <span
                className={`size-2 rounded-full ${health.data ? "bg-success" : "bg-destructive"}`}
              />
              {health.data ? "online" : "offline"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDark((v) => !v)}
              aria-label="สลับธีม"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="xl:hidden"
              onClick={() => setRightOpen(true)}
              aria-label="เปิดรายละเอียด"
            >
              <PanelRight className="size-4" />
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="icon" asChild aria-label="หมวดปัญหา">
                <Link to="/known-issues">
                  <BookOpen className="size-4" />
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="icon" asChild aria-label="ตั้งค่า">
              <Link to="/settings">
                <Settings className="size-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="ออกจากระบบ">
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[280px] shrink-0 border-r lg:block">{sourcesPanel}</aside>
          <main className="min-w-0 flex-1">
            <ChatPanel
              thread={currentThread}
              availableChannels={availableChannels}
              activeChannel={activeChannel}
              onChannelChange={setActiveChannel}
              hasSources={sources.length > 0}
              onAsk={handleAsk}
              onAddSource={() => setUploadOpen(true)}
              onCiteClick={handleCiteClick}
            />
          </main>
          <aside className="hidden w-[320px] shrink-0 border-l xl:block">{rightPanel}</aside>
        </div>
      </div>

      <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
        <SheetContent side="left" className="w-[300px] p-0">
          <SheetTitle className="sr-only">แหล่งข้อมูล</SheetTitle>
          {sourcesPanel}
        </SheetContent>
      </Sheet>

      <Sheet open={rightOpen} onOpenChange={setRightOpen}>
        <SheetContent side="right" className="w-[320px] p-0">
          <SheetTitle className="sr-only">รายละเอียดแหล่งข้อมูล</SheetTitle>
          {rightPanel}
        </SheetContent>
      </Sheet>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onSubmit={handleUpload} />
    </TooltipProvider>
  );
}

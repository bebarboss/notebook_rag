import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Menu, Moon, PanelRight, Sun } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SourcesPanel } from "@/components/notebook/SourcesPanel";
import { DetailsPanel } from "@/components/notebook/DetailsPanel";
import { ChatPanel, type ThreadItem } from "@/components/notebook/ChatPanel";
import { UploadDialog } from "@/components/notebook/UploadDialog";
import {
  checkHealth,
  fileExt,
  searchDocs,
  searchIncidents,
  uploadSource,
  type SearchMode,
} from "@/lib/notebook-api";
import type { SourceItem } from "@/lib/notebook-types";

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

function NotebookPage() {
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [mode, setMode] = useState<SearchMode>("docs");
  const [topK, setTopK] = useState(5);
  const [service, setService] = useState("");
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

  const activeSource = useMemo(
    () => sources.find((s) => s.id === activeId) ?? null,
    [sources, activeId],
  );

  const handleUpload = useCallback(async (file: File, svc: string) => {
    const id = crypto.randomUUID();
    setSources((prev) => [
      {
        id,
        filename: file.name,
        ext: fileExt(file.name),
        service: svc || null,
        status: "uploading",
        uploadedAt: new Date().toISOString(),
        selected: true,
      },
      ...prev,
    ]);
    setActiveId(id);
    try {
      const res = await uploadSource(file, svc || undefined);
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
    async (question: string) => {
      const id = crypto.randomUUID();
      const item: ThreadItem = { id, question, mode, topK, service, loading: true };
      setThread((prev) => [...prev, item]);

      const selectedNames = sources.filter((s) => s.selected).map((s) => s.filename);
      const filterBySelection = <T extends { source: string }>(rows: T[]) =>
        selectedNames.length > 0 && selectedNames.length < sources.length
          ? rows.filter((r) => selectedNames.some((n) => r.source.includes(n)))
          : rows;

      try {
        if (mode === "docs") {
          const res = await searchDocs({ q: question, top_k: topK, service: service || undefined });
          const docs = filterBySelection(res.results).sort((a, b) => b.score - a.score);
          setThread((prev) => prev.map((t) => (t.id === id ? { ...t, loading: false, docs } : t)));
        } else {
          const res = await searchIncidents({
            q: question,
            top_k: topK,
            service: service || undefined,
          });
          const incidents = filterBySelection(res.results).sort((a, b) => b.score - a.score);
          setThread((prev) =>
            prev.map((t) => (t.id === id ? { ...t, loading: false, incidents } : t)),
          );
        }
      } catch (e) {
        const detail = e instanceof Error ? e.message : "ค้นหาไม่สำเร็จ";
        setThread((prev) =>
          prev.map((t) => (t.id === id ? { ...t, loading: false, error: detail } : t)),
        );
        toast.error(detail);
      }
    },
    [mode, topK, service, sources],
  );

  const sourcesPanel = (
    <SourcesPanel
      sources={sources}
      activeId={activeId}
      onAdd={() => setUploadOpen(true)}
      onToggle={(id) =>
        setSources((prev) => prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)))
      }
      onSelect={(id) => {
        setActiveId(id);
        setLeftOpen(false);
        setRightOpen(true);
      }}
    />
  );

  const detailsPanel = (
    <DetailsPanel
      source={activeSource}
      onRemove={(id) => {
        setSources((prev) => prev.filter((s) => s.id !== id));
        setActiveId(null);
        setRightOpen(false);
        toast.success("ลบออกจากรายการแล้ว");
      }}
    />
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
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[280px] shrink-0 border-r lg:block">{sourcesPanel}</aside>
          <main className="min-w-0 flex-1">
            <ChatPanel
              thread={thread}
              mode={mode}
              setMode={setMode}
              topK={topK}
              setTopK={setTopK}
              service={service}
              setService={setService}
              hasSources={sources.length > 0}
              onAsk={handleAsk}
              onAddSource={() => setUploadOpen(true)}
            />
          </main>
          <aside className="hidden w-[320px] shrink-0 border-l xl:block">{detailsPanel}</aside>
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
          {detailsPanel}
        </SheetContent>
      </Sheet>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onSubmit={handleUpload} />
    </TooltipProvider>
  );
}

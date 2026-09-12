import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SourceItem } from "@/lib/notebook-types";

type Props = {
  sources: SourceItem[];
  activeId: string | null;
  onAdd: () => void;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
};

export function SourcesPanel({ sources, activeId, onAdd, onToggle, onSelect }: Props) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return sources;
    return sources.filter(
      (s) => s.filename.toLowerCase().includes(f) || (s.service ?? "").toLowerCase().includes(f),
    );
  }, [sources, filter]);

  const NO_SERVICE = "ไม่ระบุ service";
  const groups = useMemo(() => {
    const map = new Map<string, SourceItem[]>();
    for (const s of filtered) {
      const key = s.service || NO_SERVICE;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === NO_SERVICE) return 1;
      if (b === NO_SERVICE) return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="space-y-3 border-b border-sidebar-border p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">แหล่งข้อมูล</h2>
          <Badge variant="secondary">{sources.length}</Badge>
        </div>
        <Button className="w-full justify-start" onClick={onAdd}>
          <Plus className="size-4" />
          Add source
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="ค้นหาไฟล์ / service"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {filtered.length === 0 && (
            <p className="px-2 py-8 text-center text-xs text-muted-foreground">
              {sources.length === 0
                ? "ยังไม่มีแหล่งข้อมูล กด “Add source” เพื่อเริ่มต้น"
                : "ไม่พบรายการที่ตรงกับคำค้น"}
            </p>
          )}
          {groups.map(([serviceName, items]) => (
            <div key={serviceName} className="mb-2">
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-sidebar px-2 py-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {serviceName}
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {items.length}
                </Badge>
              </div>
              <div className="space-y-1">
                {items.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 transition-colors ${
                      activeId === s.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                      <Checkbox
                        checked={s.selected}
                        onCheckedChange={() => onToggle(s.id)}
                        disabled={s.status !== "ingested"}
                        aria-label={`เลือก ${s.filename}`}
                      />
                    </div>
                    {s.ext === ".csv" ? (
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                    ) : (
                      <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 break-words text-xs font-medium leading-snug">
                        {s.filename}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {s.status === "uploading" && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Loader2 className="size-3 animate-spin" />
                            กำลังประมวลผล อาจใช้เวลาสักครู่...
                          </span>
                        )}
                        {s.status === "ingested" && (
                          <span className="flex items-center gap-1 text-[11px] text-success">
                            <CheckCircle2 className="size-3" />
                            ingested
                          </span>
                        )}
                        {s.status === "error" && (
                          <span className="flex items-center gap-1 text-[11px] text-destructive">
                            <AlertCircle className="size-3" />
                            error
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

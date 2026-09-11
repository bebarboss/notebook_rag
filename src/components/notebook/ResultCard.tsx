import { useState } from "react";
import { FileText, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DocResult, IncidentResult } from "@/lib/notebook-api";

function Relevance({ score }: { score: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
  return (
    <div className="flex items-center gap-2">
      <Badge variant={pct >= 70 ? "default" : "secondary"}>{pct}% เกี่ยวข้อง</Badge>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function DocResultCard({ r, index }: { r: DocResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const long = r.content.length > 320;
  const text = expanded || !long ? r.content : `${r.content.slice(0, 320)}…`;

  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
            {index + 1}
          </span>
          <FileText className="size-4 shrink-0 text-primary" />
          <p className="truncate text-sm font-medium">{r.source}</p>
        </div>
        <Relevance score={r.score} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {r.service && <Badge variant="outline">{r.service}</Badge>}
        {r.page !== null && <Badge variant="secondary">หน้า {r.page}</Badge>}
        <Badge variant="secondary">chunk #{r.chunk_index}</Badge>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {text}
      </p>
      {long && (
        <Button variant="link" className="h-auto p-0" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "ย่อลง" : "ดูเพิ่มเติม"}
        </Button>
      )}
    </article>
  );
}

export function IncidentResultCard({ r, index }: { r: IncidentResult; index: number }) {
  const rows: Array<[string, string | null]> = [
    ["ปัญหา", r.problem],
    ["สาเหตุ", r.cause],
    ["วิธีแก้ไข", r.workaround],
  ];

  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
            {index + 1}
          </span>
          <TriangleAlert className="size-4 shrink-0 text-warning" />
          <p className="truncate text-sm font-medium">{r.incident_no ?? "ไม่ระบุเลข incident"}</p>
        </div>
        <Relevance score={r.score} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{r.source}</Badge>
        {r.service && <Badge variant="secondary">{r.service}</Badge>}
      </div>

      <dl className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[76px_1fr] gap-2">
            <dt className="text-xs font-semibold text-foreground">{label}</dt>
            <dd className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {value?.trim() ? value : "—"}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  createCaseCategory,
  deleteCaseCategory,
  getSettings,
  linkIncidentCategory,
  listCaseCategories,
  listLinkedIncidentsBrief,
  unlinkIncidentCategory,
  updateCaseCategory,
  type CaseCategory,
} from "@/lib/notebook-api";
import { getToken } from "@/lib/auth";

export const Route = createFileRoute("/known-issues")({
  head: () => ({
    meta: [{ title: "หมวดปัญหา — Notebook RAG" }],
  }),
  component: KnownIssuesPage,
});

function KnownIssuesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!getToken()) void navigate({ to: "/login" });
  }, [navigate]);

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const isAdmin = settingsQuery.data?.is_admin ?? false;

  useEffect(() => {
    if (settingsQuery.data && !isAdmin) void navigate({ to: "/" });
  }, [settingsQuery.data, isAdmin, navigate]);

  const caseCategoriesQuery = useQuery({
    queryKey: ["case-categories"],
    queryFn: listCaseCategories,
    enabled: isAdmin,
  });

  const incidentsBriefQuery = useQuery({
    queryKey: ["incidents-brief"],
    queryFn: listLinkedIncidentsBrief,
    enabled: isAdmin,
  });

  const [newCatName, setNewCatName] = useState("");
  const [newCatService, setNewCatService] = useState("");
  const [newCatDetail, setNewCatDetail] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);

  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatService, setEditCatService] = useState("");
  const [editCatDetail, setEditCatDetail] = useState("");

  const [linkInputs, setLinkInputs] = useState<Record<number, string>>({});

  const handleCreateCategory = async () => {
    const name = newCatName.trim();
    const detail = newCatDetail.trim();
    if (!name || !detail) return;
    setCreatingCat(true);
    try {
      await createCaseCategory(
        newCatService ? { name, service: newCatService, detail } : { name, detail },
      );
      setNewCatName("");
      setNewCatService("");
      setNewCatDetail("");
      await queryClient.invalidateQueries({ queryKey: ["case-categories"] });
      toast.success(`เพิ่มหมวดปัญหา "${name}" แล้ว`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เพิ่มหมวดปัญหาไม่สำเร็จ");
    } finally {
      setCreatingCat(false);
    }
  };

  const startEditCategory = (cat: CaseCategory) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatService(cat.service ?? "");
    setEditCatDetail(cat.detail);
  };

  const handleSaveCategory = async (id: number) => {
    const name = editCatName.trim();
    const detail = editCatDetail.trim();
    if (!name || !detail) return;
    try {
      await updateCaseCategory(id, { name, service: editCatService, detail });
      setEditingCatId(null);
      await queryClient.invalidateQueries({ queryKey: ["case-categories"] });
      toast.success("บันทึกหมวดปัญหาแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (!window.confirm(`ลบหมวดปัญหา "${name}" ออกจากระบบ ต้องการดำเนินการต่อหรือไม่?`)) return;
    try {
      await deleteCaseCategory(id);
      await queryClient.invalidateQueries({ queryKey: ["case-categories"] });
      await queryClient.invalidateQueries({ queryKey: ["incidents-brief"] });
      toast.success(`ลบหมวดปัญหา "${name}" แล้ว`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  };

  const handleLinkIncident = async (categoryId: number) => {
    const incidentNo = (linkInputs[categoryId] ?? "").trim();
    if (!incidentNo) return;
    try {
      await linkIncidentCategory(categoryId, incidentNo);
      setLinkInputs((prev) => ({ ...prev, [categoryId]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["incidents-brief"] });
      await queryClient.invalidateQueries({ queryKey: ["case-categories"] });
      toast.success(`ผูก incident ${incidentNo} แล้ว`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "ผูก incident ไม่สำเร็จ (ตรวจสอบเลข incident_no)",
      );
    }
  };

  const handleUnlinkIncident = async (incidentNo: string) => {
    try {
      await unlinkIncidentCategory(incidentNo);
      await queryClient.invalidateQueries({ queryKey: ["incidents-brief"] });
      await queryClient.invalidateQueries({ queryKey: ["case-categories"] });
      toast.success(`ปลด incident ${incidentNo} ออกจากหมวดแล้ว`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ปลดไม่สำเร็จ");
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="mx-auto min-h-screen max-w-2xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="กลับ">
          <Link to="/">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">หมวดปัญหา (Known Issue)</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4" />
            จัดการหมวดปัญหา
          </CardTitle>
          <CardDescription>
            เขียนขั้นตอนการตรวจสอบโดยละเอียด (SQL / วิธีนำทางในระบบ / checklist) ไว้ 1 ชุดต่อหมวด
            แล้วผูก incident ที่คล้ายกันหลายเคสเข้าหมวดเดียวกัน — เวลาถามคำถามที่ตรงกับ incident
            เหล่านี้ ระบบจะดึงขั้นตอนตรวจสอบมาช่วยตอบให้อัตโนมัติ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground">เพิ่มหมวดปัญหาใหม่</p>
            <Input
              placeholder="ชื่อหมวดปัญหา เช่น สลิปเงินเดือนแสดงยอดผิด"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
            <Select value={newCatService} onValueChange={setNewCatService}>
              <SelectTrigger>
                <SelectValue placeholder="Service (ไม่บังคับ)" />
              </SelectTrigger>
              <SelectContent>
                {settingsQuery.data?.channels.map((ch) => (
                  <SelectItem key={ch} value={ch}>
                    {ch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="ขั้นตอนการตรวจสอบโดยละเอียด เช่น SQL query, ฟิลด์ที่ต้องเช็ค, วิธีนำทางในระบบ"
              rows={4}
              value={newCatDetail}
              onChange={(e) => setNewCatDetail(e.target.value)}
            />
            <Button
              onClick={() => void handleCreateCategory()}
              disabled={creatingCat || !newCatName.trim() || !newCatDetail.trim()}
            >
              {creatingCat && <Loader2 className="size-4 animate-spin" />}
              <Plus className="size-4" />
              เพิ่มหมวดปัญหา
            </Button>
          </div>

          {caseCategoriesQuery.isLoading && (
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          )}
          {caseCategoriesQuery.data?.categories.length === 0 && (
            <p className="text-sm text-muted-foreground">ยังไม่มีหมวดปัญหา</p>
          )}

          {caseCategoriesQuery.data?.categories.map((cat) => {
            const linkedIncidents =
              incidentsBriefQuery.data?.incidents.filter((i) => i.case_category_id === cat.id) ??
              [];
            const isEditing = editingCatId === cat.id;

            return (
              <div key={cat.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">{cat.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {cat.service && <Badge variant="outline">{cat.service}</Badge>}
                      <Badge variant="secondary">{cat.incident_count} incident ผูกอยู่</Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => (isEditing ? setEditingCatId(null) : startEditCategory(cat))}
                      aria-label={`แก้ไข ${cat.name}`}
                    >
                      {isEditing ? <X className="size-4" /> : <Pencil className="size-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDeleteCategory(cat.id, cat.name)}
                      aria-label={`ลบ ${cat.name}`}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <Input value={editCatName} onChange={(e) => setEditCatName(e.target.value)} />
                    <Select value={editCatService} onValueChange={setEditCatService}>
                      <SelectTrigger>
                        <SelectValue placeholder="Service (ไม่บังคับ)" />
                      </SelectTrigger>
                      <SelectContent>
                        {settingsQuery.data?.channels.map((ch) => (
                          <SelectItem key={ch} value={ch}>
                            {ch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      rows={4}
                      value={editCatDetail}
                      onChange={(e) => setEditCatDetail(e.target.value)}
                    />
                    <Button
                      size="sm"
                      onClick={() => void handleSaveCategory(cat.id)}
                      disabled={!editCatName.trim() || !editCatDetail.trim()}
                    >
                      บันทึก
                    </Button>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">{cat.detail}</p>
                )}

                <div className="space-y-1.5 border-t pt-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Incident ที่ผูกอยู่
                  </p>
                  {linkedIncidents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">ยังไม่มี incident ที่ผูก</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {linkedIncidents.map((inc) => (
                        <Badge
                          key={inc.incident_no}
                          variant="secondary"
                          className="gap-1.5 py-1.5 pl-3 pr-1.5"
                        >
                          {inc.incident_no}
                          <button
                            type="button"
                            onClick={() => void handleUnlinkIncident(inc.incident_no)}
                            aria-label={`ปลด ${inc.incident_no} ออกจากหมวด`}
                            className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder="incident_no ที่จะผูกเพิ่ม"
                      value={linkInputs[cat.id] ?? ""}
                      onChange={(e) =>
                        setLinkInputs((prev) => ({ ...prev, [cat.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleLinkIncident(cat.id);
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={() => void handleLinkIncident(cat.id)}
                      disabled={!(linkInputs[cat.id] ?? "").trim()}
                    >
                      ผูก
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

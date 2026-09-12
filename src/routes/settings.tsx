import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  addChannel,
  clearMyAiSettings,
  getMyAiSettings,
  getSettings,
  grantUserPermission,
  listUsers,
  removeChannel,
  revokeUserPermission,
  updateMyAiSettings,
  type AiProvider,
} from "@/lib/notebook-api";
import { getToken } from "@/lib/auth";

const PROVIDER_INFO: Record<
  AiProvider,
  { label: string; modelPlaceholder: string; keyPlaceholder: string; showBaseUrl: boolean }
> = {
  typhoon: {
    label: "Typhoon",
    modelPlaceholder: "typhoon-v2.5-30b-a3b-instruct",
    keyPlaceholder: "sk-...",
    showBaseUrl: true,
  },
  openai: {
    label: "OpenAI",
    modelPlaceholder: "gpt-4o-mini",
    keyPlaceholder: "sk-...",
    showBaseUrl: true,
  },
  anthropic: {
    label: "Anthropic (Claude)",
    modelPlaceholder: "claude-3-5-sonnet-20241022",
    keyPlaceholder: "sk-ant-...",
    showBaseUrl: false,
  },
  gemini: {
    label: "Google Gemini",
    modelPlaceholder: "gemini-2.0-flash",
    keyPlaceholder: "AIza...",
    showBaseUrl: true,
  },
};

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "ตั้งค่า — Notebook RAG" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!getToken()) void navigate({ to: "/login" });
  }, [navigate]);

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const isAdmin = settingsQuery.data?.is_admin ?? false;

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: listUsers,
    enabled: isAdmin,
  });

  const myAiQuery = useQuery({ queryKey: ["my-ai-settings"], queryFn: getMyAiSettings });

  const [newChannel, setNewChannel] = useState("");

  const [myProvider, setMyProvider] = useState<AiProvider>("typhoon");
  const [myModel, setMyModel] = useState("");
  const [myApiKey, setMyApiKey] = useState("");
  const [myBaseUrl, setMyBaseUrl] = useState("");
  const [savingMyAi, setSavingMyAi] = useState(false);

  useEffect(() => {
    if (!myAiQuery.data) return;
    setMyProvider(myAiQuery.data.ai_provider ?? "typhoon");
    setMyModel(myAiQuery.data.ai_model ?? "");
    setMyBaseUrl(myAiQuery.data.ai_base_url ?? "");
  }, [myAiQuery.data]);

  const saveMyAi = async () => {
    setSavingMyAi(true);
    try {
      const patch: {
        ai_provider?: AiProvider;
        ai_model?: string;
        ai_api_key?: string;
        ai_base_url?: string;
      } = { ai_provider: myProvider };
      if (myModel.trim()) patch.ai_model = myModel.trim();
      if (myApiKey.trim()) patch.ai_api_key = myApiKey.trim();
      if (myBaseUrl.trim()) patch.ai_base_url = myBaseUrl.trim();
      await updateMyAiSettings(patch);
      setMyApiKey("");
      await queryClient.invalidateQueries({ queryKey: ["my-ai-settings"] });
      toast.success("บันทึกการตั้งค่า AI ของคุณแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingMyAi(false);
    }
  };

  const resetMyAi = async () => {
    try {
      await clearMyAiSettings();
      setMyApiKey("");
      setMyBaseUrl("");
      await queryClient.invalidateQueries({ queryKey: ["my-ai-settings"] });
      toast.success("กลับไปใช้ค่าระบบ default แล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ล้างค่าไม่สำเร็จ");
    }
  };

  const handleAddChannel = async () => {
    const name = newChannel.trim();
    if (!name) return;
    try {
      await addChannel(name);
      setNewChannel("");
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success(`เพิ่ม channel "${name}" แล้ว`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เพิ่ม channel ไม่สำเร็จ");
    }
  };

  const handleRemoveChannel = async (name: string) => {
    try {
      await removeChannel(name);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success(`ลบ channel "${name}" แล้ว`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  };

  const handleTogglePermission = async (username: string, service: string, granted: boolean) => {
    try {
      if (granted) {
        await revokeUserPermission(username, service);
      } else {
        await grantUserPermission(username, service);
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "แก้ไขสิทธิ์ไม่สำเร็จ");
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-2xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="กลับ">
          <Link to="/">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">ตั้งค่า</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="size-4" />
            AI ของฉัน
          </CardTitle>
          <CardDescription>
            เลือกผู้ให้บริการ AI และใส่ API key ของคุณเอง — ไม่ตั้งไว้จะใช้ Typhoon กับค่าระบบ
            default แทน
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>ผู้ให้บริการ</Label>
            <Select value={myProvider} onValueChange={(v) => setMyProvider(v as AiProvider)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDER_INFO) as AiProvider[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PROVIDER_INFO[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="my-model">Model</Label>
            <Input
              id="my-model"
              placeholder={PROVIDER_INFO[myProvider].modelPlaceholder}
              value={myModel}
              onChange={(e) => setMyModel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="my-key">API Key</Label>
            <Input
              id="my-key"
              type="password"
              placeholder={
                myAiQuery.data?.ai_api_key_set
                  ? "•••••••••••• (ตั้งไว้แล้ว — พิมพ์ใหม่เพื่อเปลี่ยน)"
                  : PROVIDER_INFO[myProvider].keyPlaceholder
              }
              value={myApiKey}
              onChange={(e) => setMyApiKey(e.target.value)}
            />
          </div>
          {PROVIDER_INFO[myProvider].showBaseUrl && (
            <div className="space-y-1.5">
              <Label htmlFor="my-base-url">Base URL (ไม่บังคับ)</Label>
              <Input
                id="my-base-url"
                placeholder="ปล่อยว่างเพื่อใช้ endpoint เริ่มต้นของผู้ให้บริการ"
                value={myBaseUrl}
                onChange={(e) => setMyBaseUrl(e.target.value)}
              />
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={() => void saveMyAi()} disabled={savingMyAi}>
            {savingMyAi && <Loader2 className="size-4 animate-spin" />}
            บันทึก
          </Button>
          <Button variant="outline" onClick={() => void resetMyAi()}>
            ใช้ค่า default
          </Button>
        </CardFooter>
      </Card>

      {!isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">สิทธิ์การเข้าถึงของคุณ</CardTitle>
            <CardDescription>
              เห็นเฉพาะ service ที่ admin กำหนดให้เท่านั้น ติดต่อ admin หากต้องการเพิ่มสิทธิ์
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(settingsQuery.data?.channels.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">
                  ยังไม่ได้รับสิทธิ์เข้าถึง service ใดเลย
                </p>
              )}
              {settingsQuery.data?.channels.map((name) => (
                <Badge key={name} variant="secondary">
                  {name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">รายชื่อ Service / Channel</CardTitle>
            <CardDescription>
              ใช้เป็นแท็บแยกการสนทนาในหน้าแชท — ไม่เกี่ยวกับ service ที่ผูกกับไฟล์ที่ ingest ไปแล้ว
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="เช่น HR, IT, Finance"
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAddChannel();
                  }
                }}
              />
              <Button onClick={() => void handleAddChannel()} disabled={!newChannel.trim()}>
                <Plus className="size-4" />
                เพิ่ม
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {settingsQuery.data?.channels.length === 0 && (
                <p className="text-sm text-muted-foreground">ยังไม่มี channel</p>
              )}
              {settingsQuery.data?.channels.map((name) => (
                <Badge key={name} variant="secondary" className="gap-1.5 py-1.5 pl-3 pr-1.5">
                  {name}
                  <button
                    type="button"
                    onClick={() => void handleRemoveChannel(name)}
                    aria-label={`ลบ channel ${name}`}
                    className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" />
              สิทธิ์การมองเห็น Service ของแต่ละ User
            </CardTitle>
            <CardDescription>
              user ที่ยังไม่ถูกกำหนดสิทธิ์เลยจะไม่เห็น service ไหนเลย (admin เห็นทุก service เสมอ)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersQuery.isLoading && <p className="text-sm text-muted-foreground">กำลังโหลด...</p>}
            {(settingsQuery.data?.channels.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                ยังไม่มี channel ให้กำหนดสิทธิ์ — เพิ่ม channel ด้านบนก่อน
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">User</th>
                      {settingsQuery.data?.channels.map((ch) => (
                        <th key={ch} className="px-2 py-2 text-center font-medium">
                          {ch}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usersQuery.data?.users.map((u) => (
                      <tr key={u.username} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <span className="font-medium">{u.username}</span>
                          {u.is_admin && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              admin
                            </Badge>
                          )}
                        </td>
                        {settingsQuery.data?.channels.map((ch) => {
                          const granted = u.permissions.includes(ch);
                          return (
                            <td key={ch} className="px-2 py-2 text-center">
                              <Checkbox
                                checked={u.is_admin || granted}
                                disabled={u.is_admin}
                                onCheckedChange={() =>
                                  void handleTogglePermission(u.username, ch, granted)
                                }
                                aria-label={`สิทธิ์ ${u.username} เข้าถึง ${ch}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

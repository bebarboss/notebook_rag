import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { loginUser, loginWithGoogle, registerUser } from "@/lib/notebook-api";
import { setSession } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "เข้าสู่ระบบ — Notebook RAG" }],
  }),
  component: LoginPage,
});

type GoogleCredentialResponse = { credential: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              width?: number;
              text?: string;
            },
          ) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env["VITE_GOOGLE_CLIENT_ID"] as string | undefined;

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      const res =
        mode === "login"
          ? await loginUser(username.trim(), password)
          : await registerUser(username.trim(), password);
      setSession(res.access_token, res.username);
      toast.success(mode === "login" ? "เข้าสู่ระบบสำเร็จ" : "สมัครสมาชิกสำเร็จ");
      void navigate({ to: "/" });
    } catch (e) {
      const detail = e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ";
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const handleCredentialResponse = async (response: GoogleCredentialResponse) => {
      setLoading(true);
      try {
        const res = await loginWithGoogle(response.credential);
        setSession(res.access_token, res.username);
        toast.success("เข้าสู่ระบบด้วย Google สำเร็จ");
        void navigate({ to: "/" });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };

    const initGoogle = () => {
      if (!window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => void handleCredentialResponse(response),
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
      });
    };

    if (window.google) {
      initGoogle();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <Sparkles className="size-6" />
          </div>
          <CardTitle className="text-xl">Notebook RAG</CardTitle>
          <CardDescription>เข้าสู่ระบบเพื่อค้นหาเอกสารและ incident ด้วย AI</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "login" | "register")}
            className="mb-4"
          >
            <TabsList className="w-full">
              <TabsTrigger value="login" className="flex-1">
                เข้าสู่ระบบ
              </TabsTrigger>
              <TabsTrigger value="register" className="flex-1">
                สมัครสมาชิก
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="username">ชื่อผู้ใช้</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={mode === "register" ? 6 : undefined}
                required
              />
              {mode === "register" && (
                <p className="text-xs text-muted-foreground">อย่างน้อย 6 ตัวอักษร</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
            </Button>
          </form>

          {GOOGLE_CLIENT_ID && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">หรือ</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div ref={googleButtonRef} className="flex justify-center" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

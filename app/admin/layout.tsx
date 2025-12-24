"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

import { AdminLayout } from "@/components/admin";
import { useClerkSupabaseClient } from "@/lib/supabase/clerk-client";

/**
 * 관리자 페이지 레이아웃
 *
 * 관리자 권한 검증 및 사이드바 레이아웃을 제공합니다.
 * 모바일에서는 햄버거 메뉴, 데스크톱에서는 고정 사이드바로 표시됩니다.
 */
export default function AdminLayoutPage({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signOut } = useClerk();
  const supabase = useClerkSupabaseClient();

  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);
  const [adminRole, setAdminRole] = React.useState<"admin" | "super_admin">(
    "admin"
  );
  const [unresolvedCount, setUnresolvedCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);

  // 관리자 권한 확인
  React.useEffect(() => {
    async function checkAdmin() {
      if (!isUserLoaded) return;

      if (!user) {
        router.push("/sign-in?redirect_url=/admin");
        return;
      }

      try {
        // 관리자 테이블에서 권한 확인
        const { data: adminUser, error } = await supabase
          .from("admin_users")
          .select("role")
          .eq("clerk_id", user.id)
          .single();

        if (error || !adminUser) {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }

        setIsAdmin(true);
        setAdminRole(adminUser.role as "admin" | "super_admin");

        // 미해결 에러 수 조회
        const { count } = await supabase
          .from("error_logs")
          .select("*", { count: "exact", head: true })
          .eq("resolved", false);

        setUnresolvedCount(count ?? 0);
        setIsLoading(false);
      } catch (error) {
        console.error("관리자 권한 확인 오류:", error);
        setIsAdmin(false);
        setIsLoading(false);
      }
    }

    checkAdmin();
  }, [isUserLoaded, user, supabase, router]);

  // 로그아웃 핸들러
  const handleLogout = async () => {
    await signOut({ redirectUrl: "/" });
  };

  // 로딩 중
  if (isLoading || !isUserLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">권한을 확인하는 중...</p>
        </div>
      </div>
    );
  }

  // 관리자 권한 없음
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-destructive">
            접근 권한 없음
          </h1>
          <p className="text-muted-foreground mb-6">
            관리자 권한이 필요한 페이지입니다.
          </p>
          <button
            onClick={() => router.push("/")}
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            메인 페이지로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout
      unresolvedErrorCount={unresolvedCount}
      userName={user?.firstName ?? user?.username ?? "관리자"}
      userRole={adminRole}
      onLogout={handleLogout}
    >
      {children}
    </AdminLayout>
  );
}

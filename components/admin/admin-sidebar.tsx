"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================
// Types
// ============================================

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

interface AdminSidebarProps {
  /** 미해결 에러 수 (배지 표시용) */
  unresolvedErrorCount?: number;
  /** 현재 사용자 이름 */
  userName?: string;
  /** 사용자 역할 */
  userRole?: "admin" | "super_admin";
  /** 로그아웃 핸들러 */
  onLogout?: () => void;
  /** 클래스명 */
  className?: string;
}

// ============================================
// Constants
// ============================================

const NAV_ITEMS: NavItem[] = [
  {
    label: "대시보드",
    href: "/admin",
    icon: <LayoutDashboard className="size-5" />,
  },
  {
    label: "에러 로그",
    href: "/admin/error-logs",
    icon: <AlertCircle className="size-5" />,
  },
  {
    label: "통계",
    href: "/admin/statistics",
    icon: <BarChart3 className="size-5" />,
  },
  {
    label: "사용자 관리",
    href: "/admin/users",
    icon: <Users className="size-5" />,
  },
  {
    label: "설정",
    href: "/admin/settings",
    icon: <Settings className="size-5" />,
  },
];

// ============================================
// Helper Components
// ============================================

/**
 * 네비게이션 아이템 컴포넌트
 */
function NavItemComponent({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {item.icon}
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && item.badge !== 0 && (
        <Badge
          variant={item.badgeVariant || "secondary"}
          className={cn(
            "ml-auto size-5 justify-center rounded-full p-0 text-xs",
            isActive && "bg-primary-foreground text-primary"
          )}
        >
          {typeof item.badge === "number" && item.badge > 99
            ? "99+"
            : item.badge}
        </Badge>
      )}
    </Link>
  );
}

/**
 * 사이드바 컨텐츠 컴포넌트
 */
function SidebarContent({
  navItems,
  pathname,
  userName,
  userRole,
  onLogout,
  onNavClick,
}: {
  navItems: NavItem[];
  pathname: string;
  userName?: string;
  userRole?: "admin" | "super_admin";
  onLogout?: () => void;
  onNavClick?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* 로고/헤더 */}
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/admin" className="flex items-center gap-2">
          <Shield className="size-6 text-primary" />
          <span className="text-lg font-bold">OurRoad Admin</span>
        </Link>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map((item) => (
          <NavItemComponent
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            onClick={onNavClick}
          />
        ))}
      </nav>

      {/* 하단 영역 */}
      <div className="border-t p-4">
        {/* 메인 사이트 링크 */}
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Home className="size-5" />
          <span>메인 사이트로</span>
        </Link>

        {/* 사용자 정보 */}
        {userName && (
          <div className="mt-4 rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{userName}</p>
                <p className="text-muted-foreground text-xs">
                  {userRole === "super_admin" ? "Super Admin" : "Admin"}
                </p>
              </div>
            </div>
            {onLogout && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-start"
                onClick={onLogout}
              >
                <LogOut className="mr-2 size-4" />
                로그아웃
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 사이드바 스켈레톤
 */
function SidebarSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b px-4">
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="flex-1 space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="border-t p-4">
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

/**
 * 관리자 사이드바 컴포넌트
 *
 * 관리자 페이지의 좌측 사이드바입니다.
 * 데스크톱에서는 고정형, 모바일에서는 햄버거 메뉴로 표시됩니다.
 *
 * @example
 * ```tsx
 * <AdminSidebar
 *   unresolvedErrorCount={15}
 *   userName="관리자"
 *   userRole="super_admin"
 *   onLogout={() => signOut()}
 * />
 * ```
 */
export function AdminSidebar({
  unresolvedErrorCount = 0,
  userName,
  userRole,
  onLogout,
  className,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);

  // 네비게이션 아이템에 배지 추가
  const navItems = NAV_ITEMS.map((item) => {
    if (item.href === "/admin/error-logs" && unresolvedErrorCount > 0) {
      return {
        ...item,
        badge: unresolvedErrorCount,
        badgeVariant: "destructive" as const,
      };
    }
    return item;
  });

  return (
    <>
      {/* 데스크톱 사이드바 */}
      <aside
        className={cn(
          "hidden h-screen w-64 shrink-0 border-r bg-background md:block",
          className
        )}
      >
        <SidebarContent
          navItems={navItems}
          pathname={pathname}
          userName={userName}
          userRole={userRole}
          onLogout={onLogout}
        />
      </aside>

      {/* 모바일 헤더 바 */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center gap-4 border-b bg-background px-4 md:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="relative size-10">
              <Menu className="size-5" />
              <span className="sr-only">메뉴 열기</span>
              {unresolvedErrorCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -right-1 -top-1 size-5 justify-center rounded-full p-0 text-xs"
                >
                  {unresolvedErrorCount > 9 ? "9+" : unresolvedErrorCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 sm:w-72">
            {/* 접근성을 위한 숨겨진 제목 */}
            <SheetTitle className="sr-only">관리자 메뉴</SheetTitle>
            <SidebarContent
              navItems={navItems}
              pathname={pathname}
              userName={userName}
              userRole={userRole}
              onLogout={onLogout}
              onNavClick={() => setIsOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* 로고 */}
        <Link href="/admin" className="flex items-center gap-2">
          <Shield className="size-5 text-primary" />
          <span className="font-semibold">OurRoad Admin</span>
        </Link>
      </header>
    </>
  );
}

/**
 * 미니멀 사이드바 컴포넌트 (아이콘만)
 */
export function AdminSidebarMinimal({
  unresolvedErrorCount = 0,
  className,
}: Pick<AdminSidebarProps, "unresolvedErrorCount" | "className">) {
  const pathname = usePathname();

  const navItems = NAV_ITEMS.map((item) => {
    if (item.href === "/admin/error-logs" && unresolvedErrorCount > 0) {
      return {
        ...item,
        badge: unresolvedErrorCount,
        badgeVariant: "destructive" as const,
      };
    }
    return item;
  });

  return (
    <aside
      className={cn(
        "hidden h-screen w-16 shrink-0 border-r bg-background md:flex md:flex-col",
        className
      )}
    >
      {/* 로고 */}
      <div className="flex h-16 items-center justify-center border-b">
        <Link href="/admin">
          <Shield className="size-6 text-primary" />
        </Link>
      </div>

      {/* 네비게이션 */}
      <nav className="flex flex-1 flex-col items-center gap-2 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex size-10 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={item.label}
            >
              {item.icon}
              {item.badge !== undefined && item.badge !== 0 && (
                <Badge
                  variant={item.badgeVariant || "secondary"}
                  className="absolute -right-1 -top-1 size-4 justify-center rounded-full p-0 text-[10px]"
                >
                  {typeof item.badge === "number" && item.badge > 9
                    ? "9+"
                    : item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 하단 */}
      <div className="flex flex-col items-center gap-2 border-t py-4">
        <Link
          href="/"
          className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="메인 사이트로"
        >
          <Home className="size-5" />
        </Link>
      </div>
    </aside>
  );
}

/**
 * 관리자 헤더 컴포넌트 (모바일용)
 */
export function AdminHeader({
  title,
  unresolvedErrorCount = 0,
  onMenuClick,
  className,
}: {
  title: string;
  unresolvedErrorCount?: number;
  onMenuClick?: () => void;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden",
        className
      )}
    >
      <Button variant="ghost" size="icon" onClick={onMenuClick}>
        <Menu className="size-5" />
        {unresolvedErrorCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -right-1 -top-1 size-4 justify-center rounded-full p-0 text-[10px]"
          >
            {unresolvedErrorCount > 9 ? "9+" : unresolvedErrorCount}
          </Badge>
        )}
      </Button>
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}

/**
 * 관리자 레이아웃 컴포넌트
 *
 * 사이드바와 메인 컨텐츠를 포함하는 레이아웃입니다.
 */
export function AdminLayout({
  children,
  unresolvedErrorCount = 0,
  userName,
  userRole,
  onLogout,
}: AdminSidebarProps & { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        unresolvedErrorCount={unresolvedErrorCount}
        userName={userName}
        userRole={userRole}
        onLogout={onLogout}
      />
      <main className="flex-1 overflow-y-auto">
        {/* 모바일 헤더 영역 공간 확보 */}
        <div className="h-16 md:hidden" />
        {children}
      </main>
    </div>
  );
}

// Export helper components
export { SidebarContent, SidebarSkeleton, NavItemComponent };

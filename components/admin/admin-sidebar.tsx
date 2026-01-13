"use client";

import * as React from "react";
import Image from "next/image";
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
  /** 誘명빐寃??먮윭 ??(諛곗? ?쒖떆?? */
  unresolvedErrorCount?: number;
  /** ?꾩옱 ?ъ슜???대쫫 */
  userName?: string;
  /** ?ъ슜????븷 */
  userRole?: "admin" | "super_admin";
  /** 濡쒓렇?꾩썐 ?몃뱾??*/
  onLogout?: () => void;
  /** ?대옒?ㅻ챸 */
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
 * ?ㅻ퉬寃뚯씠???꾩씠??而댄룷?뚰듃
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
 * ?ъ씠?쒕컮 而⑦뀗痢?而댄룷?뚰듃
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
      {/* 濡쒓퀬/?ㅻ뜑 */}
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/admin" className="flex items-center gap-2">
          <Image
            src="/RUrogo.png"
            alt="RootUs logo"
            width={28}
            height={28}
            className="h-7 w-7 rounded-md"
          />
          <span className="text-lg font-bold">RootUs Admin</span>
        </Link>
      </div>

      {/* ?ㅻ퉬寃뚯씠??*/}
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

      {/* ?섎떒 ?곸뿭 */}
      <div className="border-t p-4">
        {/* 硫붿씤 ?ъ씠??留곹겕 */}
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Home className="size-5" />
          <span>메인 사이트로</span>
        </Link>

        {/* ?ъ슜???뺣낫 */}
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
 * ?ъ씠?쒕컮 ?ㅼ펷?덊넠
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
 * 愿由ъ옄 ?ъ씠?쒕컮 而댄룷?뚰듃
 *
 * 愿由ъ옄 ?섏씠吏??醫뚯륫 ?ъ씠?쒕컮?낅땲??
 * ?곗뒪?ы넲?먯꽌??怨좎젙?? 紐⑤컮?쇱뿉?쒕뒗 ?꾨쾭嫄?硫붾돱濡??쒖떆?⑸땲??
 *
 * @example
 * ```tsx
 * <AdminSidebar
 *   unresolvedErrorCount={15}
 *   userName="愿由ъ옄"
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

  // ?ㅻ퉬寃뚯씠???꾩씠?쒖뿉 諛곗? 異붽?
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
      {/* ?곗뒪?ы넲 ?ъ씠?쒕컮 */}
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

      {/* 紐⑤컮???ㅻ뜑 諛?*/}
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
            {/* 접근성을 위한 숨김 제목 */}
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

        {/* 濡쒓퀬 */}
        <Link href="/admin" className="flex items-center gap-2">
          <Image
            src="/RUrogo.png"
            alt="RootUs logo"
            width={24}
            height={24}
            className="h-6 w-6 rounded-md"
          />
          <span className="font-semibold">RootUs Admin</span>
        </Link>
      </header>
    </>
  );
}

/**
 * 誘몃땲硫 ?ъ씠?쒕컮 而댄룷?뚰듃 (?꾩씠肄섎쭔)
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
      {/* 濡쒓퀬 */}
      <div className="flex h-16 items-center justify-center border-b">
        <Link href="/admin">
          <Shield className="size-6 text-primary" />
        </Link>
      </div>

      {/* ?ㅻ퉬寃뚯씠??*/}
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

      {/* ?섎떒 */}
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
 * 愿由ъ옄 ?ㅻ뜑 而댄룷?뚰듃 (紐⑤컮?쇱슜)
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
 * 愿由ъ옄 ?덉씠?꾩썐 而댄룷?뚰듃
 *
 * ?ъ씠?쒕컮? 硫붿씤 而⑦뀗痢좊? ?ы븿?섎뒗 ?덉씠?꾩썐?낅땲??
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
        {/* 紐⑤컮???ㅻ뜑 ?곸뿭 怨듦컙 ?뺣낫 */}
        <div className="h-16 md:hidden" />
        {children}
      </main>
    </div>
  );
}

// Export helper components
export { SidebarContent, SidebarSkeleton, NavItemComponent };

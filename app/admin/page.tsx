"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Info,
  TrendingUp,
  XCircle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorStatistics, getErrorLogs } from "@/actions/admin";
import type { ErrorStatistics, ErrorLog, ErrorSeverity } from "@/types/admin";
import { SeverityBadge } from "@/components/admin";

/**
 * 관리자 대시보드 페이지
 *
 * 에러 통계 요약 및 최근 에러 로그를 표시합니다.
 */
export default function AdminDashboardPage() {
  const [statistics, setStatistics] = React.useState<ErrorStatistics | null>(
    null
  );
  const [recentErrors, setRecentErrors] = React.useState<ErrorLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // 데이터 로드
  React.useEffect(() => {
    async function loadData() {
      try {
        const [statsResult, logsResult] = await Promise.all([
          getErrorStatistics(),
          getErrorLogs({ limit: 5, resolved: false }),
        ]);

        if (statsResult.success && statsResult.data) {
          setStatistics(statsResult.data);
        } else {
          setError(statsResult.error ?? "통계를 불러오지 못했습니다.");
        }

        if (logsResult.success && logsResult.data) {
          setRecentErrors(logsResult.data.data);
        }
      } catch (err) {
        console.error("데이터 로드 오류:", err);
        setError("데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 size-8 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">{error}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <p className="text-muted-foreground mt-1">
          서비스 현황 및 에러 통계를 확인할 수 있습니다.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="전체 에러"
          value={statistics?.totalErrors ?? 0}
          icon={<BarChart3 className="size-5" />}
          description="누적 에러 수"
        />
        <StatCard
          title="미해결 에러"
          value={statistics?.unresolvedErrors ?? 0}
          icon={<AlertCircle className="size-5" />}
          description="처리 대기 중"
          variant={
            (statistics?.unresolvedErrors ?? 0) > 0 ? "destructive" : "default"
          }
        />
        <StatCard
          title="최근 24시간"
          value={statistics?.last24Hours ?? 0}
          icon={<Clock className="size-5" />}
          description="오늘 발생한 에러"
        />
        <StatCard
          title="최근 7일"
          value={statistics?.last7Days ?? 0}
          icon={<TrendingUp className="size-5" />}
          description="이번 주 발생한 에러"
        />
      </div>

      {/* 심각도별 분포 */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">심각도별 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(
                ["critical", "error", "warning", "info"] as ErrorSeverity[]
              ).map((severity) => {
                const count = statistics?.bySeverity[severity] ?? 0;
                const total = statistics?.totalErrors ?? 1;
                const percentage = total > 0 ? (count / total) * 100 : 0;

                return (
                  <SeverityBar
                    key={severity}
                    severity={severity}
                    count={count}
                    percentage={percentage}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 최다 에러 코드 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">자주 발생하는 에러</CardTitle>
          </CardHeader>
          <CardContent>
            {statistics?.byErrorCode &&
            Object.keys(statistics.byErrorCode).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(statistics.byErrorCode)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([code, count]) => (
                    <div
                      key={code}
                      className="flex items-center justify-between"
                    >
                      <span className="font-mono text-sm">{code}</span>
                      <Badge variant="secondary">{count}건</Badge>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center text-sm">
                에러 데이터가 없습니다.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 최근 미해결 에러 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">최근 미해결 에러</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/error-logs">
              전체 보기
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentErrors.length > 0 ? (
            <div className="space-y-3">
              {recentErrors.map((log) => (
                <Link
                  key={log.id}
                  href={`/admin/error-logs?highlight=${log.id}`}
                  className="block rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <SeverityBadge severity={log.severity} />
                    <span className="text-muted-foreground ml-auto text-xs">
                      {format(new Date(log.createdAt), "MM.dd HH:mm", {
                        locale: ko,
                      })}
                    </span>
                  </div>
                  <p className="font-mono text-sm font-medium">
                    {log.errorCode}
                  </p>
                  <p className="text-muted-foreground mt-1 line-clamp-1 text-sm">
                    {log.errorMessage}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="mb-3 size-10 text-green-500" />
              <p className="font-medium">미해결 에러가 없습니다!</p>
              <p className="text-muted-foreground mt-1 text-sm">
                모든 에러가 처리되었습니다.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

function StatCard({
  title,
  value,
  icon,
  description,
  variant = "default",
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  description: string;
  variant?: "default" | "destructive";
}) {
  return (
    <Card
      className={
        variant === "destructive" ? "border-destructive/50 bg-destructive/5" : ""
      }
    >
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div
            className={`rounded-lg p-2 ${
              variant === "destructive"
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            }`}
          >
            {icon}
          </div>
          <span
            className={`text-3xl font-bold ${
              variant === "destructive" ? "text-destructive" : ""
            }`}
          >
            {value.toLocaleString()}
          </span>
        </div>
        <div className="mt-3">
          <p className="font-medium">{title}</p>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SeverityBar({
  severity,
  count,
  percentage,
}: {
  severity: ErrorSeverity;
  count: number;
  percentage: number;
}) {
  const config: Record<
    ErrorSeverity,
    { icon: React.ReactNode; label: string; color: string }
  > = {
    critical: {
      icon: <XCircle className="size-4" />,
      label: "치명적",
      color: "bg-purple-500",
    },
    error: {
      icon: <AlertCircle className="size-4" />,
      label: "에러",
      color: "bg-red-500",
    },
    warning: {
      icon: <AlertTriangle className="size-4" />,
      label: "경고",
      color: "bg-yellow-500",
    },
    info: {
      icon: <Info className="size-4" />,
      label: "정보",
      color: "bg-blue-500",
    },
  };

  const { icon, label, color } = config[severity];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className={`rounded p-1 ${color} text-white`}>{icon}</span>
          <span>{label}</span>
        </div>
        <span className="font-medium">{count}건</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${Math.max(percentage, 1)}%` }}
        />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-5 w-64" />
      </div>

      {/* 통계 카드 */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <Skeleton className="size-10 rounded-lg" />
                <Skeleton className="h-8 w-16" />
              </div>
              <div className="mt-3 space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 차트 영역 */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 최근 에러 */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="ml-auto h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-4 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

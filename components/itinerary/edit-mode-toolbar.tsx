/**
 * @file edit-mode-toolbar.tsx
 * @description 편집 모드 툴바 컴포넌트
 *
 * 편집 모드 하단에 표시되는 툴바입니다.
 * 편집 종료, 경로 재계산 버튼과 자동 저장 상태를 표시합니다.
 *
 * @dependencies
 * - react
 * - @/components/ui/button: Button
 */

"use client";

import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditModeToolbarProps {
  onExit: () => void;
  onRecalculate: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  isRecalculating: boolean;
}

export function EditModeToolbar({
  onExit,
  onRecalculate,
  saveStatus,
  isRecalculating,
}: EditModeToolbarProps) {
  const getSaveStatusIcon = () => {
    switch (saveStatus) {
      case "saving":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "saved":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case "saving":
        return "저장 중...";
      case "saved":
        return "저장됨";
      case "error":
        return "저장 실패";
      default:
        return "";
    }
  };

  return (
    <div className="sticky bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* 저장 상태 */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getSaveStatusIcon()}
            <span>{getSaveStatusText()}</span>
          </div>

          {/* 버튼 영역 */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onExit}
              disabled={saveStatus === "saving" || isRecalculating}
            >
              편집 종료
            </Button>
            <Button
              variant="default"
              onClick={onRecalculate}
              disabled={saveStatus === "saving" || isRecalculating}
              className="gap-2"
            >
              {isRecalculating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  재계산 중...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  경로 재계산
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


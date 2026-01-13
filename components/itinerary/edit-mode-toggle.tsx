/**
 * @file edit-mode-toggle.tsx
 * @description 편집 모드 토글 버튼 컴포넌트
 *
 * 일정 편집 모드를 켜고 끄는 토글 버튼입니다.
 * 읽기 모드에서는 "편집 모드" 버튼을, 편집 모드에서는 "완료" / "취소" 버튼을 표시합니다.
 *
 * @dependencies
 * - react
 * - @/components/ui/button: Button
 * - lucide-react: 아이콘
 */

"use client";

import { Button } from "@/components/ui/button";
import { Edit, Check, X } from "lucide-react";

interface EditModeToggleProps {
  isEditing: boolean;
  onToggle: () => void;
  onCancel?: () => void;
}

export function EditModeToggle({
  isEditing,
  onToggle,
  onCancel,
}: EditModeToggleProps) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel || onToggle}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          취소
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onToggle}
          className="gap-2"
        >
          <Check className="h-4 w-4" />
          완료
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onToggle}
      className="gap-2"
    >
      <Edit className="h-4 w-4" />
      편집 모드
    </Button>
  );
}


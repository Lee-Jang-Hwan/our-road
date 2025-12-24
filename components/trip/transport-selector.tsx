"use client";

import * as React from "react";
import { Car, TrainFront, Footprints, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { TransportMode } from "@/types/route";

interface TransportOption {
  value: TransportMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const transportOptions: TransportOption[] = [
  {
    value: "public",
    label: "대중교통",
    description: "도보 + 대중교통",
    icon: <TrainFront className="h-5 w-5" />,
  },
  {
    value: "car",
    label: "자동차",
    description: "자가용/렌터카",
    icon: <Car className="h-5 w-5" />,
  },
];

interface TransportSelectorProps {
  /** 선택된 이동수단 */
  value: TransportMode[];
  /** 변경 핸들러 */
  onChange: (modes: TransportMode[]) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 다중 선택 허용 여부 */
  multiple?: boolean;
  /** 레이블 */
  label?: string;
  /** 추가 클래스 */
  className?: string;
}

export function TransportSelector({
  value,
  onChange,
  disabled = false,
  multiple = false,
  label = "이동 수단",
  className,
}: TransportSelectorProps) {
  const handleSelect = (mode: TransportMode) => {
    if (disabled) return;

    if (multiple) {
      // 다중 선택 모드
      if (value.includes(mode)) {
        // 최소 1개는 선택되어야 함
        if (value.length > 1) {
          onChange(value.filter((m) => m !== mode));
        }
      } else {
        onChange([...value, mode]);
      }
    } else {
      // 단일 선택 모드
      onChange([mode]);
    }
  };

  const isSelected = (mode: TransportMode) => value.includes(mode);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium text-muted-foreground block">
          {label}
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        {transportOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={isSelected(option.value) ? "default" : "outline"}
            disabled={disabled}
            onClick={() => handleSelect(option.value)}
            className={cn(
              "h-auto flex-col items-center justify-center py-4 px-3 touch-target-lg relative",
              isSelected(option.value) && "ring-2 ring-primary ring-offset-2"
            )}
          >
            {isSelected(option.value) && (
              <div className="absolute top-2 right-2">
                <Check className="h-4 w-4" />
              </div>
            )}
            <div className="mb-2">{option.icon}</div>
            <span className="font-medium text-sm">{option.label}</span>
            <span
              className={cn(
                "text-xs mt-0.5",
                isSelected(option.value)
                  ? "text-primary-foreground/70"
                  : "text-muted-foreground"
              )}
            >
              {option.description}
            </span>
          </Button>
        ))}
      </div>

      {multiple && (
        <p className="text-xs text-muted-foreground">
          여러 이동 수단을 선택할 수 있습니다
        </p>
      )}
    </div>
  );
}

interface TransportChipProps {
  mode: TransportMode;
  className?: string;
}

export function TransportChip({ mode, className }: TransportChipProps) {
  const option = transportOptions.find((o) => o.value === mode);

  if (!option) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
        mode === "public" && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
        mode === "car" && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
        mode === "walking" && "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
        className
      )}
    >
      {React.cloneElement(option.icon as React.ReactElement<{ className?: string }>, {
        className: "h-3 w-3",
      })}
      {option.label}
    </span>
  );
}

export function TransportIcon({
  mode,
  className,
}: {
  mode: TransportMode;
  className?: string;
}) {
  const iconClass = cn("h-4 w-4", className);

  switch (mode) {
    case "public":
      return <TrainFront className={iconClass} />;
    case "car":
      return <Car className={iconClass} />;
    case "walking":
      return <Footprints className={iconClass} />;
    default:
      return null;
  }
}

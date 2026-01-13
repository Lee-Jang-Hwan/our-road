"use client";

import * as React from "react";
import Image from "next/image";
import { Car, TrainFront, Footprints } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { TransportMode } from "@/types/route";

interface TransportOption {
  value: TransportMode;
  label: string;
  imageSrc: string;
  imageAlt: string;
  icon: React.ReactNode;
}

const transportOptions: TransportOption[] = [
  {
    value: "public",
    label: "대중교통+도보",
    imageSrc: "/bus.png",
    imageAlt: "대중교통+도보",
    icon: <TrainFront className="h-5 w-5" />,
  },
  {
    value: "car",
    label: "자동차",
    imageSrc: "/car.png",
    imageAlt: "자동차",
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
  /** 복수 선택 허용 여부 */
  multiple?: boolean;
  /** 라벨 */
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
      if (value.includes(mode)) {
        if (value.length > 1) {
          onChange(value.filter((m) => m !== mode));
        }
      } else {
        onChange([...value, mode]);
      }
    } else {
      onChange([mode]);
    }
  };

  const isSelected = (mode: TransportMode) => value.includes(mode);

  return (
    <div className={cn("space-y-3 px-2", className)}>
      {label && (
        <label className="text-sm font-medium text-muted-foreground block">
          {label}
        </label>
      )}

      <div className="grid grid-cols-2 gap-4">
        {transportOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => handleSelect(option.value)}
            className={cn(
              "group relative aspect-square w-full h-auto overflow-hidden rounded-2xl border border-muted/60 p-0 text-left shadow-sm transition",
              "hover:-translate-y-0.5 hover:border-muted-foreground/30 hover:shadow-md",
              isSelected(option.value) &&
                "border-[rgba(40,110,220,0.55)] ring-2 ring-[rgba(40,110,220,0.35)] shadow-[0_12px_30px_-18px_rgba(40,110,220,0.6)]"
            )}
          >
            <Image
              src={option.imageSrc}
              alt={option.imageAlt}
              fill
              sizes="(max-width: 768px) 50vw, 240px"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white/45 via-white/5 to-transparent" />
            <div
              className={cn(
                "absolute inset-0 transition",
                isSelected(option.value)
                  ? "bg-[rgba(40,110,220,0.2)]"
                  : "bg-transparent"
              )}
            />
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/60" />
            <span className="absolute bottom-0 left-0 right-0 p-3 text-center text-sm font-semibold text-neutral-700 drop-shadow-sm">
              {option.label}
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
        mode === "public" &&
          "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
        mode === "car" &&
          "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
        mode === "walking" &&
          "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
        className
      )}
    >
      {React.cloneElement(
        option.icon as React.ReactElement<{ className?: string }>,
        {
          className: "h-3 w-3",
        }
      )}
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

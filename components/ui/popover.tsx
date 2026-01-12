"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  // Dialog/Sheet 내부에서 사용될 때 클릭 이벤트가 차단되지 않도록 처리
  const handleInteractOutside = React.useCallback(
    (event: Parameters<
      NonNullable<
        React.ComponentProps<typeof PopoverPrimitive.Content>["onInteractOutside"]
      >
    >[0]) => {
      const originalEvent =
        "detail" in event && event.detail?.originalEvent
          ? event.detail.originalEvent
          : (event as any).originalEvent || (event as any);
      const target = (originalEvent?.target || (event as any).target) as
        | HTMLElement
        | null;

      if (!target) {
        if (onInteractOutside) {
          onInteractOutside(event);
        }
        return;
      }

      // Dialog나 Sheet의 content나 overlay를 클릭한 경우
      const isDialogContent = target.closest('[data-slot="dialog-content"]');
      const isSheetContent = target.closest('[data-slot="sheet-content"]');
      const isDialogOverlay = target.closest('[data-slot="dialog-overlay"]');
      const isSheetOverlay = target.closest('[data-slot="sheet-overlay"]');

      // Dialog/Sheet 내부에 있거나 overlay를 클릭한 경우 이벤트를 차단하지 않음
      // (Popover가 닫히지 않도록)
      if (isDialogContent || isSheetContent || isDialogOverlay || isSheetOverlay) {
        event.preventDefault();
        return;
      }

      // 사용자 정의 핸들러 호출
      if (onInteractOutside) {
        onInteractOutside(event);
      }
    },
    [onInteractOutside]
  );

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        onInteractOutside={handleInteractOutside}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[100] w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }

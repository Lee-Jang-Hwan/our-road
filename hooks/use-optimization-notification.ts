"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseOptimizationNotificationOptions {
  title?: string;
  body?: string;
  icon?: string;
}

interface UseOptimizationNotificationReturn {
  /** 알림 권한 요청 */
  requestPermission: () => Promise<boolean>;
  /** 알림 권한 상태 */
  permissionStatus: NotificationPermission | "unsupported";
  /** 최적화 완료 알림 발송 */
  notifyOptimizationComplete: () => void;
  /** 페이지가 보이는지 여부 */
  isPageVisible: boolean;
}

const DEFAULT_TITLE = "경로 최적화 완료";
const DEFAULT_BODY = "여행 일정 최적화가 완료되었습니다!";

// 알림 소리 재생 함수
function playNotificationSound(): void {
  if (typeof window === "undefined") {
    console.log("[알림] window 객체 없음");
    return;
  }

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      console.log("[알림] AudioContext 지원 안됨");
      return;
    }

    const audioContext = new AudioContextClass();
    console.log("[알림] 소리 재생 시작");

    // 첫 번째 음 (A5 - 880Hz)
    const oscillator1 = audioContext.createOscillator();
    const gainNode1 = audioContext.createGain();

    oscillator1.connect(gainNode1);
    gainNode1.connect(audioContext.destination);

    oscillator1.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator1.type = "sine";

    gainNode1.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode1.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.02);
    gainNode1.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);

    oscillator1.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.2);

    // 두 번째 음 (E6 - 1318.5Hz)
    const oscillator2 = audioContext.createOscillator();
    const gainNode2 = audioContext.createGain();

    oscillator2.connect(gainNode2);
    gainNode2.connect(audioContext.destination);

    oscillator2.frequency.setValueAtTime(1318.5, audioContext.currentTime + 0.15);
    oscillator2.type = "sine";

    gainNode2.gain.setValueAtTime(0, audioContext.currentTime + 0.15);
    gainNode2.gain.linearRampToValueAtTime(0.35, audioContext.currentTime + 0.17);
    gainNode2.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.4);

    oscillator2.start(audioContext.currentTime + 0.15);
    oscillator2.stop(audioContext.currentTime + 0.4);

    // 컨텍스트 정리
    setTimeout(() => {
      audioContext.close();
      console.log("[알림] 소리 재생 완료");
    }, 500);
  } catch (err) {
    console.error("[알림] 소리 재생 실패:", err);
  }
}

export function useOptimizationNotification(
  options: UseOptimizationNotificationOptions = {}
): UseOptimizationNotificationReturn {
  const {
    title = DEFAULT_TITLE,
    body = DEFAULT_BODY,
    icon = "/icon-192x192.png",
  } = options;

  const [permissionStatus, setPermissionStatus] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [isPageVisible, setIsPageVisible] = useState(true);
  const hasUserInteracted = useRef(false);

  // 브라우저 지원 여부 확인 및 권한 상태 초기화
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("Notification" in window)) {
      setPermissionStatus("unsupported");
      console.log("[알림] Notification API 지원 안됨");
      return;
    }

    setPermissionStatus(Notification.permission);
    console.log("[알림] 초기 권한 상태:", Notification.permission);

    // 사용자 상호작용 감지 (소리 재생을 위해 필요)
    const handleInteraction = () => {
      hasUserInteracted.current = true;
      console.log("[알림] 사용자 상호작용 감지됨");
    };

    window.addEventListener("click", handleInteraction, { once: true });
    window.addEventListener("keydown", handleInteraction, { once: true });
    window.addEventListener("touchstart", handleInteraction, { once: true });

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    };
  }, []);

  // 페이지 가시성 감지
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);
      console.log("[알림] 페이지 가시성 변경:", visible ? "보임" : "숨김");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // 알림 권한 요청
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      console.log("[알림] 권한 요청 불가 - Notification API 없음");
      return false;
    }

    console.log("[알림] 현재 권한 상태:", Notification.permission);

    if (Notification.permission === "granted") {
      setPermissionStatus("granted");
      return true;
    }

    if (Notification.permission === "denied") {
      setPermissionStatus("denied");
      return false;
    }

    try {
      console.log("[알림] 권한 요청 중...");
      const permission = await Notification.requestPermission();
      console.log("[알림] 권한 요청 결과:", permission);
      setPermissionStatus(permission);
      return permission === "granted";
    } catch (err) {
      console.error("[알림] 권한 요청 실패:", err);
      return false;
    }
  }, []);

  // 브라우저 알림 발송
  const sendNotification = useCallback(() => {
    console.log("[알림] 푸시 알림 발송 시도");

    if (typeof window === "undefined" || !("Notification" in window)) {
      console.log("[알림] Notification API 없음");
      return;
    }

    if (Notification.permission !== "granted") {
      console.log("[알림] 권한 없음:", Notification.permission);
      return;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon,
        tag: "optimization-complete",
        requireInteraction: false,
      });

      console.log("[알림] 푸시 알림 생성됨");

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => {
        notification.close();
      }, 5000);
    } catch (err) {
      console.error("[알림] 푸시 알림 생성 실패:", err);
    }
  }, [title, body, icon]);

  // 최적화 완료 알림 발송 (소리 + 푸시 알림)
  const notifyOptimizationComplete = useCallback(() => {
    console.log("[알림] notifyOptimizationComplete 호출됨");
    console.log("[알림] 페이지 가시성:", isPageVisible);
    console.log("[알림] 권한 상태:", permissionStatus);

    // 1. 소리 재생 (항상 시도)
    playNotificationSound();

    // 2. 푸시 알림 발송 (페이지가 보이지 않을 때 또는 권한이 있을 때)
    if (permissionStatus === "granted") {
      sendNotification();
    }
  }, [sendNotification, isPageVisible, permissionStatus]);

  return {
    requestPermission,
    permissionStatus,
    notifyOptimizationComplete,
    isPageVisible,
  };
}

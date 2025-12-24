import { toast as sonnerToast, type ExternalToast } from "sonner";

type ToastType = "success" | "error" | "info" | "warning" | "loading";

interface ToastOptions extends ExternalToast {
  /** 토스트 타입 */
  type?: ToastType;
}

/**
 * 토스트 유틸리티 함수들
 * sonner 라이브러리를 래핑하여 일관된 인터페이스 제공
 */

/**
 * 성공 토스트
 */
export function showSuccessToast(
  message: string,
  options?: Omit<ToastOptions, "type">
) {
  return sonnerToast.success(message, {
    duration: 3000,
    ...options,
  });
}

/**
 * 에러 토스트
 */
export function showErrorToast(
  message: string,
  options?: Omit<ToastOptions, "type">
) {
  return sonnerToast.error(message, {
    duration: 5000,
    ...options,
  });
}

/**
 * 정보 토스트
 */
export function showInfoToast(
  message: string,
  options?: Omit<ToastOptions, "type">
) {
  return sonnerToast.info(message, {
    duration: 4000,
    ...options,
  });
}

/**
 * 경고 토스트
 */
export function showWarningToast(
  message: string,
  options?: Omit<ToastOptions, "type">
) {
  return sonnerToast.warning(message, {
    duration: 4000,
    ...options,
  });
}

/**
 * 로딩 토스트 (수동으로 닫아야 함)
 */
export function showLoadingToast(
  message: string,
  options?: Omit<ToastOptions, "type">
) {
  return sonnerToast.loading(message, {
    duration: Infinity,
    ...options,
  });
}

/**
 * 토스트 닫기
 */
export function dismissToast(toastId?: string | number) {
  sonnerToast.dismiss(toastId);
}

/**
 * 모든 토스트 닫기
 */
export function dismissAllToasts() {
  sonnerToast.dismiss();
}

/**
 * 프로미스 기반 토스트 (로딩 → 성공/실패)
 */
export function showPromiseToast<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: Error) => string);
  },
  options?: Omit<ToastOptions, "type">
) {
  return sonnerToast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
    ...options,
  });
}

/**
 * 액션이 있는 토스트
 */
export function showActionToast(
  message: string,
  action: {
    label: string;
    onClick: () => void;
  },
  options?: Omit<ToastOptions, "type" | "action">
) {
  return sonnerToast(message, {
    duration: 5000,
    action: {
      label: action.label,
      onClick: action.onClick,
    },
    ...options,
  });
}

/**
 * 취소 가능한 토스트 (예: 삭제 취소)
 */
export function showUndoToast(
  message: string,
  onUndo: () => void,
  options?: Omit<ToastOptions, "type" | "action">
) {
  return sonnerToast(message, {
    duration: 5000,
    action: {
      label: "되돌리기",
      onClick: onUndo,
    },
    ...options,
  });
}

/**
 * 일반 토스트
 */
export function showToast(
  message: string,
  options?: ToastOptions
) {
  const { type, ...rest } = options ?? {};

  switch (type) {
    case "success":
      return showSuccessToast(message, rest);
    case "error":
      return showErrorToast(message, rest);
    case "info":
      return showInfoToast(message, rest);
    case "warning":
      return showWarningToast(message, rest);
    case "loading":
      return showLoadingToast(message, rest);
    default:
      return sonnerToast(message, { duration: 4000, ...rest });
  }
}

/**
 * 커스텀 토스트 (JSX 지원)
 */
export function showCustomToast(
  content: React.ReactElement,
  options?: ToastOptions
) {
  return sonnerToast.custom(() => content, options);
}

// 미리 정의된 메시지 토스트
export const toastMessages = {
  // 일반 작업
  saved: () => showSuccessToast("저장되었습니다"),
  deleted: () => showSuccessToast("삭제되었습니다"),
  copied: () => showSuccessToast("클립보드에 복사되었습니다"),
  updated: () => showSuccessToast("수정되었습니다"),

  // 에러
  genericError: () => showErrorToast("오류가 발생했습니다. 다시 시도해주세요."),
  networkError: () => showErrorToast("네트워크 연결을 확인해주세요."),
  serverError: () => showErrorToast("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."),
  permissionError: () => showErrorToast("권한이 없습니다."),
  validationError: (message: string) => showErrorToast(message),

  // 여행 관련
  tripCreated: () => showSuccessToast("새 여행이 만들어졌습니다"),
  tripDeleted: () => showSuccessToast("여행이 삭제되었습니다"),
  tripUpdated: () => showSuccessToast("여행 정보가 수정되었습니다"),

  // 장소 관련
  placeAdded: (name: string) => showSuccessToast(`'${name}' 장소가 추가되었습니다`),
  placeRemoved: () => showSuccessToast("장소가 삭제되었습니다"),
  placeMaxReached: () => showWarningToast("최대 50개까지 장소를 추가할 수 있습니다"),

  // 일정 관련
  scheduleAdded: () => showSuccessToast("고정 일정이 추가되었습니다"),
  scheduleUpdated: () => showSuccessToast("일정이 수정되었습니다"),
  scheduleDeleted: () => showSuccessToast("일정이 삭제되었습니다"),
  scheduleConflict: () => showWarningToast("해당 시간에 이미 일정이 있습니다"),

  // 최적화 관련
  optimizeStarted: () => showLoadingToast("일정을 최적화하는 중..."),
  optimizeSuccess: () => showSuccessToast("일정 최적화가 완료되었습니다"),
  optimizeError: () => showErrorToast("최적화에 실패했습니다. 다시 시도해주세요."),

  // 로그인 관련
  loginRequired: () => showInfoToast("로그인이 필요합니다"),
  welcomeBack: (name: string) => showSuccessToast(`${name}님, 환영합니다!`),
};

// 기본 export
export { sonnerToast as toast };

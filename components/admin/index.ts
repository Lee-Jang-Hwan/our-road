// ============================================
// Admin Components (관리자 UI 컴포넌트)
// ============================================

/**
 * @fileoverview
 * 관리자 페이지에서 사용되는 UI 컴포넌트 모듈입니다.
 *
 * ## 주요 컴포넌트
 *
 * ### 1. 에러 로그 테이블 (error-log-table.tsx)
 * - ErrorLogTable: 에러 로그 목록 테이블
 * - ErrorLogTableCompact: 모바일용 컴팩트 테이블
 * - SeverityBadge: 심각도 배지
 * - StatusBadge: 해결 상태 배지
 *
 * ### 2. 에러 로그 필터 (error-log-filter.tsx)
 * - ErrorLogFilter: 필터 UI (상태, 심각도, 에러 코드, 기간)
 * - ErrorLogSearchFilter: 검색 필터
 * - DateRangeFilter: 날짜 범위 선택
 *
 * ### 3. 에러 로그 상세 (error-log-detail.tsx)
 * - ErrorLogDetail: 상세 정보 모달/시트
 * - ErrorLogDetailCard: 상세 정보 카드
 * - SeverityIcon: 심각도 아이콘
 * - CodeBlock: 코드 블록 (스택 트레이스용)
 *
 * ### 4. 해결 다이얼로그 (resolve-dialog.tsx)
 * - ResolveDialog: 단일 해결 처리
 * - BulkResolveDialog: 일괄 해결 처리
 * - DeleteConfirmDialog: 삭제 확인
 * - BulkDeleteConfirmDialog: 일괄 삭제 확인
 *
 * ### 5. 관리자 사이드바 (admin-sidebar.tsx)
 * - AdminSidebar: 전체 사이드바
 * - AdminSidebarMinimal: 아이콘만 표시하는 미니멀 사이드바
 * - AdminHeader: 모바일 헤더
 * - AdminLayout: 사이드바 + 메인 레이아웃
 *
 * ## 사용 예시
 *
 * ```tsx
 * import {
 *   ErrorLogTable,
 *   ErrorLogFilter,
 *   ErrorLogDetail,
 *   ResolveDialog,
 *   AdminLayout,
 * } from "@/components/admin";
 *
 * export default function ErrorLogsPage() {
 *   const [filter, setFilter] = useState({});
 *   const [selectedLog, setSelectedLog] = useState(null);
 *
 *   return (
 *     <AdminLayout userName="관리자" userRole="admin">
 *       <div className="p-6">
 *         <ErrorLogFilter value={filter} onChange={setFilter} />
 *         <ErrorLogTable
 *           data={logs}
 *           onViewDetail={setSelectedLog}
 *         />
 *         <ErrorLogDetail
 *           log={selectedLog}
 *           open={!!selectedLog}
 *           onOpenChange={(open) => !open && setSelectedLog(null)}
 *         />
 *       </div>
 *     </AdminLayout>
 *   );
 * }
 * ```
 */

// ============================================
// Error Log Table
// ============================================

export {
  ErrorLogTable,
  ErrorLogTableCompact,
  ErrorLogTableSkeleton,
  SeverityBadge,
  StatusBadge,
} from "./error-log-table";

// ============================================
// Error Log Filter
// ============================================

export {
  ErrorLogFilter,
  ErrorLogSearchFilter,
  FilterChip,
  DateRangeFilter,
} from "./error-log-filter";

// ============================================
// Error Log Detail
// ============================================

export {
  ErrorLogDetail,
  ErrorLogDetailCard,
  SeverityIcon,
  InfoRow,
  CodeBlock,
  ContextDisplay,
} from "./error-log-detail";

// ============================================
// Resolve Dialog
// ============================================

export {
  ResolveDialog,
  BulkResolveDialog,
  DeleteConfirmDialog,
  BulkDeleteConfirmDialog,
} from "./resolve-dialog";

// ============================================
// Admin Sidebar
// ============================================

export {
  AdminSidebar,
  AdminSidebarMinimal,
  AdminHeader,
  AdminLayout,
  SidebarContent,
  SidebarSkeleton,
  NavItemComponent,
} from "./admin-sidebar";

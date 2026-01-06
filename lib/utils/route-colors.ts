// ============================================
// Route Visualization Color System
// ============================================

export const DAY_COLORS = [
  { primary: '#3B82F6', light: '#DBEAFE', dark: '#1E40AF' }, // Blue (Day 1)
  { primary: '#EF4444', light: '#FEE2E2', dark: '#991B1B' }, // Red (Day 2)
  { primary: '#10B981', light: '#D1FAE5', dark: '#065F46' }, // Green (Day 3)
  { primary: '#F59E0B', light: '#FEF3C7', dark: '#92400E' }, // Orange (Day 4)
  { primary: '#8B5CF6', light: '#EDE9FE', dark: '#5B21B6' }, // Purple (Day 5)
  { primary: '#EC4899', light: '#FCE7F3', dark: '#9F1239' }, // Pink (Day 6)
  { primary: '#06B6D4', light: '#CFFAFE', dark: '#164E63' }, // Cyan (Day 7)
];

export function getDayColor(dayIndex: number) {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
}

export const MARKER_COLORS = {
  start: '#22C55E', // Green
  end: '#EF4444', // Red
  lodging: '#F59E0B', // Orange
  waypoint: '#3B82F6', // Blue
  fixed: '#8B5CF6', // Purple
} as const;

export const STATUS_COLORS = {
  normal: '#10B981', // Green
  warning: '#F59E0B', // Orange
  error: '#EF4444', // Red
} as const;

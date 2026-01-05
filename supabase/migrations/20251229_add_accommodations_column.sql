-- Add accommodations JSONB column to trips table
-- Structure: Array of DailyAccommodation objects (연속 일정 지원)
-- [
--   {
--     "startDate": "2024-01-15",   -- 체크인 날짜
--     "endDate": "2024-01-17",     -- 체크아웃 날짜
--     "location": { "name": "...", "address": "...", "lat": 37.5, "lng": 127.0 },
--     "checkInTime": "15:00",
--     "checkOutTime": "11:00"
--   }
-- ]

ALTER TABLE trips
ADD COLUMN IF NOT EXISTS accommodations JSONB DEFAULT '[]'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN trips.accommodations IS 'Array of accommodations with startDate, endDate, location, checkInTime, checkOutTime';

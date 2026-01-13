-- Add check-in event to trip_itineraries
ALTER TABLE trip_itineraries
ADD COLUMN IF NOT EXISTS check_in_event JSONB;

COMMENT ON COLUMN trip_itineraries.check_in_event IS 'Check-in event metadata (JSONB)';

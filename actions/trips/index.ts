// ============================================
// Trip Server Actions - 공용 Export
// ============================================

// Create
export { createTrip } from "./create-trip";
export type { CreateTripResult } from "./create-trip";

// Read (Single)
export { getTrip, getTripWithDetails } from "./get-trip";
export type { GetTripResult, GetTripWithDetailsResult } from "./get-trip";

// Read (List)
export { getTrips, getTripList } from "./get-trips";
export type { GetTripsResult, GetTripListResult } from "./get-trips";

// Update
export { updateTrip, updateTripStatus } from "./update-trip";
export type { UpdateTripResult } from "./update-trip";

// Delete
export { deleteTrip, deleteTrips } from "./delete-trip";
export type { DeleteTripResult } from "./delete-trip";

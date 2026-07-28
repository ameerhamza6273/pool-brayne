import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"] & { profiles: { name: string } | null };
type TripHistory = Database["public"]["Tables"]["trip_history"]["Row"] & { vehicles: { name: string; number: string } | null };
type GeofenceAlert = Database["public"]["Tables"]["geofence_alerts"]["Row"] & { vehicles: { name: string; number: string } | null };

export const fleetApi = {
  all: () => api.get<{ vehicles: Vehicle[]; tripHistory: TripHistory[]; geofenceAlerts: GeofenceAlert[] }>("/api/fleet"),
};

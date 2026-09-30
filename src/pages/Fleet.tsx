import { Navigation, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";

// QA sweep 2026-09-30: this page used to render a fully simulated tracking map (hardcoded "Austin,
// TX" + "Live tracking active" SVG text, fake moving vehicle pins, fake speed/mileage), a fake Trip
// History table and fake Geofence Alerts, plus a "Smart Dispatch" card claiming to route by live
// vehicle position -- all from `vehicles`/`trip_history`/`geofence_alerts` tables that have no real
// write path anywhere in the app (fleetApi is read-only; nothing ever created a real row in them,
// only the old demo seed script). CLAUDE.md's own Integrations notes already say what this page is
// actually supposed to do: "GPS7000 has no public API ... Fleet page just links out to
// platform.gps7000.com; no live position data flows into the app." This now matches that.
export default function Fleet() {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0F172A]">{t("Fleet & Vehicle Tracking")}</h1>
        <Button
          className="gap-2 bg-[#0891B2] hover:bg-[#0E7490] text-white"
          onClick={() => window.open("https://platform.gps7000.com/", "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="w-4 h-4" /> {t("Open GPS7000")}
        </Button>
      </div>

      <div className="bg-gradient-to-r from-[#0891B2] to-[#0E7490] rounded-xl p-4 text-white flex items-center gap-3">
        <Navigation className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">{t("GPS7000 has no API to sync live position into Clear Pool CRM yet — use the button above to open it directly.")}</p>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-10 text-center text-[#64748B]">
        <Navigation className="w-10 h-10 mx-auto mb-3 text-[#CBD5E1]" />
        <p className="font-medium text-[#0F172A] mb-1">{t("No live vehicle tracking here yet")}</p>
        <p className="text-sm max-w-md mx-auto">{t("Truck positions, trip history, and geofence alerts all live in GPS7000 for now — open it above to see them.")}</p>
      </div>
    </div>
  );
}

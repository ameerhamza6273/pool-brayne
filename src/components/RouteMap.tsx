import { useState } from "react";
import { MapPin, Navigation, Clock, Car } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Stop = {
  id: string;
  customer: string;
  address: string;
  time: string;
  status: "done" | "current" | "upcoming";
  distance: string;
};

const route: Stop[] = [
  { id: "1", customer: "James Thompson", address: "1428 Maple Ridge Dr, Austin, TX 78734", time: "8:00 AM", status: "done", distance: "0 mi" },
  { id: "2", customer: "Maria & Carlos Rodriguez", address: "3421 Hill Country Blvd, Austin, TX 78738", time: "9:30 AM", status: "done", distance: "2.4 mi" },
  { id: "3", customer: "The Henderson Family", address: "5678 River Rd, Austin, TX 78746", time: "11:00 AM", status: "current", distance: "5.1 mi" },
  { id: "4", customer: "Sunset Country Club", address: "8900 Lakeview Pkwy, Austin, TX 78734", time: "1:00 PM", status: "upcoming", distance: "8.3 mi" },
  { id: "5", customer: "Austin Aquatic Center", address: "1200 Shoal Creek Blvd, Austin, TX 78701", time: "3:00 PM", status: "upcoming", distance: "12.7 mi" },
];

const statusConfig = {
  done: { color: "bg-[#16A34A] text-white", badge: "bg-[#16A34A]/10 text-[#16A34A]", label: "Completed" },
  current: { color: "bg-[#0891B2] text-white", badge: "bg-[#0891B2]/10 text-[#0891B2]", label: "In Progress" },
  upcoming: { color: "bg-[#CBD5E1] text-[#64748B]", badge: "bg-[#F1F5F9] text-[#64748B]", label: "Upcoming" },
};

export default function RouteMap() {
  const [stops] = useState(route);
  const totalDistance = "12.7 mi";
  const completedCount = stops.filter(s => s.status === "done").length;

  return (
    <Card className="border-[#E2E8F0] shadow-sm">
      <CardHeader className="pb-3 flex items-center justify-between">
        <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#0891B2]" />
          Today's Route
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1 border-[#E2E8F0]">
            <Car className="w-3 h-3" /> {totalDistance}
          </Badge>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-[#E2E8F0]">
            <MapPin className="w-3.5 h-3.5" /> Open Map
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Map placeholder */}
        <div className="relative h-40 rounded-lg bg-gradient-to-br from-[#E0F2FE] to-[#CFFAFE] border border-[#E2E8F0] mb-4 overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `linear-gradient(#0891B2 1px, transparent 1px), linear-gradient(90deg, #0891B2 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
          }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-[#0891B2] mx-auto mb-1" />
              <p className="text-xs text-[#64748B]">Interactive route map</p>
            </div>
          </div>
          {/* Route line */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            <path d="M 50 100 Q 150 50 250 80 T 450 60" stroke="#0891B2" strokeWidth="2" strokeDasharray="5 5" fill="none" />
          </svg>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div className="h-full bg-[#16A34A] rounded-full transition-all" style={{ width: `${(completedCount / stops.length) * 100}%` }} />
          </div>
          <span className="text-xs text-[#64748B]">{completedCount}/{stops.length} done</span>
        </div>

        {/* Route stops */}
        <div className="space-y-0">
          {stops.map((stop, idx) => {
            const cfg = statusConfig[stop.status];
            return (
              <div key={stop.id} className="flex gap-3">
                {/* Timeline */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${cfg.color} shrink-0`}>
                    {idx + 1}
                  </div>
                  {idx < stops.length - 1 && (
                    <div className={`w-0.5 h-12 ${stop.status === "done" ? "bg-[#16A34A]" : "bg-[#E2E8F0]"}`} />
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 pb-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#0F172A]">{stop.customer}</p>
                    <Badge variant="outline" className={`text-[10px] h-5 ${cfg.badge}`}>{cfg.label}</Badge>
                  </div>
                  <p className="text-xs text-[#64748B]">{stop.address}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-[#64748B] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {stop.time}
                    </span>
                    <span className="text-xs text-[#64748B] flex items-center gap-1">
                      <Car className="w-3 h-3" /> {stop.distance}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

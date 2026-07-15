import { useState } from "react";
import { Truck, Navigation, AlertTriangle, Clock, Route, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { vehicles, tripHistory, geofenceAlerts } from "@/lib/data";

const statusColors: Record<string, string> = {
  Moving: "bg-[#16A34A]/10 text-[#16A34A]",
  Idle: "bg-[#F59E0B]/10 text-[#F59E0B]",
  Parked: "bg-[#0891B2]/10 text-[#0891B2]",
};

export default function Fleet() {
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0F172A]">Fleet & Vehicle Tracking</h1>
      </div>

      {/* Banner */}
      <div className="bg-gradient-to-r from-[#0891B2] to-[#0E7490] rounded-xl p-4 text-white flex items-center gap-3">
        <Navigation className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">Live GPS inside PoolBrayne — no separate login. Vendor-agnostic API layer.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map Placeholder */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="h-80 lg:h-96 bg-[#F1F5F9] relative flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
                <rect width="800" height="400" fill="#E2E8F0" />
                <path d="M0 200 L800 200" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="8 8" />
                <path d="M200 0 L200 400" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="8 8" />
                <path d="M400 0 L400 400" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="8 8" />
                <path d="M600 0 L600 400" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="8 8" />
                <path d="M0 100 L800 100" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="8 8" />
                <path d="M0 300 L800 300" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="8 8" />
                <text x="50" y="30" fill="#64748B" fontSize="12" fontFamily="sans-serif">Austin, TX</text>
                <text x="50" y="50" fill="#94A3B8" fontSize="10" fontFamily="sans-serif">Live tracking active</text>
              </svg>
              {/* Vehicle pins */}
              {vehicles.map((v, i) => {
                const positions = [
                  { x: 180, y: 120 },
                  { x: 350, y: 200 },
                  { x: 520, y: 160 },
                  { x: 650, y: 280 },
                ];
                const pos = positions[i];
                const isSelected = selectedVehicle === v.id;
                return (
                  <button
                    key={v.id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${pos.x / 8}%`, top: `${pos.y / 4}%` }}
                    onClick={() => setSelectedVehicle(isSelected ? null : v.id)}
                  >
                    <div className={`flex flex-col items-center gap-1 transition-transform ${isSelected ? "scale-110" : ""}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                        v.status === "Moving" ? "bg-[#16A34A]" : v.status === "Idle" ? "bg-[#F59E0B]" : "bg-[#0891B2]"
                      }`}>
                        <Truck className="w-5 h-5 text-white" />
                      </div>
                      <div className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shadow-md ${
                        isSelected ? "bg-[#0F172A] text-white" : "bg-white text-[#0F172A]"
                      }`}>
                        {v.name}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Vehicle List */}
        <div className="space-y-2">
          <h3 className="font-semibold text-[#0F172A] text-sm">Vehicles</h3>
          {vehicles.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVehicle(selectedVehicle === v.id ? null : v.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selectedVehicle === v.id
                  ? "bg-[#0891B2]/5 border-[#0891B2] shadow-sm"
                  : "bg-white border-[#E2E8F0] hover:bg-[#F8FAFC]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  v.status === "Moving" ? "bg-[#16A34A]/10" : v.status === "Idle" ? "bg-[#F59E0B]/10" : "bg-[#0891B2]/10"
                }`}>
                  <Truck className={`w-5 h-5 ${
                    v.status === "Moving" ? "text-[#16A34A]" : v.status === "Idle" ? "text-[#F59E0B]" : "text-[#0891B2]"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-[#0F172A]">{v.name}</p>
                    <Badge className={`${statusColors[v.status]} text-[10px] px-1.5 py-0`}>{v.status}</Badge>
                  </div>
                  <p className="text-xs text-[#64748B] truncate">{v.location}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#64748B]">
                    <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />{v.speed} mph</span>
                    <span className="flex items-center gap-1"><Route className="w-3 h-3" />{v.mileage} mi</span>
                  </div>
                </div>
                <div className="shrink-0 text-[10px] text-[#64748B]">{v.lastUpdate}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Dispatch suggestion card */}
      <Card className="border-[#E2E8F0] shadow-sm bg-[#F8FAFC]">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0891B2]/10 flex items-center justify-center">
            <Navigation className="w-5 h-5 text-[#0891B2]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#0F172A]">Smart Dispatch</p>
            <p className="text-xs text-[#64748B]">Dispatch suggests the nearest available technician based on live vehicle position.</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs below map */}
      <Tabs defaultValue="trips" className="w-full">
        <TabsList className="bg-white border border-[#E2E8F0] h-10 p-1 rounded-lg">
          <TabsTrigger value="trips" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Route className="w-4 h-4" /> Trip History
          </TabsTrigger>
          <TabsTrigger value="geofence" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Geofence Alerts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="mt-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Vehicle</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Start</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">End</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Start Location</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">End Location</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Distance</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {tripHistory.map((tr) => (
                    <tr key={tr.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{tr.vehicle}</td>
                      <td className="py-3 px-4 text-[#64748B]">{tr.start}</td>
                      <td className="py-3 px-4 text-[#64748B]">{tr.end}</td>
                      <td className="py-3 px-4 text-[#64748B] text-sm">{tr.startLoc}</td>
                      <td className="py-3 px-4 text-[#64748B] text-sm">{tr.endLoc}</td>
                      <td className="text-right py-3 px-4 font-medium text-[#0F172A]">{tr.distance} mi</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{tr.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="geofence" className="mt-4">
          <div className="space-y-3">
            {geofenceAlerts.map((g) => (
              <div key={g.id} className="flex items-center gap-3 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-[#0F172A]">{g.vehicle}</p>
                    <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] px-1.5 py-0">{g.severity}</Badge>
                  </div>
                  <p className="text-sm text-[#64748B]">{g.message}</p>
                </div>
                <div className="shrink-0 text-xs text-[#64748B] flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {g.time}
                </div>
              </div>
            ))}
            {geofenceAlerts.length === 0 && (
              <p className="text-center text-[#64748B] py-8">No geofence alerts</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState } from "react";
import { Droplets, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Reading = {
  value: string;
  range: string;
  min: number;
  max: number;
  unit: string;
  icon: typeof Droplets;
};

const waterParams: Reading[] = [
  { value: "", range: "1-3", min: 1, max: 3, unit: "ppm", icon: Droplets },
  { value: "", range: "1-3", min: 1, max: 3, unit: "ppm", icon: Droplets },
  { value: "", range: "7.2-7.8", min: 7.2, max: 7.8, unit: "pH", icon: Droplets },
  { value: "", range: "80-120", min: 80, max: 120, unit: "ppm", icon: Droplets },
  { value: "", range: "200-400", min: 200, max: 400, unit: "ppm", icon: Droplets },
  { value: "", range: "30-80", min: 30, max: 80, unit: "ppm", icon: Droplets },
];

const paramLabels = [
  "Total Chlorine",
  "Free Chlorine",
  "pH",
  "Alkalinity",
  "Calcium",
  "CYA (Cyanuric Acid)",
];

export default function WaterTestingForm() {
  const [readings, setReadings] = useState<string[]>(["", "", "", "", "", ""]);
  const [chemicalSource, setChemicalSource] = useState("truck");

  const getReadingStatus = (idx: number): "ok" | "low" | "high" | "empty" => {
    const val = parseFloat(readings[idx]);
    if (isNaN(val)) return "empty";
    if (val < waterParams[idx].min) return "low";
    if (val > waterParams[idx].max) return "high";
    return "ok";
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "ok": return "border-[#16A34A] bg-[#16A34A]/5";
      case "low": return "border-[#F59E0B] bg-[#F59E0B]/5";
      case "high": return "border-[#EF4444] bg-[#EF4444]/5";
      default: return "border-[#E2E8F0] bg-white";
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "ok": return <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />;
      case "low": return <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />;
      case "high": return <AlertTriangle className="w-4 h-4 text-[#EF4444]" />;
      default: return null;
    }
  };

  return (
    <Card className="border-[#E2E8F0] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
          <Droplets className="w-4 h-4 text-[#0891B2]" />
          Water Testing Form
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {paramLabels.map((label, idx) => {
            const status = getReadingStatus(idx);
            const Icon = waterParams[idx].icon;
            return (
              <div key={label} className={`p-3 rounded-lg border-2 ${statusColor(status)}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-medium text-[#0F172A] flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-[#0891B2]" />
                    {label}
                  </Label>
                  {statusIcon(status)}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="0"
                    value={readings[idx]}
                    onChange={(e) => {
                      const next = [...readings];
                      next[idx] = e.target.value;
                      setReadings(next);
                    }}
                    className="h-9 flex-1"
                  />
                  <span className="text-xs text-[#64748B] w-10">{waterParams[idx].unit}</span>
                </div>
                <p className="text-[10px] text-[#64748B] mt-1">
                  Ideal range: {waterParams[idx].range} {waterParams[idx].unit}
                </p>
              </div>
            );
          })}
        </div>

        <div>
          <Label className="text-xs font-medium text-[#0F172A]">Chemicals Added From</Label>
          <Select value={chemicalSource} onValueChange={setChemicalSource}>
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="truck">Truck Supply</SelectItem>
              <SelectItem value="customer">Customer Supply</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs font-medium text-[#0F172A]">Pressure on Filter</Label>
          <Input placeholder="e.g. 12 psi" className="mt-1 h-9" />
        </div>

        <div>
          <Label className="text-xs font-medium text-[#0F172A]">Other Notes</Label>
          <Input placeholder="Additional water testing notes..." className="mt-1 h-9" />
        </div>

        <Button size="sm" className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 w-full">
          <CheckCircle2 className="w-4 h-4" /> Save Water Test Results
        </Button>
      </CardContent>
    </Card>
  );
}

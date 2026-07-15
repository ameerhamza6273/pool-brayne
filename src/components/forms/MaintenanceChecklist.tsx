import { useState } from "react";
import { ClipboardList, CheckCircle2, Circle, FlaskConical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const checklistItems = [
  "Added salt",
  "No Power to Equipment",
  "Filter Cartridge Change Needed",
  "Filters Needs to be Cleaned",
  "Backwashed Filters",
  "No Pool Tasks Due to Lightning",
  "Brushed pool",
  "Low Water Level",
  "Skimmed Surface",
  "Vacuumed pool",
  "Emptied baskets pump(s) / skimmer(s)",
  "Emptied Leaf Catcher",
  "Used Blower",
  "Cleaned Salt Cells",
  "Emptied Pool Cleaner Bag / Canister",
];

export default function MaintenanceChecklist() {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [chemicalSource, setChemicalSource] = useState("truck");
  const [pressure, setPressure] = useState("");
  const [notes, setNotes] = useState("");

  const toggle = (idx: number) => {
    const next = new Set(checked);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setChecked(next);
  };

  const allChecked = checked.size === checklistItems.length;

  return (
    <Card className="border-[#E2E8F0] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-[#0891B2]" />
          Weekly Maintenance Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {checklistItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => toggle(idx)}
              className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${
                checked.has(idx)
                  ? "border-[#16A34A] bg-[#16A34A]/5"
                  : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
              }`}
            >
              {checked.has(idx) ? (
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-[#CBD5E1] shrink-0" />
              )}
              <span className={`text-sm ${checked.has(idx) ? "text-[#0F172A] font-medium" : "text-[#64748B]"}`}>
                {item}
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <Label className="text-xs font-medium text-[#0F172A] flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-[#0891B2]" />
              Chemicals Added From
            </Label>
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
            <Input
              placeholder="e.g. 12 psi"
              value={pressure}
              onChange={(e) => setPressure(e.target.value)}
              className="mt-1 h-9"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium text-[#0F172A]">Other Notes</Label>
          <Textarea
            placeholder="Additional maintenance notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 text-sm"
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-[#64748B]">
            {checked.size} of {checklistItems.length} items completed
          </p>
          <Button
            size="sm"
            className={`gap-2 ${allChecked ? "bg-[#16A34A] hover:bg-[#15803D]" : "bg-[#0891B2] hover:bg-[#0E7490]"} text-white`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {allChecked ? "Complete" : "Save Progress"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


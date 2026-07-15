import { useState } from "react";
import { Camera, CheckCircle2, Circle, ClipboardCheck, Upload, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const oneOffTasks = [
  "Arrived on site & confirmed job scope with customer",
  "Checked for profile photos / existing conditions",
  "Wore appropriate PPE",
  "Isolated power to equipment before work",
  "Inspected equipment area for damage / leaks",
  "Completed primary task (repair / install / service)",
  "Tested equipment after work completed",
  "Cleaned work area",
  "Disposed of old parts / debris properly",
  "Updated customer on work performed",
];

type PhotoSlot = { label: string; photos: string[] };

const initialPhotoSections: { name: string; slots: PhotoSlot[] }[] = [
  {
    name: "Equipment Area",
    slots: [
      { label: "Before", photos: [] },
      { label: "After", photos: [] },
    ],
  },
  {
    name: "Pool",
    slots: [
      { label: "Before", photos: [] },
      { label: "After", photos: [] },
    ],
  },
];

export default function OneOffJobChecklist() {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState("");
  const [photoSections, setPhotoSections] = useState(initialPhotoSections);
  const [profilePhoto, setProfilePhoto] = useState<string[]>([]);

  const toggle = (idx: number) => {
    const next = new Set(checked);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setChecked(next);
  };

  const addPhoto = (sectionIdx: number, slotIdx: number) => {
    setPhotoSections(prev => prev.map((s, si) =>
      si === sectionIdx
        ? { ...s, slots: s.slots.map((sl, sli) =>
            sli === slotIdx ? { ...sl, photos: [...sl.photos, `photo-${Date.now()}.jpg`] } : sl
          ) }
        : s
    ));
  };

  const removePhoto = (sectionIdx: number, slotIdx: number, photoIdx: number) => {
    setPhotoSections(prev => prev.map((s, si) =>
      si === sectionIdx
        ? { ...s, slots: s.slots.map((sl, sli) =>
            sli === slotIdx ? { ...sl, photos: sl.photos.filter((_, pi) => pi !== photoIdx) } : sl
          ) }
        : s
    ));
  };

  const addProfilePhoto = () => setProfilePhoto(prev => [...prev, `profile-${Date.now()}.jpg`]);
  const removeProfilePhoto = (idx: number) => setProfilePhoto(prev => prev.filter((_, i) => i !== idx));

  return (
    <Card className="border-[#E2E8F0] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-[#0891B2]" />
          One-off Job Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-5">
        {/* Task checklist */}
        <div className="space-y-1.5">
          {oneOffTasks.map((item, idx) => (
            <button
              key={idx}
              onClick={() => toggle(idx)}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${
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

        {/* Before/After Photo Sections */}
        <div className="space-y-4">
          <Label className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide">Before & After Photos</Label>
          {photoSections.map((section, si) => (
            <div key={si} className="border border-[#E2E8F0] rounded-lg p-3 bg-[#F8FAFC]">
              <p className="text-sm font-medium text-[#0F172A] mb-2">{section.name}</p>
              <div className="grid grid-cols-2 gap-3">
                {section.slots.map((slot, sli) => (
                  <div key={sli}>
                    <p className="text-xs text-[#64748B] mb-1.5">{slot.label}</p>
                    <div className="space-y-1.5">
                      {slot.photos.map((_p, pi) => (
                        <div key={pi} className="relative group rounded-lg overflow-hidden border border-[#E2E8F0] aspect-square bg-[#E2E8F0]">
                          <div className="absolute inset-0 flex items-center justify-center text-[#94A3B8]">
                            <Camera className="w-6 h-6" />
                          </div>
                          <button
                            onClick={() => removePhoto(si, sli, pi)}
                            className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                      {slot.photos.length === 0 && (
                        <button
                          onClick={() => addPhoto(si, sli)}
                          className="w-full aspect-square rounded-lg border-2 border-dashed border-[#CBD5E1] flex flex-col items-center justify-center gap-1 text-[#94A3B8] hover:border-[#0891B2] hover:text-[#0891B2] transition-colors"
                        >
                          <Upload className="w-5 h-5" />
                          <span className="text-xs">Upload</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Check for Profile Photos */}
        <div className="border border-[#E2E8F0] rounded-lg p-3 bg-[#F8FAFC]">
          <p className="text-sm font-medium text-[#0F172A] mb-2">Check for Profile Photos</p>
          <div className="flex gap-2 flex-wrap">
            {profilePhoto.map((_p, idx) => (
              <div key={idx} className="relative group rounded-lg overflow-hidden border border-[#E2E8F0] w-20 h-80 bg-[#E2E8F0]" style={{ height: "5rem" }}>
                <div className="absolute inset-0 flex items-center justify-center text-[#94A3B8]">
                  <Camera className="w-5 h-5" />
                </div>
                <button
                  onClick={() => removeProfilePhoto(idx)}
                  className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            <button
              onClick={addProfilePhoto}
              className="w-20 h-20 rounded-lg border-2 border-dashed border-[#CBD5E1] flex flex-col items-center justify-center gap-1 text-[#94A3B8] hover:border-[#0891B2] hover:text-[#0891B2] transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span className="text-[10px]">Add</span>
            </button>
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium text-[#0F172A]">Job Notes</Label>
          <Textarea
            placeholder="Notes about the one-off job..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 text-sm"
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-[#64748B]">{checked.size} of {oneOffTasks.length} tasks completed</p>
          <Button size="sm" className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2">
            <CheckCircle2 className="w-4 h-4" /> Save Checklist
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

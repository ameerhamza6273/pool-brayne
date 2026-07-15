import { useState } from "react";
import {
  ArrowLeft, MapPin, Clock, Phone, Camera, CheckCircle2, Navigation,
  ChevronRight, Wrench, User, FileText, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { jobs, customers } from "@/lib/data";

const typeColors: Record<string, string> = {
  Maintenance: "bg-[#0891B2]/10 text-[#0891B2]",
  Repair: "bg-[#F59E0B]/10 text-[#F59E0B]",
  Install: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
};

export default function Field() {
  const navigate = useNavigate();
  const [activeJob, setActiveJob] = useState<string | null>("j3");
  const [jobStatus, setJobStatus] = useState<"dispatched" | "en_route" | "arrived" | "completed">("dispatched");
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [signatureDone, setSignatureDone] = useState(false);

  const myJobs = jobs.filter((j) => j.tech === "Jose" || j.tech === "Mike T.");
  const currentJob = myJobs.find((j) => j.id === activeJob);
  const customer = currentJob ? customers.find((c) => c.id === currentJob.customerId) : null;

  const statusSteps = [
    { id: "en_route", label: "En Route", action: "Navigate to Site", icon: Navigation },
    { id: "arrived", label: "Arrived", action: "I've Arrived", icon: MapPin },
    { id: "completed", label: "Complete", action: "Complete Job", icon: CheckCircle2 },
  ];

  const currentStepIdx = statusSteps.findIndex((s) => s.id === jobStatus);

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/jobs")} className="p-2 rounded-lg hover:bg-[#F8FAFC] text-[#64748B]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-[#0F172A]">My Day</h1>
        <div className="ml-auto flex items-center gap-1 text-sm text-[#64748B]">
          <Clock className="w-4 h-4" />
          <span>{myJobs.length} jobs</span>
        </div>
      </div>

      {/* Job List - Compact */}
      <div className="space-y-2">
        {myJobs.map((job) => (
          <button
            key={job.id}
            onClick={() => { setActiveJob(job.id); setJobStatus("dispatched"); }}
            className={`w-full text-left p-3 rounded-xl border transition-all ${
              activeJob === job.id ? "border-[#0891B2] bg-[#0891B2]/5" : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                job.status === "Completed" ? "bg-[#16A34A]/10" : "bg-[#0891B2]/10"
              }`}>
                <Wrench className={`w-5 h-5 ${job.status === "Completed" ? "text-[#16A34A]" : "text-[#0891B2]"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-[#0F172A] truncate">{job.customerName}</p>
                  <Badge className={`${typeColors[job.type]} text-[10px] px-1.5 py-0`}>{job.type}</Badge>
                </div>
                <p className="text-xs text-[#64748B]">{job.time} &middot; {job.address}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
            </div>
          </button>
        ))}
      </div>

      {/* Active Job Detail */}
      {currentJob && customer && (
        <Card className="border-[#E2E8F0] shadow-sm">
          <CardContent className="p-4 space-y-4">
            {/* Status Bar */}
            <div className="flex items-center gap-2">
              {statusSteps.map((step, idx) => {
                const isActive = jobStatus === step.id;
                const isDone = currentStepIdx > idx;
                return (
                  <div key={step.id} className="flex items-center gap-2 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isDone ? "bg-[#16A34A] text-white" : isActive ? "bg-[#0891B2] text-white" : "bg-[#F1F5F9] text-[#64748B]"
                    }`}>
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    {idx < 2 && (
                      <div className={`flex-1 h-0.5 ${isDone ? "bg-[#16A34A]" : "bg-[#E2E8F0]"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Customer Quick Info */}
            <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0891B2] flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#0F172A]">{currentJob.customerName}</p>
                  <p className="text-xs text-[#64748B]">{currentJob.address}</p>
                </div>
                <div className="flex gap-1">
                  <button className="p-2 rounded-lg bg-[#0891B2]/10 text-[#0891B2]">
                    <Phone className="w-4 h-4" />
                  </button>
                  <button className="p-2 rounded-lg bg-[#0891B2]/10 text-[#0891B2]">
                    <Navigation className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-[#64748B]">
                <MapPin className="w-3 h-3" />
                <span>GPS-verified: {currentJob.address}</span>
              </div>
            </div>

            {/* Job Description */}
            <div>
              <p className="text-sm font-medium text-[#0F172A] mb-1">Description</p>
              <p className="text-sm text-[#64748B]">{currentJob.description}</p>
            </div>

            {/* Line Items */}
            <div>
              <p className="text-sm font-medium text-[#0F172A] mb-2">Line Items</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#F8FAFC]">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-[#0891B2]" />
                    <span className="text-sm text-[#0F172A]">Labor - {currentJob.type}</span>
                  </div>
                  <span className="text-sm font-medium text-[#0F172A]">$127.50</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#F8FAFC]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#0891B2]" />
                    <span className="text-sm text-[#0F172A]">Parts & Materials</span>
                  </div>
                  <span className="text-sm font-medium text-[#0F172A]">$17.50</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0]">
                  <span className="text-sm font-medium text-[#0F172A]">Total</span>
                  <span className="text-base font-bold text-[#0891B2]">$145.00</span>
                </div>
              </div>
            </div>

            {/* Photos */}
            <div>
              <p className="text-sm font-medium text-[#0F172A] mb-2">Photos</p>
              <div className="grid grid-cols-4 gap-2">
                {photos.map((_, i) => (
                  <div key={i} className="aspect-square rounded-lg bg-[#0891B2]/10 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-[#0891B2]" />
                  </div>
                ))}
                <button
                  onClick={() => setPhotos([...photos, "new"])}
                  className="aspect-square rounded-lg bg-[#F1F5F9] border border-dashed border-[#E2E8F0] flex items-center justify-center"
                >
                  <Camera className="w-5 h-5 text-[#64748B]" />
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <p className="text-sm font-medium text-[#0F172A] mb-2">Job Notes</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this job..."
                className="w-full h-20 p-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0891B2]"
              />
            </div>

            {/* Signature */}
            <div>
              <p className="text-sm font-medium text-[#0F172A] mb-2">Customer Signature</p>
              <div
                onClick={() => setSignatureDone(!signatureDone)}
                className={`h-24 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
                  signatureDone ? "border-[#16A34A] bg-[#16A34A]/5" : "border-[#E2E8F0] bg-[#F8FAFC]"
                }`}
              >
                {signatureDone ? (
                  <div className="flex items-center gap-2 text-[#16A34A]">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Signed</span>
                  </div>
                ) : (
                  <span className="text-sm text-[#64748B]">Tap to capture customer signature</span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              {jobStatus !== "completed" && (
                <Button
                  className="w-full h-12 bg-[#0891B2] hover:bg-[#0E7490] text-white font-semibold gap-2"
                  onClick={() => {
                    const next = statusSteps[currentStepIdx + 1];
                    if (next) {
                      setJobStatus(next.id as any);
                    }
                  }}
                >
                  {currentStepIdx < 0 ? (
                    <>
                      <Navigation className="w-5 h-5" />
                      Start Job — Navigate to Site
                    </>
                  ) : (
                    <>
                      {(() => {
                        const Icon = statusSteps[currentStepIdx]?.icon || CheckCircle2;
                        return <Icon className="w-5 h-5" />;
                      })()}
                      {statusSteps[currentStepIdx]?.action || "Complete Job"}
                    </>
                  )}
                </Button>
              )}

              {jobStatus === "completed" && (
                <>
                  <Button className="w-full h-12 bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold gap-2">
                    <DollarSign className="w-5 h-5" />
                    Generate Invoice & Collect Payment
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-12 border-[#E2E8F0] text-[#0F172A]"
                    onClick={() => setJobStatus("dispatched")}
                  >
                    Reset Demo
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

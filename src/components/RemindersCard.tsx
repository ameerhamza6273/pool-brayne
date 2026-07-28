import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Calendar, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { jobsApi } from "@/lib/api/jobs";

type Reminder = {
  id: string;
  customer: string;
  task: string;
  dueDate: string;
  status: "upcoming" | "overdue" | "scheduled";
};

const statusColor = {
  overdue: "bg-[#EF4444]/10 text-[#EF4444]",
  upcoming: "bg-[#F59E0B]/10 text-[#F59E0B]",
  scheduled: "bg-[#16A34A]/10 text-[#16A34A]",
};

export default function RemindersCard() {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadReminders = useCallback(async () => {
    setIsLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const data = await jobsApi.upcoming();

    setReminders(
      data.map((j) => ({
        id: j.id,
        customer: j.customers?.name ?? "—",
        task: j.type,
        dueDate: j.scheduled_date,
        status: j.scheduled_date < today ? "overdue" : j.status === "Booked" || j.status === "Dispatched" ? "scheduled" : "upcoming",
      })),
    );
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  return (
    <Card className="border-[#E2E8F0] shadow-sm">
      <CardHeader className="pb-3 flex items-center justify-between">
        <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#0891B2]" />
          Upcoming Jobs
        </CardTitle>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-[#E2E8F0]" onClick={() => navigate("/jobs")}>
          <Calendar className="w-3.5 h-3.5" /> View All
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {isLoading && <p className="text-xs text-[#64748B] text-center py-4">Loading...</p>}
        {!isLoading && reminders.length === 0 && (
          <p className="text-xs text-[#64748B] text-center py-4">No upcoming jobs</p>
        )}
        {!isLoading && reminders.map((r) => (
          <button
            key={r.id}
            onClick={() => navigate(`/jobs/${r.id}`)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-[#0891B2]/10 flex items-center justify-center shrink-0">
              <Wrench className="w-4 h-4 text-[#0891B2]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0F172A] truncate">{r.task}</p>
              <p className="text-xs text-[#64748B] truncate">{r.customer}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-medium text-[#0F172A]">{r.dueDate}</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor[r.status]}`}>
                {r.status}
              </span>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

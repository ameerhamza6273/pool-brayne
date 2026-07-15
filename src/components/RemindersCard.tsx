import { Bell, Calendar, Wrench, Sparkles, Filter, Snowflake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Reminder = {
  id: string;
  customer: string;
  task: string;
  dueDate: string;
  frequency: string;
  icon: typeof Bell;
  priority: "high" | "medium" | "low";
  status: "upcoming" | "overdue" | "scheduled";
};

const reminders: Reminder[] = [
  { id: "1", customer: "James Thompson", task: "Filter Cleaning", dueDate: "2024-07-15", frequency: "Every 3 months", icon: Filter, priority: "high", status: "overdue" },
  { id: "2", customer: "Sunset Country Club", task: "Salt Cell Cleaning", dueDate: "2024-07-20", frequency: "Every 3 months", icon: Sparkles, priority: "high", status: "upcoming" },
  { id: "3", customer: "Maria & Carlos Rodriguez", task: "Filter Cleaning", dueDate: "2024-08-01", frequency: "Every 4 months", icon: Filter, priority: "medium", status: "scheduled" },
  { id: "4", customer: "Austin Aquatic Center", task: "Sand Change", dueDate: "2024-09-15", frequency: "Every 4 years", icon: Wrench, priority: "low", status: "scheduled" },
  { id: "5", customer: "The Henderson Family", task: "Pool Closing", dueDate: "2024-10-01", frequency: "Seasonal (3-6 months)", icon: Snowflake, priority: "medium", status: "scheduled" },
  { id: "6", customer: "James Thompson", task: "Salt Cell Cleaning", dueDate: "2024-07-28", frequency: "Every 4 months", icon: Sparkles, priority: "high", status: "upcoming" },
];

const priorityColor = {
  high: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20",
  medium: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20",
  low: "bg-[#0891B2]/10 text-[#0891B2] border-[#0891B2]/20",
};

const statusColor = {
  overdue: "bg-[#EF4444]/10 text-[#EF4444]",
  upcoming: "bg-[#F59E0B]/10 text-[#F59E0B]",
  scheduled: "bg-[#16A34A]/10 text-[#16A34A]",
};

export default function RemindersCard() {
  return (
    <Card className="border-[#E2E8F0] shadow-sm">
      <CardHeader className="pb-3 flex items-center justify-between">
        <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#0891B2]" />
          Future Job Reminders
        </CardTitle>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-[#E2E8F0]">
          <Calendar className="w-3.5 h-3.5" /> Add Reminder
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {reminders.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
              <div className="w-9 h-9 rounded-lg bg-[#0891B2]/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[#0891B2]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[#0F172A] truncate">{r.task}</p>
                  <Badge variant="outline" className={`text-[10px] h-5 ${priorityColor[r.priority]}`}>
                    {r.priority}
                  </Badge>
                </div>
                <p className="text-xs text-[#64748B] truncate">{r.customer} · {r.frequency}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium text-[#0F172A]">{r.dueDate}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor[r.status]}`}>
                  {r.status}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

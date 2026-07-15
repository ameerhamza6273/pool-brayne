import { useState } from "react";
import { Clock, MapPin, CheckCircle2, Users, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timesheetData, jobCosting, employees } from "@/lib/data";

export default function Timesheets() {
  const [clockedIn, setClockedIn] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [week] = useState("June 17 - June 23, 2024");
  const [approvedRows, setApprovedRows] = useState<string[]>([]);

  const totalHours = timesheetData.reduce((sum, t) => sum + t.total, 0);
  const totalOT = timesheetData.reduce((sum, t) => sum + t.ot, 0);
  const estPayroll = totalHours * 28 + totalOT * 42;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Timesheets</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Week of {week}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="bg-[#16A34A] hover:bg-[#15803D] text-white gap-2 h-10">
            <CheckCircle2 className="w-4 h-4" /> Approve Week
          </Button>
        </div>
      </div>

      {/* Clock In Card */}
      <Card className="border-[#E2E8F0] shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${clockedIn ? "bg-[#16A34A]/10" : "bg-[#F1F5F9]"}`}>
                <Clock className={`w-7 h-7 ${clockedIn ? "text-[#16A34A]" : "text-[#64748B]"}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-[#0F172A]">Bryan</p>
                <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                  <MapPin className="w-3 h-3 text-[#0891B2]" />
                  GPS-verified at job site
                </div>
                {clockedIn && (
                  <p className="text-lg font-bold text-[#0891B2] mt-0.5">
                    {Math.floor(elapsed / 3600).toString().padStart(2, "0")}:
                    {Math.floor((elapsed % 3600) / 60).toString().padStart(2, "0")}:
                    {(elapsed % 60).toString().padStart(2, "0")}
                  </p>
                )}
              </div>
            </div>
            <Button
              onClick={() => {
                setClockedIn(!clockedIn);
                if (!clockedIn) {
                  const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
                  setTimeout(() => clearInterval(interval), 100000);
                }
              }}
              className={`h-12 px-8 font-semibold ${clockedIn ? "bg-[#DC2626] hover:bg-[#B91C1C] text-white" : "bg-[#16A34A] hover:bg-[#15803D] text-white"}`}
            >
              {clockedIn ? "Clock Out" : "Clock In"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timesheet Table */}
      <Card className="border-[#E2E8F0] shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-[#0F172A]">Weekly Hours</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Employee</th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-[#64748B] uppercase">Mon</th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-[#64748B] uppercase">Tue</th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-[#64748B] uppercase">Wed</th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-[#64748B] uppercase">Thu</th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-[#64748B] uppercase">Fri</th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-[#64748B] uppercase">Sat</th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-[#64748B] uppercase">Sun</th>
                  <th className="text-right py-3 px-2 text-xs font-semibold text-[#64748B] uppercase">Total</th>
                  <th className="text-right py-3 px-2 text-xs font-semibold text-[#64748B] uppercase">OT</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Status</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {timesheetData.map((ts) => {
                  const isApproved = approvedRows.includes(ts.id);
                  return (
                    <tr key={ts.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#0F172A]">{ts.name}</span>
                          <Badge className={`${ts.type === "Contractor" ? "bg-[#F59E0B]/10 text-[#F59E0B]" : "bg-[#0891B2]/10 text-[#0891B2]"} text-[10px] px-1.5 py-0`}>
                            {ts.type}
                          </Badge>
                        </div>
                      </td>
                      <td className="text-center py-3 px-2 text-[#0F172A]">{ts.mon}</td>
                      <td className="text-center py-3 px-2 text-[#0F172A]">{ts.tue}</td>
                      <td className="text-center py-3 px-2 text-[#0F172A]">{ts.wed}</td>
                      <td className="text-center py-3 px-2 text-[#0F172A]">{ts.thu}</td>
                      <td className="text-center py-3 px-2 text-[#0F172A]">{ts.fri}</td>
                      <td className="text-center py-3 px-2 text-[#0F172A]">{ts.sat}</td>
                      <td className="text-center py-3 px-2 text-[#0F172A]">{ts.sun}</td>
                      <td className="text-right py-3 px-2 font-semibold text-[#0F172A]">{ts.total}</td>
                      <td className="text-right py-3 px-2 font-semibold text-[#F59E0B]">{ts.ot > 0 ? ts.ot : "—"}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className={`${isApproved ? "bg-[#16A34A]/10 text-[#16A34A]" : "bg-[#F59E0B]/10 text-[#F59E0B]"} text-[10px] px-1.5 py-0`}>
                          {isApproved ? "Approved" : ts.status}
                        </Badge>
                      </td>
                      <td className="text-center py-3 px-4">
                        {!isApproved && (
                          <Button
                            size="sm"
                            className="h-7 bg-[#0891B2] hover:bg-[#0E7490] text-white text-xs"
                            onClick={() => setApprovedRows([...approvedRows, ts.id])}
                          >
                            Approve
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Job Costing */}
        <Card className="border-[#E2E8F0] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#0F172A]">Job Costing</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">Tech</th>
                    <th className="text-left py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">Job</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">Hours</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">Labor Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {jobCosting.map((jc) => (
                    <tr key={jc.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-2 px-4 font-medium text-[#0F172A]">{jc.tech}</td>
                      <td className="py-2 px-4 text-sm text-[#64748B] truncate max-w-[200px]">{jc.job}</td>
                      <td className="text-right py-2 px-4 text-[#0F172A]">{jc.hours}</td>
                      <td className="text-right py-2 px-4 font-semibold text-[#0F172A]">${jc.laborCost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Payroll Export */}
        <Card className="border-[#E2E8F0] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#0F172A]">Payroll Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <p className="text-sm text-[#64748B]">No double entry, no manual reconciliation.</p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-11 border-[#E2E8F0] text-[#0F172A] gap-2">
                <Users className="w-4 h-4 text-[#0891B2]" /> Export to Gusto
              </Button>
              <Button variant="outline" className="h-11 border-[#E2E8F0] text-[#0F172A] gap-2">
                <Briefcase className="w-4 h-4 text-[#0891B2]" /> Export to ADP
              </Button>
            </div>
            <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#64748B] uppercase">Total Hours</p>
                  <p className="text-xl font-bold text-[#0F172A]">{totalHours.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase">Total OT</p>
                  <p className="text-xl font-bold text-[#F59E0B]">{totalOT.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase">Employees</p>
                  <p className="text-xl font-bold text-[#0F172A]">{employees.length}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase">Est. Payroll</p>
                  <p className="text-xl font-bold text-[#16A34A]">${estPayroll.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

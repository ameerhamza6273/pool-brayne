import { useState } from "react";
import { Bell, CheckCircle2, Truck, DollarSign, Package, MessageSquare, Wrench, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  type: "job" | "payment" | "inventory" | "message" | "fleet";
  title: string;
  description: string;
  time: string;
  read: boolean;
  link?: string;
}

const initialNotifications: Notification[] = [
  { id: "n1", type: "job", title: "Job completed", description: "Jose completed maintenance at James Thompson's pool", time: "2 min ago", read: false, link: "/jobs/j3" },
  { id: "n2", type: "payment", title: "Payment received", description: "$156.96 from The Henderson Family via Stripe", time: "15 min ago", read: false, link: "/invoicing" },
  { id: "n3", type: "inventory", title: "Low stock alert", description: "3\" Chlorine Tablets at 5 units (reorder: 10)", time: "1 hour ago", read: false, link: "/inventory" },
  { id: "n4", type: "message", title: "New SMS reply", description: "Maria Rodriguez: \"Can you come Tuesday instead?\"", time: "2 hours ago", read: false, link: "/campaigns" },
  { id: "n5", type: "fleet", title: "Vehicle alert", description: "Vehicle 3 (Truck 3) left geofence zone at 14:22", time: "3 hours ago", read: false, link: "/fleet" },
  { id: "n6", type: "job", title: "New booking", description: "New maintenance job booked for tomorrow at 9:00 AM", time: "5 hours ago", read: true, link: "/jobs" },
];

const iconMap: Record<string, React.ReactNode> = {
  job: <Wrench className="w-4 h-4 text-[#0891B2]" />,
  payment: <DollarSign className="w-4 h-4 text-[#16A34A]" />,
  inventory: <Package className="w-4 h-4 text-[#F59E0B]" />,
  message: <MessageSquare className="w-4 h-4 text-[#8B5CF6]" />,
  fleet: <Truck className="w-4 h-4 text-[#F59E0B]" />,
};

export default function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const navigate = useNavigate();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClick = (n: Notification) => {
    markAsRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative">
      <button
        className="relative p-2 rounded-lg hover:bg-[#F8FAFC] transition-colors"
        onClick={() => setOpen(!open)}
      >
        <Bell className="w-5 h-5 text-[#64748B]" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-[#DC2626] text-white border-0">
            {unreadCount}
          </Badge>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-[#E2E8F0] shadow-lg z-40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-[#0F172A]">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge className="bg-[#0891B2]/10 text-[#0891B2] text-[10px] px-1.5 py-0">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-[#0891B2] hover:text-[#0E7490] font-medium"
                  >
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[#F8FAFC]">
                  <X className="w-4 h-4 text-[#64748B]" />
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="w-8 h-8 text-[#E2E8F0] mx-auto mb-2" />
                  <p className="text-sm text-[#64748B]">No notifications</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left p-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors flex items-start gap-3 ${
                      !n.read ? "bg-[#0891B2]/5" : ""
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0 mt-0.5">
                      {iconMap[n.type] || <Bell className="w-4 h-4 text-[#64748B]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#0F172A]">{n.title}</p>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-[#0891B2] shrink-0" />}
                      </div>
                      <p className="text-xs text-[#64748B] mt-0.5">{n.description}</p>
                      <p className="text-xs text-[#64748B] mt-1">{n.time}</p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                        className="p-1 rounded hover:bg-[#E2E8F0] shrink-0 mt-0.5"
                        title="Mark as read"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0891B2]" />
                      </button>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

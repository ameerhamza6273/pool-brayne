import { useState, useEffect } from "react";
import { Bell, CheckCircle2, Truck, DollarSign, Package, MessageSquare, Wrench, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { notificationsApi, type Notification } from "@/lib/api/notifications";

const iconMap: Record<string, React.ReactNode> = {
  job: <Wrench className="w-4 h-4 text-[#0891B2]" />,
  payment: <DollarSign className="w-4 h-4 text-[#16A34A]" />,
  inventory: <Package className="w-4 h-4 text-[#F59E0B]" />,
  message: <MessageSquare className="w-4 h-4 text-[#8B5CF6]" />,
  fleet: <Truck className="w-4 h-4 text-[#F59E0B]" />,
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Client bug report 2026-09-04: this was entirely fake (hardcoded array, one link even pointed
// at a stale mock id "/jobs/j3" that 404s against real data) -- now computed live on the backend
// from real recent activity (completed jobs, payments, low stock, SMS replies, fleet alerts). No
// push/SMS/email channel exists to *create* notifications, so there's nothing to persist beyond
// the source tables -- "read" state is tracked client-side only (localStorage), same pattern as
// the Dashboard restock-list checkmarks.
const READ_STORAGE_KEY = "poolbrayne_read_notification_ids";

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore (private browsing / storage disabled)
  }
}

export default function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());
  const navigate = useNavigate();

  useEffect(() => {
    notificationsApi.list().then(setNotifications).catch(() => setNotifications([]));
  }, []);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev).add(id);
      saveReadIds(next);
      return next;
    });
  };

  const markAllRead = () => {
    setReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      saveReadIds(next);
      return next;
    });
  };

  const handleClick = (n: Notification) => {
    markAsRead(n.id);
    setOpen(false);
    navigate(n.link);
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
                notifications.map((n) => {
                  const read = readIds.has(n.id);
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`w-full text-left p-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors flex items-start gap-3 ${
                        !read ? "bg-[#0891B2]/5" : ""
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0 mt-0.5">
                        {iconMap[n.type] || <Bell className="w-4 h-4 text-[#64748B]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[#0F172A]">{n.title}</p>
                          {!read && <div className="w-2 h-2 rounded-full bg-[#0891B2] shrink-0" />}
                        </div>
                        <p className="text-xs text-[#64748B] mt-0.5">{n.description}</p>
                        <p className="text-xs text-[#64748B] mt-1">{timeAgo(n.time)}</p>
                      </div>
                      {!read && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                          className="p-1 rounded hover:bg-[#E2E8F0] shrink-0 mt-0.5"
                          title="Mark as read"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0891B2]" />
                        </button>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

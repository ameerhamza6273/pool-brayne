import { api } from "@/lib/apiClient";

export type Notification = {
  id: string;
  type: "job" | "payment" | "inventory" | "message" | "fleet";
  title: string;
  description: string;
  time: string;
  link: string;
};

export const notificationsApi = {
  list: () => api.get<Notification[]>("/api/notifications"),
};

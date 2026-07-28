import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type Automation = Database["public"]["Tables"]["automations"]["Row"];
type SeasonalCampaign = Database["public"]["Tables"]["seasonal_campaigns"]["Row"];
type SmsConversation = Database["public"]["Tables"]["sms_conversations"]["Row"] & { customers: { name: string } | null };
type SmsMessage = Database["public"]["Tables"]["sms_messages"]["Row"];
type Review = Database["public"]["Tables"]["reviews"]["Row"] & { customers: { name: string } | null };

export const campaignsApi = {
  all: () => api.get<{
    automations: Automation[];
    seasonalCampaigns: SeasonalCampaign[];
    smsConversations: SmsConversation[];
    smsMessages: SmsMessage[];
    reviews: Review[];
  }>("/api/campaigns"),

  createSeasonalCampaign: (data: { name: string; audience: number }) =>
    api.post<SeasonalCampaign>("/api/campaigns/seasonal", data),

  sendSmsReply: (conversationId: string, body: string) =>
    api.post<SmsMessage>("/api/campaigns/sms/reply", { conversationId, body }),
};

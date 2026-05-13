/**
 * Odoo Discuss client — minimal read-only slice over discuss.channel + mail.message.
 *
 * Reuses the same Keycloak-bearer proxy as crm/odoo.ts. Kept deliberately small:
 * listChannels() returns the channels the current user is a member of; listMessages()
 * returns messages for one channel newest-first. No composer, no realtime — first cut.
 */
import { call } from "../crm/odoo";

export type ChannelRow = {
  id: number;
  name: string;
  channelType: string;
  memberCount: number;
};

export type MessageRow = {
  id: number;
  authorName: string;
  body: string;
  date: string;
};

const m2o = (v: any): [number | null, string] => (Array.isArray(v) ? v : [null, ""]);

const stripHtml = (html: string): string => {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
};

export async function listChannels(): Promise<ChannelRow[]> {
  const rows = await call<any[]>(
    "discuss.channel",
    "search_read",
    [[["channel_type", "in", ["channel", "group", "chat"]]]],
    { fields: ["id", "name", "channel_type", "member_count"], limit: 100, order: "name asc" }
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name || "(unnamed)",
    channelType: r.channel_type || "channel",
    memberCount: r.member_count ?? 0,
  }));
}

export async function listMessages(channelId: number, limit = 50): Promise<MessageRow[]> {
  const rows = await call<any[]>(
    "mail.message",
    "search_read",
    [[
      ["model", "=", "discuss.channel"],
      ["res_id", "=", channelId],
      ["message_type", "in", ["comment", "email"]],
    ]],
    { fields: ["id", "author_id", "body", "date"], limit, order: "date desc" }
  );
  return rows
    .map((r) => {
      const [, authorName] = m2o(r.author_id);
      return {
        id: r.id,
        authorName: authorName || "System",
        body: stripHtml(r.body || ""),
        date: r.date || "",
      };
    })
    .reverse();
}

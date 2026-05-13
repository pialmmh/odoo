/**
 * Minimal Discuss UI — read-only browser for Odoo discuss.channel + mail.message.
 * Two-pane layout: channels on the left, messages on the right. No composer.
 */
import { useEffect, useState } from "react";
import {
  listChannels,
  listMessages,
  type ChannelRow,
  type MessageRow,
} from "@/services/discuss/odoo-discuss";

const formatDate = (s: string): string => {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? s : d.toLocaleString();
};

export function DiscussPage() {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(true);

  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setChannelsLoading(true);
    listChannels()
      .then((rows) => {
        if (cancelled) return;
        setChannels(rows);
        if (rows.length > 0) setActiveId(rows[0].id);
      })
      .catch((e) => {
        if (!cancelled) setChannelsError(e?.message || String(e));
      })
      .finally(() => {
        if (!cancelled) setChannelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeId == null) return;
    let cancelled = false;
    setMessagesLoading(true);
    setMessagesError(null);
    listMessages(activeId)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch((e) => {
        if (!cancelled) setMessagesError(e?.message || String(e));
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const activeChannel = channels.find((c) => c.id === activeId) || null;

  return (
    <div data-testid="discuss-page" className="flex h-full w-full overflow-hidden">
      <aside
        data-testid="discuss-channels"
        className="w-64 flex-shrink-0 border-r border-subtle bg-surface-1 overflow-y-auto"
      >
        <div className="px-3 py-2 border-b border-subtle text-13 font-semibold text-secondary">
          Channels
        </div>
        {channelsLoading ? (
          <div className="px-3 py-2 text-12 text-tertiary italic">Loading…</div>
        ) : channelsError ? (
          <div className="px-3 py-2 text-12 text-danger-primary">{channelsError}</div>
        ) : channels.length === 0 ? (
          <div className="px-3 py-2 text-12 text-tertiary italic">No channels.</div>
        ) : (
          <ul>
            {channels.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  data-testid={`discuss-channel-${c.id}`}
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left px-3 py-1.5 text-13 truncate hover:bg-layer-transparent-hover ${
                    c.id === activeId ? "bg-accent-primary/10 text-accent-primary font-medium" : "text-primary"
                  }`}
                  title={c.name}
                >
                  # {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section
        data-testid="discuss-messages"
        className="flex-1 flex flex-col overflow-hidden bg-surface-1"
      >
        <header className="px-4 py-2 border-b border-subtle">
          <div className="text-14 font-semibold text-primary">
            {activeChannel ? `# ${activeChannel.name}` : "Select a channel"}
          </div>
          {activeChannel && (
            <div className="text-11 text-tertiary">
              {activeChannel.channelType} · {activeChannel.memberCount} member
              {activeChannel.memberCount === 1 ? "" : "s"}
            </div>
          )}
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {activeId == null ? (
            <div className="text-12 italic text-tertiary">Pick a channel on the left.</div>
          ) : messagesLoading ? (
            <div className="text-12 italic text-tertiary">Loading messages…</div>
          ) : messagesError ? (
            <div className="text-12 text-danger-primary">{messagesError}</div>
          ) : messages.length === 0 ? (
            <div className="text-12 italic text-tertiary">No messages in this channel.</div>
          ) : (
            <ul className="flex flex-col gap-3">
              {messages.map((m) => (
                <li key={m.id} data-testid={`discuss-message-${m.id}`} className="flex flex-col">
                  <div className="flex items-baseline gap-2">
                    <span className="text-13 font-semibold text-primary">{m.authorName}</span>
                    <span className="text-11 text-tertiary">{formatDate(m.date)}</span>
                  </div>
                  <div className="text-13 text-secondary whitespace-pre-wrap">{m.body}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

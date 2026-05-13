/**
 * FullPageChat — WhatsApp-Web / Rocket.Chat-style full-screen chat surface.
 *
 * Left rail: search box + filter chips + Pinned / Channels / Direct messages
 *            sectioned conversation rows.
 * Main pane: channel header + ChatThread (message list + composer).
 *
 * Pure presentation against the mock chat-store. Sibling worktree's
 * floating ChatLauncher and per-lead ChatPanel share the same store, so
 * messages posted here show up there too.
 */
import { useMemo, useState } from "react";
import {
  Hash,
  MoreVertical,
  Pin,
  Search,
  Tag,
  Users,
} from "lucide-react";
// store
import { ChatThread } from "./chat-thread";
import {
  setActiveChannel,
  useChatState,
  type ChatChannel,
  type ChatMember,
  type ChatMessage,
  type MemberStatus,
} from "./chat-store";

const STATUS_COLOR: Record<MemberStatus, string> = {
  online: "#10b981",
  away: "#f59e0b",
  busy: "#ef4444",
  offline: "#a1a1aa",
};

type FilterKey = "all" | "unread" | "mentions";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "mentions", label: "Mentions" },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "?";

const formatRowTime = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const channelLabel = (c: ChatChannel) =>
  c.leadId ? `lead-${c.id.replace(/^c-lead-/, "")}` : c.name;

function Avatar({
  member,
  size = 8,
  status,
}: {
  member?: ChatMember;
  size?: 6 | 8 | 9;
  status?: MemberStatus;
}) {
  const sizeCls = size === 9 ? "size-9 text-12" : size === 8 ? "size-8 text-11" : "size-6 text-10";
  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${sizeCls} flex items-center justify-center rounded-full text-white font-semibold`}
        style={{ backgroundColor: member?.avatarColor || "#71717a" }}
      >
        {initials(member?.name || "?")}
      </div>
      {status && (
        <span
          className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface-1"
          style={{ backgroundColor: STATUS_COLOR[status] }}
        />
      )}
    </div>
  );
}

function ChannelIcon({ channel }: { channel: ChatChannel }) {
  if (channel.dmUserId) return null;
  if (channel.leadId) {
    return (
      <div className="size-8 rounded-md bg-amber-500/10 flex items-center justify-center flex-shrink-0">
        <Tag className="size-4 text-amber-500" />
      </div>
    );
  }
  return (
    <div className="size-8 rounded-md bg-accent-primary/10 flex items-center justify-center flex-shrink-0">
      <Hash className="size-4 text-accent-primary" />
    </div>
  );
}

function UnreadBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span
      className="inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-10 font-semibold text-white"
      style={{ backgroundColor: "#ef4444" }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function lastMessageOf(messages: ChatMessage[] | undefined): ChatMessage | undefined {
  if (!messages || messages.length === 0) return undefined;
  return messages[messages.length - 1];
}

function ConversationRow({ channelId }: { channelId: string }) {
  const channel = useChatState((s) => s.channels[channelId]);
  const members = useChatState((s) => s.members);
  const messages = useChatState((s) => s.messagesByChannel[channelId]);
  const isActive = useChatState((s) => s.activeChannelId === channelId);
  if (!channel) return null;

  const dmMember = channel.dmUserId ? members[channel.dmUserId] : undefined;
  const last = lastMessageOf(messages);
  const isLead = !!channel.leadId;
  const title = dmMember?.name || channelLabel(channel);

  return (
    <button
      type="button"
      onClick={() => setActiveChannel(channelId)}
      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left ${
        isActive ? "bg-accent-primary/10" : "hover:bg-layer-transparent-hover"
      }`}
    >
      {dmMember ? (
        <Avatar member={dmMember} size={8} status={dmMember.status} />
      ) : (
        <ChannelIcon channel={channel} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span
            className={`truncate text-13 font-semibold ${
              isLead ? "text-amber-600" : isActive ? "text-accent-primary" : "text-primary"
            }`}
          >
            {title}
          </span>
          {last && (
            <span className="ml-auto flex-shrink-0 text-11 text-tertiary">
              {formatRowTime(last.ts)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="truncate text-11 text-tertiary flex-1 min-w-0">
            {last
              ? last.kind === "system"
                ? `— ${last.body}`
                : `${last.authorName.split(" ")[0]}: ${last.body}`
              : "No messages yet"}
          </span>
          <UnreadBadge count={channel.unread} />
        </div>
      </div>
    </button>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-2.5 pt-3 pb-1 text-10 uppercase tracking-wider text-tertiary">{label}</div>
  );
}

function ChannelHeader({ channel }: { channel: ChatChannel }) {
  const members = useChatState((s) => s.members);
  const isLead = !!channel.leadId;
  const dmMember = channel.dmUserId ? members[channel.dmUserId] : undefined;

  return (
    <header className="flex items-center justify-between border-b border-subtle bg-surface-1 px-4 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        {dmMember ? (
          <Avatar member={dmMember} size={9} status={dmMember.status} />
        ) : isLead ? (
          <div className="size-9 rounded-md bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <Tag className="size-4 text-amber-500" />
          </div>
        ) : (
          <div className="size-9 rounded-md bg-accent-primary/10 flex items-center justify-center flex-shrink-0">
            <Hash className="size-4 text-accent-primary" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-13 font-semibold truncate ${
                isLead ? "text-amber-600" : "text-accent-primary"
              }`}
            >
              {dmMember?.name || channelLabel(channel)}
            </span>
            <span className="text-11 text-tertiary inline-flex items-center gap-1 flex-shrink-0">
              <Users className="size-3" />
              {channel.memberIds.length}
            </span>
          </div>
          {channel.topic && (
            <div className="text-11 text-tertiary truncate">{channel.topic}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="text-11 text-tertiary hover:text-accent-primary px-2 py-1"
          title="Open in Rocket.Chat (mock)"
        >
          Open in Rocket.Chat
        </a>
        <button
          type="button"
          aria-label="Search in channel"
          className="rounded p-1.5 text-tertiary hover:bg-layer-transparent-hover hover:text-primary"
        >
          <Search className="size-4" />
        </button>
        <button
          type="button"
          aria-label="More"
          className="rounded p-1.5 text-tertiary hover:bg-layer-transparent-hover hover:text-primary"
        >
          <MoreVertical className="size-4" />
        </button>
      </div>
    </header>
  );
}

function EmptyPane() {
  return (
    <div className="flex h-full items-center justify-center text-13 italic text-tertiary">
      Pick a conversation from the left to start chatting.
    </div>
  );
}

export function FullPageChat() {
  const channelOrder = useChatState((s) => s.channelOrder);
  const channels = useChatState((s) => s.channels);
  const dmUserIds = useChatState((s) => s.dmUserIds);
  const messagesByChannel = useChatState((s) => s.messagesByChannel);
  const activeChannelId = useChatState((s) => s.activeChannelId);
  const activeChannel = activeChannelId ? channels[activeChannelId] : null;

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  // partition channels
  const { pinned, regular, dmIds } = useMemo(() => {
    const norm = query.trim().toLowerCase();
    const passes = (c: ChatChannel) => {
      if (norm) {
        const label = (c.dmUserId ? "" : channelLabel(c)).toLowerCase();
        const dmName = c.dmUserId ? (channels[c.id]?.name || "").toLowerCase() : "";
        if (!label.includes(norm) && !dmName.includes(norm)) return false;
      }
      if (filter === "unread") {
        const last = lastMessageOf(messagesByChannel[c.id]);
        if (!c.unread && !last) return false;
        if (!c.unread) return false;
      }
      // "mentions" filter is a stub against the mock store — leave permissive
      return true;
    };

    const pinned: string[] = [];
    const regular: string[] = [];
    const dms: string[] = [];

    for (const id of channelOrder) {
      const c = channels[id];
      if (!c) continue;
      if (!passes(c)) continue;
      if (c.dmUserId) {
        // skip — DMs handled below to honor dmUserIds order
        continue;
      }
      if (c.leadId || c.isLive) pinned.push(id);
      else regular.push(id);
    }

    for (const uid of dmUserIds) {
      const id = `c-dm-${uid}`;
      const c = channels[id];
      if (!c) continue;
      if (!passes(c)) continue;
      dms.push(id);
    }

    return { pinned, regular, dmIds: dms };
  }, [channelOrder, channels, dmUserIds, messagesByChannel, query, filter]);

  return (
    <div className="flex h-full w-full min-h-0">
      {/* LEFT RAIL */}
      <aside className="w-[320px] flex-shrink-0 flex flex-col border-r border-subtle bg-surface-2 min-h-0">
        <div className="px-3 pt-3 pb-2 border-b border-subtle">
          <div className="flex items-center gap-2 rounded-md border border-subtle bg-layer-2 px-2 py-1.5 focus-within:border-accent-strong">
            <Search className="size-3.5 text-tertiary" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations…"
              className="flex-1 bg-transparent text-13 text-primary placeholder-tertiary outline-none"
            />
          </div>
          <div className="mt-2 flex items-center gap-1">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`text-11 px-2 py-0.5 rounded-full ${
                    active
                      ? "bg-accent-primary text-white"
                      : "bg-layer-1 text-secondary hover:bg-layer-transparent-hover"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto py-1 px-1.5">
          {pinned.length > 0 && (
            <>
              <div className="flex items-center gap-1 px-2.5 pt-3 pb-1 text-10 uppercase tracking-wider text-tertiary">
                <Pin className="size-3" /> Pinned
              </div>
              {pinned.map((id) => (
                <ConversationRow key={id} channelId={id} />
              ))}
            </>
          )}

          {regular.length > 0 && (
            <>
              <SectionHeader label="Channels" />
              {regular.map((id) => (
                <ConversationRow key={id} channelId={id} />
              ))}
            </>
          )}

          {dmIds.length > 0 && (
            <>
              <SectionHeader label="Direct messages" />
              {dmIds.map((id) => (
                <ConversationRow key={id} channelId={id} />
              ))}
            </>
          )}

          {pinned.length === 0 && regular.length === 0 && dmIds.length === 0 && (
            <div className="px-3 py-6 text-center text-11 italic text-tertiary">
              No conversations match.
            </div>
          )}
        </div>
      </aside>

      {/* MAIN PANE */}
      <section className="flex-1 min-w-0 flex flex-col bg-surface-1 min-h-0">
        {activeChannel ? (
          <>
            <ChannelHeader channel={activeChannel} />
            <div className="flex-1 min-h-0">
              <ChatThread channelId={activeChannel.id} />
            </div>
          </>
        ) : (
          <EmptyPane />
        )}
      </section>
    </div>
  );
}

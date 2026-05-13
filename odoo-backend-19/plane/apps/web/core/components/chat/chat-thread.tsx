/**
 * ChatThread — message list + composer. Used by both the embedded
 * LeadChatPanel (lead detail page) and the docked ChatLauncher panel.
 *
 * Pure presentation wired to chat-store; no per-channel-type branching.
 */
import { useEffect, useRef, useState } from "react";
import { Paperclip, Send, Smile } from "lucide-react";
// store
import { postMessage, useChatState, type ChatMember, type ChatMessage } from "./chat-store";

type Props = {
  channelId: string;
  /** compact mode (smaller paddings, smaller avatars) for the docked launcher */
  compact?: boolean;
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "?";

function Avatar({ member, size }: { member: ChatMember | undefined; size: "sm" | "md" }) {
  const cls = size === "sm" ? "size-5 text-10" : "size-6 text-10";
  return (
    <div
      className={`${cls} flex items-center justify-center rounded-full text-white font-semibold flex-shrink-0`}
      style={{ backgroundColor: member?.avatarColor || "#71717a" }}
    >
      {initials(member?.name || "?")}
    </div>
  );
}

function MessageRow({
  msg,
  members,
  compact,
  meId,
}: {
  msg: ChatMessage;
  members: Record<string, ChatMember>;
  compact: boolean;
  meId: string;
}) {
  if (msg.kind === "system") {
    return (
      <div className="py-0.5">
        <span className="text-11 text-tertiary italic">— {msg.body}</span>
      </div>
    );
  }
  const member = members[msg.authorId];
  const isMine = msg.authorId === meId;
  return (
    <div className={`${compact ? "py-1" : "py-1.5"} ${isMine ? "border-l-2 border-accent-primary/60 pl-2 -ml-2" : ""}`}>
      <div className="flex items-center gap-1.5">
        <Avatar member={member} size={compact ? "sm" : "md"} />
        <span className={`text-13 font-semibold ${isMine ? "text-accent-primary" : "text-primary"}`}>
          {msg.authorName}
        </span>
        <span className="text-11 text-tertiary">{formatTime(msg.ts)}</span>
      </div>
      <div className="text-13 text-primary whitespace-pre-wrap break-words">{msg.body}</div>
    </div>
  );
}

export function ChatThread({ channelId, compact = false }: Props) {
  const messages = useChatState((s) => s.messagesByChannel[channelId] || []);
  const members = useChatState((s) => s.members);
  const meId = useChatState((s) => s.meId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pin scroll to bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, channelId]);

  const handleSend = () => {
    if (!draft.trim()) return;
    postMessage(channelId, draft);
    setDraft("");
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-0.5`}
      >
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-13 italic text-tertiary">
            No messages yet — say hi 👋
          </div>
        )}
        {messages.map((m) => (
          <MessageRow key={m.id} msg={m} members={members} compact={compact} meId={meId} />
        ))}
      </div>
      <div className="border-t border-subtle bg-surface-1 px-3 py-2">
        <div className="flex items-end gap-2 rounded-md border border-subtle bg-layer-2 px-2 py-1.5 focus-within:border-accent-strong">
          <button
            type="button"
            aria-label="Attach"
            className="rounded p-1 text-emerald-500 hover:bg-emerald-500/10"
          >
            <Paperclip className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Emoji"
            className="rounded p-1 text-amber-500 hover:bg-amber-500/10"
          >
            <Smile className="size-3.5" />
          </button>
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message…"
            className="flex-1 resize-none bg-transparent text-13 text-primary placeholder-tertiary outline-none max-h-32"
          />
          <button
            type="button"
            aria-label="Send"
            onClick={handleSend}
            disabled={!draft.trim()}
            className="rounded-md bg-accent-primary p-1.5 text-white disabled:opacity-40 hover:bg-accent-primary/90"
          >
            <Send className="size-3.5" />
          </button>
        </div>
        <p className="mt-1 text-11 text-tertiary">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}

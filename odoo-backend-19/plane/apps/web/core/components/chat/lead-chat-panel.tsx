/**
 * LeadChatPanel — Rocket.Chat–style channel pinned to a single CRM lead.
 *
 * Mounted in the lead detail page where the "Stream" panel used to live.
 * Channel id is `c-lead-<leadId>` (deterministic), so message state is shared
 * with the floating ChatLauncher when the user opens the same channel there.
 */
import { useEffect } from "react";
import { ExternalLink, Hash, Users } from "lucide-react";
// store
import { ensureLeadChannel, openChannel, useChatState } from "./chat-store";
import { ChatThread } from "./chat-thread";

type Props = {
  leadId: string;
  leadName: string;
  ownerName?: string;
};

export function LeadChatPanel({ leadId, leadName, ownerName }: Props) {
  // Get-or-create the channel synchronously on mount. ensureLeadChannel
  // is idempotent — re-renders return the existing channel.
  useEffect(() => {
    ensureLeadChannel({ leadId, leadName, ownerName });
  }, [leadId, leadName, ownerName]);

  const channelId = `c-lead-${leadId}`;
  const channel = useChatState((s) => s.channels[channelId]);
  const members = useChatState((s) => s.members);

  if (!channel) return null;

  const channelMembers = channel.memberIds
    .map((id) => members[id])
    .filter(Boolean)
    .slice(0, 5);

  return (
    <div className="rounded-md border border-subtle bg-surface-1 overflow-hidden">
      {/* Channel header */}
      <div className="flex items-center gap-3 border-b border-subtle bg-accent-primary/5 px-3 py-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Hash className="size-4 text-accent-primary flex-shrink-0" />
          <span className="text-13 font-semibold text-accent-primary truncate">{channel.name}</span>
          {channel.topic && (
            <span className="text-12 text-tertiary truncate hidden md:inline">· {channel.topic}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center -space-x-1.5">
            {channelMembers.map((m) => (
              <div
                key={m.id}
                title={m.name}
                className="size-6 rounded-full border-2 border-surface-2 text-white text-10 font-semibold flex items-center justify-center"
                style={{ backgroundColor: m.avatarColor }}
              >
                {m.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase())
                  .join("")}
              </div>
            ))}
          </div>
          <span className="text-11 text-tertiary inline-flex items-center gap-1 whitespace-nowrap">
            <Users className="size-3" />
            {channel.memberIds.length}
          </span>
          <button
            type="button"
            onClick={() => openChannel(channelId)}
            title="Open in Rocket.Chat"
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-12 text-accent-primary hover:bg-surface-1 whitespace-nowrap"
          >
            <ExternalLink className="size-3.5" />
            <span className="hidden lg:inline">Open in Rocket.Chat</span>
          </button>
        </div>
      </div>

      {/* Thread — fixed-ish height so the page stays usable. */}
      <div className="h-[420px]">
        <ChatThread channelId={channelId} />
      </div>
    </div>
  );
}

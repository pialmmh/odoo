/**
 * ChatLauncher — floating conversation panel.
 *
 * After merging the chat menu into Plane's main sidebar (ChatSidebar), this
 * panel is conversation-only. It opens automatically when the user clicks any
 * channel/DM/quick-item in the sidebar (`openChannel` / `setActiveQuick`)
 * and can be reopened anytime via the small floating button.
 */
import {
  CircleDot,
  Hash,
  MessageCircle,
  Tag,
  Users,
  X,
} from "lucide-react";
// store
import {
  QUICK_ITEMS,
  setLauncherOpen,
  useChatState,
  type ChatChannel,
} from "./chat-store";
import { ChatThread } from "./chat-thread";

const channelLabel = (c: ChatChannel) =>
  c.leadId ? `lead-${c.id.replace(/^c-lead-/, "")}` : c.name;

export function ChatLauncher() {
  const open = useChatState((s) => s.launcherOpen);
  const channels = useChatState((s) => s.channels);
  const activeChannelId = useChatState((s) => s.activeChannelId);
  const activeQuickId = useChatState((s) => s.activeQuickId);
  const active = activeChannelId ? channels[activeChannelId] : null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setLauncherOpen(true)}
          className="fixed bottom-5 right-5 z-50 inline-flex items-center justify-center size-11 rounded-full bg-accent-primary text-white shadow-lg hover:bg-accent-primary/90"
          aria-label="Open chat"
          title="Open chat"
        >
          <MessageCircle className="size-5" />
        </button>
      )}

      {open && (
        <div
          className="fixed right-4 bottom-4 z-50 flex w-[560px] max-w-[95vw] h-[560px] max-h-[80vh] rounded-md border border-subtle bg-surface-1 shadow-2xl overflow-hidden flex-col"
          role="dialog"
          aria-label="Chat"
        >
          <header className="flex items-center justify-between border-b border-subtle bg-accent-primary/5 px-3 py-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {activeQuickId ? (
                <>
                  <CircleDot className="size-4 text-accent-primary flex-shrink-0" />
                  <span className="text-13 font-semibold text-accent-primary truncate">
                    {QUICK_ITEMS.find((q) => q.id === activeQuickId)?.label}
                  </span>
                </>
              ) : active?.dmUserId ? (
                <>
                  <Users className="size-4 text-accent-primary flex-shrink-0" />
                  <span className="text-13 font-semibold text-accent-primary truncate">{active.name}</span>
                </>
              ) : active?.leadId ? (
                <>
                  <Tag className="size-4 text-amber-500 flex-shrink-0" />
                  <span className="text-13 font-semibold text-amber-600 truncate">
                    {channelLabel(active)}
                  </span>
                </>
              ) : active ? (
                <>
                  <Hash className="size-4 text-accent-primary flex-shrink-0" />
                  <span className="text-13 font-semibold text-accent-primary truncate">
                    {channelLabel(active)}
                  </span>
                </>
              ) : (
                <span className="text-13 text-tertiary">Pick a channel from the sidebar</span>
              )}
              {active?.topic && (
                <span className="text-12 text-tertiary truncate hidden md:inline">· {active.topic}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setLauncherOpen(false)}
              aria-label="Close chat"
              className="rounded p-1 text-tertiary hover:bg-surface-2 hover:text-primary"
            >
              <X className="size-4" />
            </button>
          </header>
          <div className="flex-1 min-h-0">
            {activeQuickId ? (
              <div className="flex h-full items-center justify-center text-13 italic text-tertiary px-6 text-center">
                <div>
                  <div className="text-secondary mb-1">
                    {QUICK_ITEMS.find((q) => q.id === activeQuickId)?.label}
                  </div>
                  <div>Mock view — your items would land here.</div>
                </div>
              </div>
            ) : active ? (
              <ChatThread channelId={active.id} compact />
            ) : (
              <div className="flex h-full items-center justify-center text-13 italic text-tertiary">
                Pick a channel to start chatting.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

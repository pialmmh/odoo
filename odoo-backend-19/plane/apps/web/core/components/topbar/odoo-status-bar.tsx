/**
 * OdooStatusBar — fixed top-right notification cluster, modeled on Odoo's
 * navbar. Four elements (right→left mirroring the Odoo screenshot):
 *
 *   [Discuss icon + unread]   → links to the full-page chat
 *   [Activities clock + count] → dropdown of pending activities (mock store)
 *   [Notifications bell + count] → dropdown of all notifications, seen/unseen
 *   [Company name] [User avatar]
 *
 * Notification state lives in `notification-store.ts`. The Discuss unread
 * count is read live from `chat-store` so it stays in sync with the rest of
 * the chat UI.
 */
import { Fragment, useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Link, useNavigate, useParams } from "react-router";
import { Popover, Transition } from "@headlessui/react";
import {
  AtSign,
  Bell,
  Check,
  CheckCheck,
  CircleAlert,
  Clock,
  MessageSquare,
  RotateCcw,
  X,
} from "lucide-react";
// store hooks
import { useChatState } from "@/components/chat/chat-store";
import { useUser } from "@/hooks/store/user";
// notifications
import {
  dismiss,
  markAllAsSeen,
  markAsSeen,
  markAsUnseen,
  useNotifications,
  type Notification,
  type NotificationKind,
} from "./notification-store";

const formatRelative = (ts: number) => {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const KIND_ICON: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  mention: AtSign,
  activity: Clock,
  system: CircleAlert,
  discuss: MessageSquare,
};

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      data-testid="topbar-badge"
      className="absolute -top-1 -right-1 inline-flex min-w-[16px] h-4 items-center justify-center rounded-full px-1 text-9 font-bold text-white pointer-events-none"
      style={{ backgroundColor: "#10b981" }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NotificationRow({ n }: { n: Notification }) {
  const Icon = KIND_ICON[n.kind] || Bell;
  return (
    <div
      data-testid={`notif-row-${n.id}`}
      data-seen={n.seen ? "true" : "false"}
      className={`group relative flex gap-2 border-b border-subtle px-3 py-2 last:border-b-0 hover:bg-layer-transparent-hover ${
        n.seen ? "" : "bg-accent-primary/5"
      }`}
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-0.5"
        style={{ backgroundColor: n.seen ? "transparent" : n.accent || "#3b82f6" }}
        aria-hidden
      />
      <div
        className="size-7 flex-shrink-0 rounded-full flex items-center justify-center text-white"
        style={{ backgroundColor: n.accent || "#3b82f6" }}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-13 ${n.seen ? "text-secondary font-medium" : "text-primary font-semibold"} truncate`}>
            {n.title}
          </span>
          {!n.seen && (
            <span
              data-testid={`unseen-dot-${n.id}`}
              className="size-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: "#10b981" }}
              aria-label="Unseen"
            />
          )}
          <span className="ml-auto text-11 text-tertiary flex-shrink-0">{formatRelative(n.timestamp)}</span>
        </div>
        <div className={`text-12 ${n.seen ? "text-tertiary" : "text-secondary"} line-clamp-2`}>{n.body}</div>
      </div>
      <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
        {n.seen ? (
          <button
            type="button"
            onClick={() => markAsUnseen(n.id)}
            data-testid={`btn-mark-unseen-${n.id}`}
            aria-label="Mark as unseen"
            className="rounded p-1 bg-surface-2 text-secondary hover:text-primary"
          >
            <RotateCcw className="size-3" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => markAsSeen(n.id)}
            data-testid={`btn-mark-seen-${n.id}`}
            aria-label="Mark as seen"
            className="rounded p-1 bg-surface-2 text-secondary hover:text-primary"
          >
            <Check className="size-3" />
          </button>
        )}
        <button
          type="button"
          onClick={() => dismiss(n.id)}
          data-testid={`btn-dismiss-${n.id}`}
          aria-label="Dismiss"
          className="rounded p-1 bg-surface-2 text-secondary hover:text-danger-primary"
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  );
}

function Dropdown({
  title,
  items,
  emptyMessage,
  showAllSeen,
}: {
  title: string;
  items: Notification[];
  emptyMessage: string;
  showAllSeen?: boolean;
}) {
  return (
    <div className="w-[360px] max-h-[480px] flex flex-col bg-surface-1 rounded-md shadow-2xl border border-subtle overflow-hidden">
      <div className="flex items-center justify-between border-b border-subtle px-3 py-2 bg-accent-primary/5">
        <span className="text-13 font-semibold text-accent-primary">{title}</span>
        {showAllSeen && items.some((n) => !n.seen) && (
          <button
            type="button"
            onClick={() => markAllAsSeen()}
            data-testid="btn-mark-all-seen"
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-11 text-accent-primary hover:bg-accent-primary/10"
          >
            <CheckCheck className="size-3" />
            Mark all seen
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-12 italic text-tertiary px-4 text-center">
            {emptyMessage}
          </div>
        ) : (
          items.map((n) => <NotificationRow key={n.id} n={n} />)
        )}
      </div>
    </div>
  );
}

function userInitial(user: { first_name?: string; email?: string } | null | undefined) {
  if (!user) return "?";
  const fn = (user.first_name || "").trim();
  if (fn) return fn[0].toUpperCase();
  const em = (user.email || "").trim();
  return em ? em[0].toUpperCase() : "?";
}

const COMPANY_NAME = "My Company";

export const OdooStatusBar = observer(function OdooStatusBar() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { data: user } = useUser();
  const navigate = useNavigate();

  // Render only after client mount. Plane uses React Router framework SSR;
  // Date.now() in the notification seed plus user/chat store both differ
  // between server and client, which causes hydration error #418 and a flash
  // of the maintenance-mode fallback. Skipping SSR for this fixed cluster
  // costs nothing visually and removes the mismatch entirely.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const channels = useChatState((s) => s.channels);
  const chatUnread = Object.values(channels).reduce((sum, c) => sum + (c?.unread || 0), 0);

  const { items } = useNotifications();
  const totalUnseen = items.filter((n) => !n.seen).length;
  const activityItems = items.filter((n) => n.kind === "activity");
  const activityUnseen = activityItems.filter((n) => !n.seen).length;

  const initial = userInitial(user as { first_name?: string; email?: string } | null);

  if (!mounted) return null;

  const goToFullChat = () => {
    if (workspaceSlug) navigate(`/${workspaceSlug}/chat`);
  };

  return (
    <div
      data-testid="odoo-status-bar"
      className="fixed top-0 right-0 z-[100] flex items-center gap-3 bg-surface-1 px-4 py-1.5 border-b border-l border-subtle rounded-bl-md shadow-sm"
    >
      {/* Discuss / chat shortcut */}
      <button
        type="button"
        onClick={goToFullChat}
        data-testid="topbar-chat-button"
        aria-label="Open full chat"
        className="relative inline-flex items-center justify-center rounded p-1 hover:bg-layer-transparent-hover"
        title="Open full chat"
      >
        <MessageSquare className="size-5 text-secondary" />
        <CountBadge count={chatUnread} />
      </button>

      {/* Activities clock — dropdown of activity-kind notifications */}
      <Popover className="relative">
        <Popover.Button
          as="button"
          data-testid="topbar-activities-button"
          aria-label="Activities"
          className="relative inline-flex items-center justify-center rounded p-1 hover:bg-layer-transparent-hover focus:outline-none"
          title="Activities"
        >
          <Clock className="size-5 text-secondary" />
          <CountBadge count={activityUnseen} />
        </Popover.Button>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-75"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
        >
          <Popover.Panel className="absolute right-0 top-full mt-1.5 z-[110]" data-testid="activities-panel">
            <Dropdown
              title="Activities"
              items={activityItems}
              emptyMessage="No pending activities."
              showAllSeen
            />
          </Popover.Panel>
        </Transition>
      </Popover>

      {/* Notifications bell — all notifications */}
      <Popover className="relative">
        <Popover.Button
          as="button"
          data-testid="topbar-bell-button"
          aria-label="Notifications"
          className="relative inline-flex items-center justify-center rounded p-1 hover:bg-layer-transparent-hover focus:outline-none"
          title="Notifications"
        >
          <Bell className="size-5 text-secondary" />
          <CountBadge count={totalUnseen} />
        </Popover.Button>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-75"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
        >
          <Popover.Panel className="absolute right-0 top-full mt-1.5 z-[110]" data-testid="notifications-panel">
            <Dropdown
              title="Notifications"
              items={items}
              emptyMessage="You're all caught up."
              showAllSeen
            />
          </Popover.Panel>
        </Transition>
      </Popover>

      {/* Company name */}
      <span data-testid="topbar-company" className="text-13 text-secondary hidden sm:inline">
        {COMPANY_NAME}
      </span>

      {/* Avatar */}
      <div
        data-testid="topbar-avatar"
        className="size-7 rounded-full flex items-center justify-center text-white text-13 font-semibold"
        style={{ backgroundColor: "#8b5cf6" }}
        title={(user as { display_name?: string } | null)?.display_name || (user as { email?: string } | null)?.email || ""}
      >
        {initial}
      </div>
    </div>
  );
});

/**
 * Mock notification store — module-level state with subscribe semantics.
 *
 * Stand-in for Odoo's mail.activity / bus.bus feed, so the top bar's bell +
 * activities clock can show real seen/unseen behavior end-to-end without
 * needing the Odoo XML-RPC integration in place. The shape (id, kind, title,
 * timestamp, seen) mirrors what Odoo's notification API returns so swapping
 * in a real client later is a transport change.
 */
import { useSyncExternalStore } from "react";

export type NotificationKind = "activity" | "system" | "mention" | "discuss";

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** ms epoch */
  timestamp: number;
  seen: boolean;
  /** optional in-app navigation target when the user clicks the row */
  href?: string;
  /** colored accent for the row's left strip — purely visual */
  accent?: string;
};

type NotificationState = {
  items: Notification[];
};

const tMin = (m: number) => Date.now() - m * 60_000;

const seed: Notification[] = [
  {
    id: "n-1",
    kind: "mention",
    title: "Sara Lin mentioned you",
    body: "@you can you take a look at the Wonka deal? Procurement wants closure by EOW.",
    timestamp: tMin(4),
    seen: false,
    accent: "#3b82f6",
  },
  {
    id: "n-2",
    kind: "activity",
    title: "Call: Acme Corp follow-up",
    body: "Scheduled for today at 3:00 PM. Reminder set.",
    timestamp: tMin(35),
    seen: false,
    accent: "#f59e0b",
  },
  {
    id: "n-3",
    kind: "discuss",
    title: "Commander Grant in #Mission-Briefings",
    body: "Briefing in 10 minutes. Secure video link in pinned message.",
    timestamp: tMin(58),
    seen: false,
    accent: "#8b5cf6",
  },
  {
    id: "n-4",
    kind: "system",
    title: "Build pipeline succeeded",
    body: "Deploy 1.18.4 ready for review. View artifact in Drone.",
    timestamp: tMin(140),
    seen: true,
    accent: "#10b981",
  },
  {
    id: "n-5",
    kind: "activity",
    title: "Lead assigned to you",
    body: "Globex Co — discovery call. SLA: 24h.",
    timestamp: tMin(220),
    seen: true,
    accent: "#f43f5e",
  },
];

let state: NotificationState = { items: seed };

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = () => state;

export const useNotifications = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

export const markAsSeen = (id: string) => {
  state = {
    items: state.items.map((n) => (n.id === id ? { ...n, seen: true } : n)),
  };
  emit();
};

export const markAsUnseen = (id: string) => {
  state = {
    items: state.items.map((n) => (n.id === id ? { ...n, seen: false } : n)),
  };
  emit();
};

export const markAllAsSeen = () => {
  state = { items: state.items.map((n) => ({ ...n, seen: true })) };
  emit();
};

export const dismiss = (id: string) => {
  state = { items: state.items.filter((n) => n.id !== id) };
  emit();
};

export const pushNotification = (n: Omit<Notification, "id" | "timestamp" | "seen">) => {
  const item: Notification = {
    ...n,
    id: `n-${Date.now()}`,
    timestamp: Date.now(),
    seen: false,
  };
  state = { items: [item, ...state.items] };
  emit();
};

export const unseenCount = () => state.items.filter((n) => !n.seen).length;
export const activitiesCount = () =>
  state.items.filter((n) => n.kind === "activity" && !n.seen).length;

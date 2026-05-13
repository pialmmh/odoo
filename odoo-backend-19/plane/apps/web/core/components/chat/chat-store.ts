/**
 * Mock chat store — module-level state with subscribe semantics so the
 * embedded LeadChatPanel and the floating ChatLauncher stay in sync.
 *
 * UI-only stand-in for Rocket.Chat. The shape (channels, messages, members,
 * teams, dms) mirrors Rocket.Chat's REST entities so swapping in a real
 * client later is a transport change, not a UI rewrite.
 */
import { useSyncExternalStore } from "react";

export type MemberStatus = "online" | "away" | "busy" | "offline";

export type ChatMember = {
  id: string;
  name: string;
  /** hex color so we can apply via inline style and bypass Tailwind's JIT */
  avatarColor: string;
  status?: MemberStatus;
};

export type ChatMessage = {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  body: string;
  ts: number;
  kind: "user" | "system";
};

export type ChatChannel = {
  id: string;
  name: string;
  topic?: string;
  /** when present, this channel is bound to a CRM lead */
  leadId?: string;
  /** when present, this channel belongs to a Rocket.Chat-style "team" */
  teamId?: string;
  /** when present, this channel is a 1:1 DM with the named user id */
  dmUserId?: string;
  memberIds: string[];
  isLive?: boolean;
  unread?: number;
};

export type ChatTeam = {
  id: string;
  name: string;
  iconColor: string;
  iconLetter: string;
  channelIds: string[];
};

export type QuickItem = {
  id: string;
  label: string;
  unread?: number;
};

export const QUICK_ITEMS: QuickItem[] = [
  { id: "mentions", label: "Mentions", unread: 3 },
  { id: "starred", label: "Starred", unread: 4 },
  { id: "discussions", label: "Discussions", unread: 8 },
  { id: "in_progress", label: "In progress", unread: 5 },
  { id: "queue", label: "Queue", unread: 26 },
  { id: "on_hold", label: "On hold" },
];

export type ChatState = {
  members: Record<string, ChatMember>;
  channels: Record<string, ChatChannel>;
  channelOrder: string[];
  teams: Record<string, ChatTeam>;
  teamOrder: string[];
  /** ids of users surfaced in the "Direct messages" section */
  dmUserIds: string[];
  messagesByChannel: Record<string, ChatMessage[]>;
  activeChannelId: string | null;
  /** id of the currently selected quick-access item, when any */
  activeQuickId: string | null;
  launcherOpen: boolean;
  meId: string;
};

const PALETTE = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#f43f5e", "#06b6d4", "#ef4444", "#14b8a6"];
const colorFor = (i: number) => PALETTE[i % PALETTE.length];

const seedMembers: ChatMember[] = [
  { id: "u-me", name: "You", avatarColor: colorFor(0), status: "online" },
  { id: "u-admin", name: "Administrator", avatarColor: colorFor(1), status: "online" },
  { id: "u-sara", name: "Sara Lin", avatarColor: colorFor(2), status: "online" },
  { id: "u-omar", name: "Omar Khan", avatarColor: colorFor(3), status: "away" },
  { id: "u-priya", name: "Priya N.", avatarColor: colorFor(4), status: "busy" },
  // DM-only mock characters
  { id: "u-grant", name: "Commander Grant", avatarColor: colorFor(5), status: "online" },
  { id: "u-ellis", name: "Major Ellis", avatarColor: colorFor(6), status: "online" },
  { id: "u-nguyen", name: "Lieutenant Nguyen", avatarColor: colorFor(7), status: "away" },
  { id: "u-morgan", name: "Deputy Morgan", avatarColor: colorFor(2), status: "offline" },
  { id: "u-chen", name: "Officer Chen", avatarColor: colorFor(3), status: "offline" },
];

const tMin = (mins: number) => Date.now() - mins * 60_000;

const seedChannels: ChatChannel[] = [
  // Workspace channels
  { id: "c-general", name: "general", topic: "Workspace announcements", memberIds: seedMembers.slice(0, 5).map((m) => m.id), unread: 2 },
  { id: "c-sales", name: "sales-team", topic: "CRM pipeline + handoffs", memberIds: ["u-me", "u-admin", "u-sara", "u-omar"], unread: 1 },
  { id: "c-eng", name: "engineering", topic: "Builds, deploys, on-call", memberIds: ["u-me", "u-admin", "u-omar", "u-priya"] },
  // Mission Control team
  { id: "c-intel-updates", name: "Intel-Updates", topic: "Field intel — live", teamId: "t-mission", memberIds: ["u-me", "u-grant", "u-ellis", "u-nguyen"], unread: 12 },
  { id: "c-mission-briefings", name: "Mission-Briefings", topic: "Daily briefings + standups", teamId: "t-mission", memberIds: ["u-me", "u-grant", "u-ellis"] },
  // Cyber Command team
  { id: "c-cyber-ops", name: "Cyber-Ops-Comms", topic: "Coordinated cyber operations", teamId: "t-cyber", memberIds: ["u-me", "u-priya", "u-chen"] },
  // Ops Center team
  { id: "c-impact-eval", name: "Impact-Evaluation", topic: "After-action / impact review", teamId: "t-ops", memberIds: ["u-me", "u-morgan", "u-ellis"] },
  { id: "c-incident-response", name: "Incident-Response", topic: "Live incident bridge", teamId: "t-ops", memberIds: ["u-me", "u-grant", "u-priya"] },
  { id: "c-geo-risk", name: "Geo-Risk-Analysis", topic: "Regional risk modeling", memberIds: ["u-me", "u-priya", "u-morgan"] },
];

const seedTeams: ChatTeam[] = [
  { id: "t-mission", name: "Mission Control", iconColor: "#3b82f6", iconLetter: "M", channelIds: ["c-mission-briefings", "c-intel-updates"] },
  { id: "t-cyber", name: "Cyber Command", iconColor: "#8b5cf6", iconLetter: "C", channelIds: ["c-cyber-ops"] },
  { id: "t-ops", name: "Ops Center", iconColor: "#10b981", iconLetter: "O", channelIds: ["c-impact-eval", "c-incident-response"] },
];

const seedDmUserIds = ["u-grant", "u-ellis", "u-nguyen", "u-morgan", "u-chen"];

const seedMessages: Record<string, ChatMessage[]> = {
  "c-general": [
    { id: "m-g1", channelId: "c-general", authorId: "u-admin", authorName: "Administrator", body: "Welcome to the workspace 👋 — pin anything important here.", ts: tMin(180), kind: "user" },
    { id: "m-g2", channelId: "c-general", authorId: "u-sara", authorName: "Sara Lin", body: "Q2 OKRs are live in Drive.", ts: tMin(45), kind: "user" },
  ],
  "c-sales": [
    { id: "m-s1", channelId: "c-sales", authorId: "u-omar", authorName: "Omar Khan", body: "Wonka's procurement said end-of-week. Anyone has the latest pricing sheet?", ts: tMin(120), kind: "user" },
    { id: "m-s2", channelId: "c-sales", authorId: "u-sara", authorName: "Sara Lin", body: "Sent in DM. Also reminder: weekly pipeline review at 4.", ts: tMin(20), kind: "user" },
  ],
  "c-eng": [
    { id: "m-e1", channelId: "c-eng", authorId: "u-priya", authorName: "Priya N.", body: "Deploy 1.18.3 ships tonight. Heads up if you're touching the gateway.", ts: tMin(300), kind: "user" },
  ],
  "c-mission-briefings": [
    { id: "m-mb1", channelId: "c-mission-briefings", authorId: "u-grant", authorName: "Commander Grant", body: "@all attention. Intel suggests a potential threat to Operation Silent Dusk. Secure video briefing in 10 minutes to discuss.", ts: tMin(28), kind: "user" },
    { id: "m-mb2", channelId: "c-mission-briefings", authorId: "u-ellis", authorName: "Major Ellis", body: "Uploading intel file to the secure server now.", ts: tMin(18), kind: "user" },
    { id: "m-mb3", channelId: "c-mission-briefings", authorId: "u-grant", authorName: "Commander Grant", body: "We must act quickly. @RocketChatAI, summarize recent discussions on Operation Silent Dusk for upcoming briefing.", ts: tMin(6), kind: "user" },
    { id: "m-mb4", channelId: "c-mission-briefings", authorId: "u-bot", authorName: "Rocket.Chat AI", body: "Summary: Enemy activity increased in sector 4; surveillance was enhanced, and rapid response teams were deployed.", ts: tMin(2), kind: "system" },
  ],
  "c-intel-updates": [
    { id: "m-iu1", channelId: "c-intel-updates", authorId: "u-nguyen", authorName: "Lieutenant Nguyen", body: "Drone feed quiet for the past hour. Will report on next sweep.", ts: tMin(50), kind: "user" },
  ],
  "c-cyber-ops": [
    { id: "m-co1", channelId: "c-cyber-ops", authorId: "u-priya", authorName: "Priya N.", body: "Honeypot logged 3 probes from the same /24 — escalating.", ts: tMin(33), kind: "user" },
  ],
  "c-impact-eval": [
    { id: "m-ie1", channelId: "c-impact-eval", authorId: "u-morgan", authorName: "Deputy Morgan", body: "After-action draft posted. Comments by EOD please.", ts: tMin(140), kind: "user" },
  ],
  "c-incident-response": [
    { id: "m-ir1", channelId: "c-incident-response", authorId: "u-grant", authorName: "Commander Grant", body: "Bridge open. Roll call.", ts: tMin(8), kind: "user" },
  ],
  "c-geo-risk": [
    { id: "m-gr1", channelId: "c-geo-risk", authorId: "u-priya", authorName: "Priya N.", body: "Updated the model with last week's events.", ts: tMin(220), kind: "user" },
  ],
};

// Build DM channels (1:1 with each DM user)
const dmChannels: ChatChannel[] = seedDmUserIds.map((uid) => ({
  id: `c-dm-${uid}`,
  name: seedMembers.find((m) => m.id === uid)?.name || uid,
  dmUserId: uid,
  memberIds: ["u-me", uid],
}));
const dmMessages: Record<string, ChatMessage[]> = Object.fromEntries(
  seedDmUserIds.map((uid) => {
    const m = seedMembers.find((x) => x.id === uid);
    return [
      `c-dm-${uid}`,
      [
        {
          id: `m-dm-${uid}-1`,
          channelId: `c-dm-${uid}`,
          authorId: uid,
          authorName: m?.name || uid,
          body: "Hey — got a sec?",
          ts: tMin(60 + Math.floor(Math.random() * 200)),
          kind: "user" as const,
        },
      ],
    ];
  })
);

// Add the bot member so the AI summary message has a color
seedMembers.push({ id: "u-bot", name: "Rocket.Chat AI", avatarColor: "#ef4444", status: "online" });

const allChannels = [...seedChannels, ...dmChannels];

let state: ChatState = {
  members: Object.fromEntries(seedMembers.map((m) => [m.id, m])),
  channels: Object.fromEntries(allChannels.map((c) => [c.id, c])),
  channelOrder: allChannels.map((c) => c.id),
  teams: Object.fromEntries(seedTeams.map((t) => [t.id, t])),
  teamOrder: seedTeams.map((t) => t.id),
  dmUserIds: seedDmUserIds,
  messagesByChannel: { ...seedMessages, ...dmMessages },
  activeChannelId: "c-mission-briefings",
  activeQuickId: null,
  launcherOpen: false,
  meId: "u-me",
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getState(): ChatState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChatState<T>(selector: (s: ChatState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state)
  );
}

// ──────────────────────────── actions

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function ensureLeadChannel(opts: {
  leadId: string;
  leadName: string;
  ownerName?: string;
}): ChatChannel {
  const id = `c-lead-${opts.leadId}`;
  const existing = state.channels[id];
  if (existing) return existing;

  const channel: ChatChannel = {
    id,
    name: `lead-${slugify(opts.leadName) || opts.leadId}`,
    topic: `Discussion for lead "${opts.leadName}"`,
    leadId: opts.leadId,
    memberIds: ["u-me", "u-admin", "u-sara"],
    isLive: true,
  };

  const msgs: ChatMessage[] = [
    { id: `m-${id}-sys`, channelId: id, authorId: "system", authorName: "System", body: `Channel created for lead "${opts.leadName}".`, ts: tMin(60), kind: "system" },
    { id: `m-${id}-1`, channelId: id, authorId: "u-sara", authorName: "Sara Lin", body: `Picking this one up — ${opts.ownerName || "owner"} feel free to chime in.`, ts: tMin(45), kind: "user" },
    { id: `m-${id}-2`, channelId: id, authorId: "u-admin", authorName: "Administrator", body: "Make sure pricing is locked before we send the proposal.", ts: tMin(15), kind: "user" },
  ];

  state = {
    ...state,
    channels: { ...state.channels, [id]: channel },
    channelOrder: [...state.channelOrder, id],
    messagesByChannel: { ...state.messagesByChannel, [id]: msgs },
  };
  emit();
  return channel;
}

export function postMessage(channelId: string, body: string): void {
  const trimmed = body.trim();
  if (!trimmed) return;
  const me = state.members[state.meId];
  const msg: ChatMessage = {
    id: `m-${channelId}-${Date.now()}`,
    channelId,
    authorId: state.meId,
    authorName: me?.name || "You",
    body: trimmed,
    ts: Date.now(),
    kind: "user",
  };
  const prev = state.messagesByChannel[channelId] || [];
  state = {
    ...state,
    messagesByChannel: { ...state.messagesByChannel, [channelId]: [...prev, msg] },
  };
  emit();
}

export function setActiveChannel(channelId: string): void {
  if (state.activeChannelId === channelId && state.activeQuickId === null) return;
  state = { ...state, activeChannelId: channelId, activeQuickId: null };
  emit();
}

export function setActiveQuick(quickId: string): void {
  if (state.activeQuickId === quickId) return;
  state = { ...state, activeQuickId: quickId, activeChannelId: null };
  emit();
}

export function setLauncherOpen(open: boolean): void {
  if (state.launcherOpen === open) return;
  state = { ...state, launcherOpen: open };
  emit();
}

export function openChannel(channelId: string): void {
  state = { ...state, launcherOpen: true, activeChannelId: channelId, activeQuickId: null };
  emit();
}

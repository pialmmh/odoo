/**
 * ChatSidebar — Rocket.Chat-style chat menu, mounted inside Plane's main left
 * sidebar (alongside Home / Drafts / Projects / CRM-Leads).
 *
 * Sections:
 *   [Quick access] Mentions / Starred / Discussions / In progress / Queue / On hold
 *   [Teams]        team rows (expandable into team-channels)
 *   [Channels]     #-prefixed workspace + per-lead channels
 *   [DMs]          1:1 with status dots
 *
 * Clicking any item opens the floating ChatLauncher pivoted to the chosen
 * channel (or quick-view stub). The launcher itself is conversation-only —
 * navigation lives here in the main sidebar.
 */
import { useState } from "react";
import { Disclosure, Transition } from "@headlessui/react";
import {
  AtSign,
  ChevronDown,
  ChevronRight,
  Hash,
  Inbox,
  ListTodo,
  MessageCircle,
  MessageSquare,
  PauseCircle,
  Star,
  Tag,
} from "lucide-react";
import { ChevronRightIcon } from "@plane/propel/icons";
import { cn } from "@plane/utils";
// store
import {
  openChannel,
  QUICK_ITEMS,
  setActiveQuick,
  setLauncherOpen,
  useChatState,
  type MemberStatus,
  type QuickItem,
} from "./chat-store";

const STATUS_COLOR: Record<MemberStatus, string> = {
  online: "#10b981",
  away: "#f59e0b",
  busy: "#ef4444",
  offline: "#a1a1aa",
};

const QUICK_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  mentions: AtSign,
  starred: Star,
  discussions: MessageSquare,
  in_progress: ListTodo,
  queue: Inbox,
  on_hold: PauseCircle,
};

function UnreadBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span
      className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-10 font-semibold text-white flex-shrink-0"
      style={{ backgroundColor: "#ef4444" }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SubSectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-1 px-2 pt-2 pb-1 text-10 uppercase tracking-wider text-tertiary hover:text-primary"
    >
      {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
      <span>{label}</span>
    </button>
  );
}

function QuickRow({ item }: { item: QuickItem }) {
  const isActive = useChatState((s) => s.activeQuickId === item.id && s.launcherOpen);
  const Icon = QUICK_ICON[item.id] || MessageCircle;
  return (
    <button
      type="button"
      onClick={() => {
        setActiveQuick(item.id);
        setLauncherOpen(true);
      }}
      className={cn(
        "w-full flex items-center gap-2 rounded-sm px-2 py-1 text-13",
        isActive ? "bg-layer-1 text-primary" : "text-secondary hover:bg-layer-transparent-hover"
      )}
    >
      <Icon className="size-3.5 text-accent-primary flex-shrink-0" />
      <span className="truncate flex-1 text-left">{item.label}</span>
      <UnreadBadge count={item.unread} />
    </button>
  );
}

function TeamRow({ teamId, expanded, onToggle }: { teamId: string; expanded: boolean; onToggle: () => void }) {
  const team = useChatState((s) => s.teams[teamId]);
  const channels = useChatState((s) => s.channels);
  const activeChannelId = useChatState((s) => s.activeChannelId);
  const launcherOpen = useChatState((s) => s.launcherOpen);
  if (!team) return null;
  const totalUnread = team.channelIds.reduce((sum, id) => sum + (channels[id]?.unread || 0), 0);
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 rounded-sm px-2 py-1 text-13 text-secondary hover:bg-layer-transparent-hover"
      >
        {expanded ? (
          <ChevronDown className="size-3 text-tertiary flex-shrink-0" />
        ) : (
          <ChevronRight className="size-3 text-tertiary flex-shrink-0" />
        )}
        <div
          className="size-5 rounded text-white text-10 font-semibold flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: team.iconColor }}
        >
          {team.iconLetter}
        </div>
        <span className="truncate flex-1 text-left text-primary">{team.name}</span>
        <UnreadBadge count={totalUnread} />
      </button>
      {expanded &&
        team.channelIds.map((cid) => {
          const c = channels[cid];
          if (!c) return null;
          const isActive = launcherOpen && cid === activeChannelId;
          return (
            <button
              key={cid}
              type="button"
              onClick={() => openChannel(cid)}
              className={cn(
                "w-full flex items-center gap-2 rounded-sm pl-7 pr-2 py-1 text-13",
                isActive ? "bg-layer-1 text-primary" : "text-secondary hover:bg-layer-transparent-hover"
              )}
            >
              <Hash className="size-3 text-tertiary flex-shrink-0" />
              <span className="truncate flex-1 text-left">{c.name}</span>
              <UnreadBadge count={c.unread} />
            </button>
          );
        })}
    </>
  );
}

function ChannelRow({ channelId }: { channelId: string }) {
  const c = useChatState((s) => s.channels[channelId]);
  const launcherOpen = useChatState((s) => s.launcherOpen);
  const isActive = useChatState((s) => s.activeChannelId === channelId && launcherOpen);
  if (!c) return null;
  const isLead = !!c.leadId;
  return (
    <button
      type="button"
      onClick={() => openChannel(channelId)}
      className={cn(
        "w-full flex items-center gap-2 rounded-sm px-2 py-1 text-13",
        isActive ? "bg-layer-1 text-primary" : "text-secondary hover:bg-layer-transparent-hover"
      )}
    >
      {isLead ? (
        <Tag className="size-3 text-amber-500 flex-shrink-0" />
      ) : (
        <Hash className="size-3 text-accent-primary flex-shrink-0" />
      )}
      <span
        className={cn(
          "truncate flex-1 text-left",
          isLead ? "text-amber-600" : isActive ? "text-primary" : "text-secondary"
        )}
      >
        {isLead ? `lead-${c.id.replace(/^c-lead-/, "")}` : c.name}
      </span>
      <UnreadBadge count={c.unread} />
    </button>
  );
}

function DmRow({ userId }: { userId: string }) {
  const member = useChatState((s) => s.members[userId]);
  const channelId = `c-dm-${userId}`;
  const launcherOpen = useChatState((s) => s.launcherOpen);
  const isActive = useChatState((s) => s.activeChannelId === channelId && launcherOpen);
  if (!member) return null;
  const status = member.status || "offline";
  return (
    <button
      type="button"
      onClick={() => openChannel(channelId)}
      className={cn(
        "w-full flex items-center gap-2 rounded-sm px-2 py-1 text-13",
        isActive ? "bg-layer-1 text-primary" : "text-secondary hover:bg-layer-transparent-hover"
      )}
    >
      <div className="relative flex-shrink-0">
        <div
          className="size-5 rounded-full text-white text-10 font-semibold flex items-center justify-center"
          style={{ backgroundColor: member.avatarColor }}
        >
          {member.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
        </div>
        <span
          className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-surface-2"
          style={{ backgroundColor: STATUS_COLOR[status] }}
        />
      </div>
      <span className="truncate flex-1 text-left">{member.name}</span>
    </button>
  );
}

export function ChatSidebar() {
  const channelOrder = useChatState((s) => s.channelOrder);
  const channels = useChatState((s) => s.channels);
  const teamOrder = useChatState((s) => s.teamOrder);
  const dmUserIds = useChatState((s) => s.dmUserIds);
  const channelIds = channelOrder.filter(
    (id) => channels[id] && !channels[id]!.teamId && !channels[id]!.dmUserId
  );

  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({
    teams: true,
    channels: true,
    dms: true,
  });
  const toggleSub = (k: string) => setOpenSubs((s) => ({ ...s, [k]: !s[k] }));
  const [openTeams, setOpenTeams] = useState<Record<string, boolean>>({
    "t-mission": true,
    "t-cyber": true,
    "t-ops": true,
  });

  return (
    <Disclosure as="div" className="flex flex-col" defaultOpen>
      {({ open }) => (
        <>
          <div className="group flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-placeholder hover:bg-layer-transparent-hover">
            <Disclosure.Button
              as="button"
              type="button"
              className="flex w-full items-center gap-1.5 text-left text-13 font-semibold whitespace-nowrap text-placeholder"
            >
              <MessageCircle className="size-3.5 text-accent-primary" />
              <span>Chat</span>
            </Disclosure.Button>
            <div className="pointer-events-none flex items-center opacity-0 group-hover:pointer-events-auto group-hover:opacity-100">
              <Disclosure.Button
                as="button"
                type="button"
                className="flex-shrink-0 rounded-sm p-0.5 hover:bg-layer-1"
                aria-label={open ? "Collapse chat menu" : "Expand chat menu"}
              >
                <ChevronRightIcon className={cn("size-3 flex-shrink-0 transition-all", { "rotate-90": open })} />
              </Disclosure.Button>
            </div>
          </div>
          <Transition
            show={open}
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            {open && (
              <Disclosure.Panel as="div" className="flex flex-col gap-0.5" static>
                {/* Quick access (no header — matches RC layout where these sit at top) */}
                {QUICK_ITEMS.map((q) => (
                  <QuickRow key={q.id} item={q} />
                ))}

                <SubSectionHeader label="Teams" open={openSubs.teams} onToggle={() => toggleSub("teams")} />
                {openSubs.teams &&
                  teamOrder.map((tid) => (
                    <TeamRow
                      key={tid}
                      teamId={tid}
                      expanded={!!openTeams[tid]}
                      onToggle={() => setOpenTeams((s) => ({ ...s, [tid]: !s[tid] }))}
                    />
                  ))}

                <SubSectionHeader
                  label="Channels"
                  open={openSubs.channels}
                  onToggle={() => toggleSub("channels")}
                />
                {openSubs.channels && channelIds.map((id) => <ChannelRow key={id} channelId={id} />)}

                <SubSectionHeader label="Direct messages" open={openSubs.dms} onToggle={() => toggleSub("dms")} />
                {openSubs.dms && dmUserIds.map((uid) => <DmRow key={uid} userId={uid} />)}
              </Disclosure.Panel>
            )}
          </Transition>
        </>
      )}
    </Disclosure>
  );
}

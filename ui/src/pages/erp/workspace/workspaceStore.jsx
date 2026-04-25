import { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';

const STORAGE_KEY = 'erp.workspace.v1';
const MAX_TABS = 12;

/**
 * Tab shape:
 *   { key: string, kind: string, title: string, params: object, pinned?: boolean }
 *
 * `kind` is matched against the registry in WindowRegistry.jsx to render content.
 * `key` is the unique identity (e.g. "product-list", "product:1010101").
 */

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tabs)) return null;
    return parsed;
  } catch { return null; }
}

function persist(state) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      tabs: state.tabs, activeKey: state.activeKey,
    }));
  } catch { /* ignore quota errors */ }
}

const initialState = (() => {
  const restored = load();
  if (restored) return restored;
  return { tabs: [], activeKey: null };
})();

function reducer(state, action) {
  switch (action.type) {
    case 'OPEN': {
      const { tab, focus = true } = action;
      const idx = state.tabs.findIndex((t) => t.key === tab.key);
      if (idx >= 0) {
        // Update title/params if changed; keep existing object identity otherwise.
        const existing = state.tabs[idx];
        const merged = { ...existing, ...tab };
        const tabs = state.tabs.slice();
        tabs[idx] = merged;
        return { tabs, activeKey: focus ? tab.key : state.activeKey };
      }
      let tabs = [...state.tabs, tab];
      if (tabs.length > MAX_TABS) {
        // Drop the oldest non-pinned, non-active tab.
        const dropIdx = tabs.findIndex((t) => !t.pinned && t.key !== state.activeKey);
        if (dropIdx >= 0) tabs = tabs.filter((_, i) => i !== dropIdx);
      }
      return { tabs, activeKey: focus ? tab.key : (state.activeKey ?? tab.key) };
    }
    case 'CLOSE': {
      const { key } = action;
      const idx = state.tabs.findIndex((t) => t.key === key);
      if (idx < 0) return state;
      const tabs = state.tabs.filter((t) => t.key !== key);
      let activeKey = state.activeKey;
      if (activeKey === key) {
        // Pick neighbor: prefer the tab to the left, else the new first tab.
        const next = tabs[idx - 1] || tabs[idx] || tabs[0];
        activeKey = next ? next.key : null;
      }
      return { tabs, activeKey };
    }
    case 'ACTIVATE': {
      const { key } = action;
      if (!state.tabs.some((t) => t.key === key)) return state;
      return { ...state, activeKey: key };
    }
    case 'CLOSE_OTHERS': {
      const { key } = action;
      const keep = state.tabs.filter((t) => t.key === key || t.pinned);
      return { tabs: keep, activeKey: key };
    }
    case 'CLOSE_ALL': {
      const keep = state.tabs.filter((t) => t.pinned);
      return { tabs: keep, activeKey: keep[0]?.key ?? null };
    }
    case 'REORDER': {
      const { from, to } = action;
      if (from === to) return state;
      const tabs = state.tabs.slice();
      const [moved] = tabs.splice(from, 1);
      tabs.splice(to, 0, moved);
      return { ...state, tabs };
    }
    default:
      return state;
  }
}

const WorkspaceCtx = createContext(null);

export function WorkspaceProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => { persist(state); }, [state]);

  const openTab = useCallback((tab, opts) => dispatch({ type: 'OPEN', tab, ...opts }), []);
  const closeTab = useCallback((key) => dispatch({ type: 'CLOSE', key }), []);
  const activateTab = useCallback((key) => dispatch({ type: 'ACTIVATE', key }), []);
  const closeOthers = useCallback((key) => dispatch({ type: 'CLOSE_OTHERS', key }), []);
  const closeAll = useCallback(() => dispatch({ type: 'CLOSE_ALL' }), []);
  const reorderTab = useCallback((from, to) => dispatch({ type: 'REORDER', from, to }), []);

  const value = useMemo(() => ({
    tabs: state.tabs,
    activeKey: state.activeKey,
    activeTab: state.tabs.find((t) => t.key === state.activeKey) || null,
    openTab, closeTab, activateTab, closeOthers, closeAll, reorderTab,
  }), [state, openTab, closeTab, activateTab, closeOthers, closeAll, reorderTab]);

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return ctx;
}

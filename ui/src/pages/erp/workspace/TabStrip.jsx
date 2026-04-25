import { useRef, useEffect } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useWorkspace } from './workspaceStore';
import { WINDOWS } from './WindowRegistry';

/**
 * Chrome-style horizontally scrollable tab strip.
 *
 * - Wheel scrolls horizontally.
 * - Active tab autoscrolls into view.
 * - Each tab: icon, ellipsized title, close button on hover.
 */
export default function TabStrip({ onActivate, onClose }) {
  const { tabs, activeKey } = useWorkspace();
  const scrollRef = useRef(null);
  const activeRef = useRef(null);

  // Wheel → horizontal scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (e.deltaY === 0) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Scroll active tab into view.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [activeKey]);

  if (tabs.length === 0) {
    return (
      <Box sx={{
        flex: 1, display: 'flex', alignItems: 'center',
        color: 'text.disabled', fontSize: 'var(--font-size-sm)', pl: 'var(--space-3)',
      }}>
        No windows open
      </Box>
    );
  }

  return (
    <Box
      ref={scrollRef}
      sx={{
        flex: 1, minWidth: 0,
        display: 'flex', alignItems: 'flex-end',
        overflowX: 'auto', overflowY: 'hidden',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        gap: '2px',
        pt: 'var(--space-1)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        const Icon = WINDOWS[tab.kind]?.icon;
        return (
          <Box
            key={tab.key}
            ref={isActive ? activeRef : null}
            onClick={() => !isActive && onActivate?.(tab.key)}
            onMouseDown={(e) => {
              // Middle-click closes (Chrome convention).
              if (e.button === 1) { e.preventDefault(); onClose?.(tab.key); }
            }}
            sx={{
              flex: '0 0 auto',
              maxWidth: 220, minWidth: 120,
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              pl: 'var(--space-3)', pr: 'var(--space-2)',
              py: 'var(--space-1)',
              cursor: isActive ? 'default' : 'pointer',
              borderTopLeftRadius: 'var(--radius-md)',
              borderTopRightRadius: 'var(--radius-md)',
              borderBottom: 'none',
              border: '1px solid',
              borderColor: isActive ? 'var(--color-border)' : 'transparent',
              borderBottomColor: isActive ? 'transparent' : 'var(--color-border)',
              bgcolor: isActive ? 'background.paper' : 'transparent',
              color: isActive ? 'text.primary' : 'text.secondary',
              fontSize: 'var(--font-size-sm)',
              fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
              position: 'relative',
              transition: 'background-color var(--transition-fast), color var(--transition-fast)',
              '&:hover': {
                bgcolor: isActive ? 'background.paper' : 'var(--color-bg-muted)',
                color: 'text.primary',
                '& .tab-close': { opacity: 1 },
              },
            }}
          >
            {Icon && <Icon sx={{ fontSize: 16, color: isActive ? 'var(--color-primary)' : 'inherit' }} />}
            <Box
              sx={{
                flex: 1,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
              title={tab.dirty ? `${tab.title} — unsaved changes` : tab.title}
            >
              {tab.dirty && (
                <Box component="span" sx={{ color: 'var(--color-warning, var(--color-primary))', mr: 0.5 }}>
                  *
                </Box>
              )}
              {tab.title}
            </Box>
            {!tab.pinned && (
              <Tooltip title={tab.dirty ? 'Close (unsaved changes)' : 'Close'} disableInteractive>
                <IconButton
                  className="tab-close"
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onClose?.(tab.key); }}
                  sx={{
                    p: '2px',
                    // Dirty tabs always show the close button so the * isn't hidden behind hover.
                    opacity: tab.dirty ? 1 : (isActive ? 0.7 : 0),
                    '&:hover': { opacity: 1, bgcolor: 'var(--color-bg-subtle)' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

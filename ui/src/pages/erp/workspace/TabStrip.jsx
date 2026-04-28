import { useRef, useEffect } from 'react';
import {
  makeStyles, mergeClasses, tokens, Tooltip, Button,
} from '@fluentui/react-components';
import { Dismiss12Regular } from '@fluentui/react-icons';
import { useWorkspace } from './workspaceStore';
import { WINDOWS } from './WindowRegistry';

/**
 * Chrome-style horizontally scrollable tab strip.
 *
 * - Wheel scrolls horizontally.
 * - Active tab autoscrolls into view.
 * - Each tab: icon, ellipsized title, close button on hover.
 */

const useStyles = makeStyles({
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    color: tokens.colorNeutralForegroundDisabled,
    fontSize: tokens.fontSizeBase200,
    paddingLeft: tokens.spacingHorizontalM,
  },
  strip: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'flex-end',
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollbarWidth: 'none',
    gap: '2px',
    paddingTop: tokens.spacingVerticalXS,
    '&::-webkit-scrollbar': { display: 'none' },
  },
  tab: {
    flex: '0 0 auto',
    maxWidth: '220px',
    minWidth: '120px',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    cursor: 'pointer',
    borderTopLeftRadius: tokens.borderRadiusMedium,
    borderTopRightRadius: tokens.borderRadiusMedium,
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderLeftColor: 'transparent',
    borderBottomColor: tokens.colorNeutralStroke2,
    backgroundColor: 'transparent',
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightRegular,
    position: 'relative',
    transitionProperty: 'background-color, color',
    transitionDuration: tokens.durationFaster,
    transitionTimingFunction: tokens.curveEasyEase,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground2,
      color: tokens.colorNeutralForeground1,
    },
    '&:hover .tab-close': { opacity: 1 },
  },
  tabActive: {
    cursor: 'default',
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightColor: tokens.colorNeutralStroke2,
    borderLeftColor: tokens.colorNeutralStroke2,
    borderBottomColor: 'transparent',
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1,
      color: tokens.colorNeutralForeground1,
    },
  },
  icon: {
    flexShrink: 0,
    color: tokens.colorNeutralForeground3,
    width: '16px',
    height: '16px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: {
    color: tokens.colorBrandForeground1,
  },
  title: {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  dirty: {
    color: tokens.colorPaletteYellowForeground1,
    marginRight: '2px',
  },
  closeBtn: {
    minWidth: 'unset',
    width: '20px',
    height: '20px',
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    opacity: 0,
    transitionProperty: 'opacity',
    transitionDuration: tokens.durationFaster,
    transitionTimingFunction: tokens.curveEasyEase,
    '&:hover': { opacity: 1 },
  },
  closeBtnDirty: { opacity: 1 },
  closeBtnActive: { opacity: 0.7 },
});

export default function TabStrip({ onActivate, onClose }) {
  const styles = useStyles();
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
    return <div className={styles.empty}>No windows open</div>;
  }

  return (
    <div ref={scrollRef} className={styles.strip}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        const Icon = WINDOWS[tab.kind]?.icon;
        return (
          <div
            key={tab.key}
            ref={isActive ? activeRef : null}
            className={mergeClasses(styles.tab, isActive && styles.tabActive)}
            onClick={() => !isActive && onActivate?.(tab.key)}
            onMouseDown={(e) => {
              if (e.button === 1) { e.preventDefault(); onClose?.(tab.key); }
            }}
          >
            {Icon && (
              <span className={mergeClasses(styles.icon, isActive && styles.iconActive)}>
                <Icon />
              </span>
            )}
            <span className={styles.title} title={tab.dirty ? `${tab.title} — unsaved changes` : tab.title}>
              {tab.dirty && <span className={styles.dirty}>*</span>}
              {tab.title}
            </span>
            {!tab.pinned && (
              <Tooltip content={tab.dirty ? 'Close (unsaved changes)' : 'Close'} relationship="label" withArrow={false}>
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<Dismiss12Regular />}
                  className={mergeClasses(
                    styles.closeBtn,
                    'tab-close',
                    tab.dirty && styles.closeBtnDirty,
                    isActive && !tab.dirty && styles.closeBtnActive,
                  )}
                  onClick={(e) => { e.stopPropagation(); onClose?.(tab.key); }}
                />
              </Tooltip>
            )}
          </div>
        );
      })}
    </div>
  );
}

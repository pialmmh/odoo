import { useState, useMemo, useEffect, useRef } from 'react';
import {
  makeStyles, mergeClasses, tokens, Combobox, Option, OptionGroup, Text,
} from '@fluentui/react-components';
import { Search20Regular } from '@fluentui/react-icons';
import { APP_MENU } from './WindowRegistry';

/**
 * App-wide search — populated from APP_MENU. Mirrors iDempiere's GlobalSearch
 * dropdown: alphabetical within each category, "Coming soon" entries dimmed
 * but still selectable (they open a stub tab).
 *
 * Alt+G focuses the input (iDempiere convention).
 */

const useStyles = makeStyles({
  combobox: {
    width: '280px',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  optionDim: { opacity: 0.65 },
  optionTitle: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightMedium,
  },
  optionSoon: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForegroundDisabled,
    fontStyle: 'italic',
    marginLeft: tokens.spacingHorizontalXS,
  },
  optionIcon: {
    flexShrink: 0,
    color: tokens.colorNeutralForeground3,
    width: '16px',
    height: '16px',
  },
});

export default function AppSearch({ onSelect }) {
  const styles = useStyles();
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Sort: ready-first within each category, then alphabetical.
  const sorted = useMemo(() => {
    const order = (e) => `${e.category || ''}|${e.status === 'ready' ? '0' : '1'}|${e.title}`;
    return APP_MENU.slice().sort((a, b) => order(a).localeCompare(order(b)));
  }, []);

  // Filter then group by category.
  const groups = useMemo(() => {
    const q = text.trim().toLowerCase();
    const filtered = q
      ? sorted.filter(
          (o) =>
            o.title.toLowerCase().includes(q) ||
            (o.category || '').toLowerCase().includes(q),
        )
      : sorted;
    const map = new Map();
    for (const o of filtered) {
      const cat = o.category || '';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(o);
    }
    return Array.from(map.entries());
  }, [sorted, text]);

  return (
    <Combobox
      ref={inputRef}
      className={styles.combobox}
      placeholder="Search apps  ·  Alt+G"
      value={text}
      freeform
      clearable
      onInput={(e) => setText(e.target.value)}
      onOptionSelect={(_e, data) => {
        const entry = APP_MENU.find((m) => m.key === data.optionValue);
        if (entry) {
          onSelect?.(entry);
          setText('');
        }
      }}
      expandIcon={<Search20Regular />}
    >
      {groups.map(([category, items]) => {
        const inner = items.map((option) => {
          const Icon = option.icon;
          const dim = option.status === 'soon';
          return (
            <Option
              key={option.key}
              value={option.key}
              text={option.title}
              className={mergeClasses(styles.option, dim && styles.optionDim)}
            >
              {Icon && <span className={styles.optionIcon}><Icon /></span>}
              <span className={styles.optionTitle}>{option.title}</span>
              {dim && <span className={styles.optionSoon}>soon</span>}
            </Option>
          );
        });
        if (!category) return inner;
        return (
          <OptionGroup key={category} label={category}>
            {inner}
          </OptionGroup>
        );
      })}
    </Combobox>
  );
}

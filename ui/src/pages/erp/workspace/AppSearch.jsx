import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Autocomplete, TextField, InputAdornment, Box, ListItem, ListItemIcon, ListItemText,
  Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { APP_MENU } from './WindowRegistry';

/**
 * App-wide search — populated from APP_MENU. Mirrors iDempiere's GlobalSearch
 * dropdown: alphabetical within each category, "Coming soon" entries dimmed
 * but still selectable (they open a stub tab).
 *
 * Alt+G focuses the input (iDempiere convention).
 * Document search (the "/" prefix in iDempiere) is a v2 follow-up.
 */
export default function AppSearch({ onSelect }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Sort: ready-first within each category, then alphabetical (matches iDempiere
  // alphabetical sort but keeps implemented apps on top so users find them fast).
  const options = useMemo(() => {
    const order = (e) => `${e.category || ''}|${e.status === 'ready' ? '0' : '1'}|${e.title}`;
    return APP_MENU.slice().sort((a, b) => order(a).localeCompare(order(b)));
  }, []);

  return (
    <Autocomplete
      size="small"
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={options}
      groupBy={(o) => o.category || ''}
      getOptionLabel={(o) => o.title || ''}
      isOptionEqualToValue={(a, b) => a.key === b.key}
      value={null}
      blurOnSelect
      clearOnBlur
      onChange={(_, value) => {
        if (value) onSelect?.(value);
      }}
      filterOptions={(opts, state) => {
        const q = state.inputValue.trim().toLowerCase();
        if (!q) return opts;
        return opts.filter(
          (o) =>
            o.title.toLowerCase().includes(q) ||
            (o.category || '').toLowerCase().includes(q)
        );
      }}
      slotProps={{
        listbox: { sx: { maxHeight: '60vh', py: 0 } },
        paper:   { sx: { boxShadow: 'var(--shadow-dropdown)' } },
      }}
      renderGroup={(params) => (
        <li key={params.key}>
          {params.group && (
            <Box sx={{
              position: 'sticky', top: 0, zIndex: 1,
              px: 'var(--space-3)', py: 'var(--space-1)',
              bgcolor: 'var(--color-bg-subtle)',
              borderBottom: '1px solid var(--color-border-subtle)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {params.group}
            </Box>
          )}
          <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>{params.children}</Box>
        </li>
      )}
      renderOption={(props, option) => {
        const Icon = option.icon;
        const dim = option.status === 'soon';
        return (
          <ListItem {...props} key={option.key} dense sx={{ opacity: dim ? 0.65 : 1 }}>
            {Icon && (
              <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
                <Icon sx={{ fontSize: 18 }} />
              </ListItemIcon>
            )}
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Box component="span" sx={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                  }}>
                    {option.title}
                  </Box>
                  {dim && (
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                      soon
                    </Typography>
                  )}
                </Box>
              }
            />
          </ListItem>
        );
      }}
      sx={{ width: 280 }}
      renderInput={(params) => (
        <TextField
          {...params}
          inputRef={inputRef}
          placeholder="Search apps  ·  Alt+G"
          variant="outlined"
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
                {params.InputProps.startAdornment}
              </>
            ),
            sx: {
              fontSize: 'var(--font-size-sm)',
              bgcolor: 'background.paper',
            },
          }}
        />
      )}
    />
  );
}

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Autocomplete, TextField, InputAdornment, Box, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { APP_MENU, WINDOWS } from './WindowRegistry';

/**
 * App-wide search — v1 is a static menu picker.
 * Selecting an entry calls onSelect({ kind, key, title }).
 *
 * Hook for Alt+G to focus the input. Backend record search comes later.
 */
export default function AppSearch({ onSelect }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      // Alt+G to focus the search box (matches iDempiere).
      if (e.altKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const options = useMemo(() => APP_MENU, []);

  return (
    <Autocomplete
      size="small"
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={options}
      getOptionLabel={(o) => o.title || ''}
      isOptionEqualToValue={(a, b) => a.key === b.key}
      value={null}
      blurOnSelect
      clearOnBlur
      onChange={(_, value) => {
        if (value) onSelect?.(value);
      }}
      renderOption={(props, option) => {
        const Icon = option.icon;
        return (
          <ListItem {...props} key={option.key} dense>
            {Icon && (
              <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
                <Icon sx={{ fontSize: 18 }} />
              </ListItemIcon>
            )}
            <ListItemText
              primary={option.title}
              primaryTypographyProps={{
                sx: { fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' },
              }}
            />
          </ListItem>
        );
      }}
      sx={{ width: 260 }}
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

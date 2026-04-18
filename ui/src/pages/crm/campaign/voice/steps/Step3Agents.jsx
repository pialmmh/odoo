import {
  Box, Typography, Alert, Grid, TextField, InputAdornment,
  Checkbox, FormControlLabel, Avatar, Stack, Chip, Divider,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useState, useMemo } from 'react';

// Step 3 — Agent assignment. Agent list endpoint is not yet wired (no RBAC
// endpoint returning a team roster in a shape the campaign can consume),
// so for now we show a placeholder roster derived from localStorage
// so the wizard flow is testable end-to-end. See ui-vs-api-todo.md §10.

const MOCK_AGENTS = [
  { id: 1, name: 'Sarah Johnson', email: 'sarah@example.com', status: 'Available' },
  { id: 2, name: 'Michael Chen',  email: 'michael@example.com', status: 'On call' },
  { id: 3, name: 'Priya Patel',   email: 'priya@example.com', status: 'Available' },
  { id: 4, name: 'David Kim',     email: 'david@example.com', status: 'Away' },
  { id: 5, name: 'Lisa Garcia',   email: 'lisa@example.com', status: 'Available' },
  { id: 6, name: 'Omar Ahmed',    email: 'omar@example.com', status: 'Available' },
];

const initials = (name) => name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

export default function Step3Agents({ form, update }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(
    () => MOCK_AGENTS.filter(a => !q.trim() ||
      a.name.toLowerCase().includes(q.toLowerCase()) ||
      a.email.toLowerCase().includes(q.toLowerCase())),
    [q]
  );

  const toggle = (id) => {
    const set = new Set(form.agentIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    update({ agentIds: [...set] });
  };

  const selectedAgents = MOCK_AGENTS.filter(a => form.agentIds.includes(a.id));
  const agentless = form.dialingMode === 'AGENTLESS';

  return (
    <Box>
      {agentless && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Agentless mode selected — no agents needed. The system will play audio and hang up.
        </Alert>
      )}

      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        Assign agents
      </Typography>

      {selectedAgents.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
          {selectedAgents.map(a => (
            <Chip key={a.id} label={a.name} size="small"
              onDelete={() => toggle(a.id)}
              avatar={<Avatar>{initials(a.name)}</Avatar>}
            />
          ))}
        </Stack>
      )}

      <TextField
        size="small" fullWidth placeholder="Search agents by name or email…"
        value={q} onChange={e => setQ(e.target.value)}
        disabled={agentless}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
        }}
        sx={{ mb: 2 }}
      />

      <Divider sx={{ mb: 1 }} />
      <Grid container spacing={1}>
        {filtered.map(a => {
          const checked = form.agentIds.includes(a.id);
          return (
            <Grid item xs={12} md={6} key={a.id}>
              <FormControlLabel
                disabled={agentless}
                sx={{
                  width: '100%', m: 0, px: 1.5, py: 0.75, borderRadius: 1,
                  border: 1, borderColor: checked ? 'primary.main' : 'divider',
                  bgcolor: checked ? 'action.hover' : 'transparent',
                }}
                control={<Checkbox size="small" checked={checked} onChange={() => toggle(a.id)} />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                    <Avatar sx={{ width: 32, height: 32, fontSize: 12 }}>{initials(a.name)}</Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{a.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{a.email}</Typography>
                    </Box>
                    <Chip size="small" label={a.status}
                      sx={{ fontSize: 10, height: 18,
                        bgcolor: a.status === 'Available' ? 'success.light'
                               : a.status === 'On call'   ? 'warning.light' : 'grey.200',
                      }} />
                  </Box>
                }
              />
            </Grid>
          );
        })}
      </Grid>

      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 2 }}>
        Note: agent roster is a placeholder. Real data comes from the admin / team endpoint once wired.
      </Typography>
    </Box>
  );
}

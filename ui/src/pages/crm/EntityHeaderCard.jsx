import { Link as RouterLink } from 'react-router-dom';
import { Paper, Box, Typography, Avatar, Link as MuiLink } from '@mui/material';
import { ChevronRight as ChevronIcon } from '@mui/icons-material';

/**
 * EspoCRM-style header card for any CRM entity detail page.
 *
 *   ┌────────────────────────────────────────────────┐
 *   │  [●]  Leads ›                         [actions]│
 *   │       Entity Name                              │
 *   │       subtitle (optional)                      │
 *   └────────────────────────────────────────────────┘
 *
 * Accepts any MUI icon element. Left-side avatar uses primary palette.
 */
export default function EntityHeaderCard({
  icon, entityLabel, backTo = '..', title, subtitle, actions,
}) {
  return (
    <Paper variant="outlined" sx={{
      p: 2, mb: 1.5, borderRadius: 1.5,
      display: 'flex', alignItems: 'center', gap: 2,
    }}>
      <Avatar sx={{
        bgcolor: 'primary.light', color: 'primary.dark',
        width: 48, height: 48, borderRadius: 1.5,
      }}>
        {icon}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {entityLabel && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
            <MuiLink component={RouterLink} to={backTo} underline="hover"
              sx={{ fontSize: 12, fontWeight: 600, color: 'primary.main' }}>
              {entityLabel}
            </MuiLink>
            <ChevronIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          </Box>
        )}
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
          {title || '(unnamed)'}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.25 }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      {actions && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{actions}</Box>}
    </Paper>
  );
}

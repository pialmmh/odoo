import { useNavigate, useParams } from 'react-router-dom';
import { Breadcrumbs, Link as MuiLink, Typography, Box } from '@mui/material';

// Shared admin page header with breadcrumbs back to /crm/admin.
export function AdminPageHeader({ sectionLabel, title, subtitle, actions }) {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const base = tenant ? `/${tenant}` : '';
  return (
    <Box sx={{ mb: 2.5 }}>
      <Breadcrumbs sx={{ mb: 1 }}>
        <MuiLink
          component="button"
          onClick={() => navigate(`${base}/crm/admin`)}
          underline="hover"
          sx={{ color: 'text.secondary', fontSize: 13 }}
        >
          Administration
        </MuiLink>
        {sectionLabel && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {sectionLabel}
          </Typography>
        )}
        <Typography variant="body2" sx={{ color: 'text.primary' }}>{title}</Typography>
      </Breadcrumbs>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && <Box sx={{ display: 'flex', gap: 1 }}>{actions}</Box>}
      </Box>
    </Box>
  );
}

export function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toLocaleString(); } catch { return v; }
}

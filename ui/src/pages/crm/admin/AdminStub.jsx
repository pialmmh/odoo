import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Breadcrumbs, Link as MuiLink, Paper, Button, Stack } from '@mui/material';
import { OpenInNew as OpenInNewIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import { findAdminItem, espoDeepLink } from './adminPanelSpec';

export default function AdminStub() {
  const { key, tenant } = useParams();
  const navigate = useNavigate();
  const base = tenant ? `/${tenant}` : '';
  const match = findAdminItem(key);

  if (!match) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Unknown admin section: <b>{key}</b></Typography>
        <Button startIcon={<BackIcon />} onClick={() => navigate(`${base}/crm/admin`)} sx={{ mt: 2 }}>
          Back to Administration
        </Button>
      </Box>
    );
  }

  const { section, item } = match;
  const url = espoDeepLink(item);

  return (
    <Box sx={{ px: 3, py: 2.5, maxWidth: 900 }}>
      <Breadcrumbs sx={{ mb: 1.5 }}>
        <MuiLink
          component="button"
          onClick={() => navigate(`${base}/crm/admin`)}
          underline="hover"
          sx={{ color: 'text.secondary', fontSize: 13 }}
        >
          Administration
        </MuiLink>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {section.label}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.primary' }}>
          {item.label}
        </Typography>
      </Breadcrumbs>

      <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
        {item.label}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
        {item.desc}
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 1.5, bgcolor: 'background.default' }}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          A native React implementation for <b>{item.label}</b> is not available yet.
          You can manage this in the original EspoCRM admin panel.
        </Typography>
        <Stack direction="row" spacing={1}>
          {url && (
            <Button
              variant="contained"
              startIcon={<OpenInNewIcon />}
              component="a"
              href={url}
              target="_blank"
              rel="noopener"
            >
              Open in EspoCRM
            </Button>
          )}
          <Button variant="outlined" startIcon={<BackIcon />} onClick={() => navigate(`${base}/crm/admin`)}>
            Back
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

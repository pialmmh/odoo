import { Box, Paper, Typography } from '@mui/material';

/**
 * Placeholder for Campaign / Dialer pages.
 *
 * Build brief for another agent: /tmp/shared-instruction/campaign-dialer-frontend-instruction.md
 *
 * Replace this file with a CampaignIndex.jsx that routes to:
 *   /campaign/campaigns        → list + detail + edit
 *   /campaign/dialer           → agent dial workspace
 *   /campaign/dnc              → DNC list management
 *   /campaign/dispositions     → disposition config
 *   /campaign/record-lists     → record list management
 *   /campaign/reports          → campaign reports
 */
export default function CampaignPlaceholder() {
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>Campaign & Dialer</Typography>
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary">
          Not yet built. See <code>/tmp/shared-instruction/campaign-dialer-frontend-instruction.md</code>.
        </Typography>
      </Paper>
    </Box>
  );
}

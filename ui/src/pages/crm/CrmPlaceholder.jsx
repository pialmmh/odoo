import { Box, Paper, Typography } from '@mui/material';

/**
 * Placeholder — owned by the CRM frontend agent.
 * Real pages live under ui/src/pages/crm/ and call ui/src/services/crm.js.
 */
export default function CrmPlaceholder() {
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>CRM</Typography>
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary">
          CRM pages are not yet built. When enabled, leads, contacts, accounts,
          and pipeline views will appear here.
        </Typography>
      </Paper>
    </Box>
  );
}

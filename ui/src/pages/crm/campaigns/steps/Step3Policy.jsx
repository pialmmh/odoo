import { Box, Grid, TextField, MenuItem, Typography, Divider } from '@mui/material';
import PolicyPreview from './PolicyPreview';
import SchedulePolicyPreview from './SchedulePolicyPreview';

// Step 3 — Policy + Schedule. Shared across all campaign types.

export default function Step3Policy({ form, update, policies, schedulePolicies }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
        Retry / disposition policy
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField fullWidth size="small" select label="Policy"
            value={form.policyId}
            onChange={e => update({ policyId: e.target.value })}>
            <MenuItem value=""><em>—</em></MenuItem>
            {policies.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name || `#${p.id}`}</MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>
      <PolicyPreview policyId={form.policyId} />

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
        Schedule policy
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField fullWidth size="small" select label="Schedule"
            value={form.schedulePolicyId}
            onChange={e => update({ schedulePolicyId: e.target.value })}>
            <MenuItem value=""><em>—</em></MenuItem>
            {schedulePolicies.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name || `#${p.id}`}</MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>
      <SchedulePolicyPreview schedulePolicyId={form.schedulePolicyId} />
    </Box>
  );
}

import {
  Box, Grid, TextField, Typography, Divider, Alert, MenuItem,
} from '@mui/material';

// Email channel — no backend support yet (SMSREST has no email sending code).
// UI collects fields anyway so the data is ready when backend catches up.

export default function ChannelEmail({ form, update }) {
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Email sending is not yet implemented server-side. These fields are saved
        with the campaign and will become active once SMTP / template support lands.
      </Alert>

      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        Sender identity
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <TextField fullWidth size="small" required label="From address"
            type="email" placeholder="campaigns@yourdomain.com"
            value={form.fromAddress}
            onChange={e => update({ fromAddress: e.target.value })} />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField fullWidth size="small" label="From name"
            placeholder="Your Brand"
            value={form.fromName}
            onChange={e => update({ fromName: e.target.value })} />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField fullWidth size="small" label="Reply-to"
            type="email"
            value={form.replyTo}
            onChange={e => update({ replyTo: e.target.value })} />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        Content
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <TextField fullWidth size="small" required label="Subject"
            value={form.subject}
            onChange={e => update({ subject: e.target.value })} />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField fullWidth size="small" select label="Template (optional)"
            value={form.emailTemplateId}
            onChange={e => update({ emailTemplateId: e.target.value })}
            helperText="Overrides body if picked">
            <MenuItem value=""><em>— use body below —</em></MenuItem>
            {/* Templates endpoint pending — see gap tracker §17 */}
          </TextField>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth multiline rows={8}
            label="Body (HTML or plain text)"
            value={form.emailBody}
            onChange={e => update({ emailBody: e.target.value })}
            placeholder="Dear {{name}},&#10;&#10;..."
            helperText={`${form.emailBody.length} chars · {{placeholders}} are substituted per recipient when the merge service is wired.`}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

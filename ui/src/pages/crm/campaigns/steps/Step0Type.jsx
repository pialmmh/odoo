import {
  Box, Typography, Card, CardActionArea, CardContent, Grid, Chip,
} from '@mui/material';
import {
  Sms as SmsIcon, Phone as VoiceIcon, Email as EmailIcon,
  Hub as HybridIcon, SupportAgent as AgentIcon,
} from '@mui/icons-material';

// Step 0 — pick a campaign type. Each card is a major branch of the wizard.

const TYPES = [
  {
    key: 'SMS',
    title: 'SMS (Bulk)',
    icon: <SmsIcon />,
    color: '#1e40af', bg: '#dbeafe',
    desc: 'Send a text message to a list of phone numbers.',
    bullets: ['Unicode / Flash / Long SMS', 'Sender ID from assigned pool', 'Forbidden-word filtering'],
  },
  {
    key: 'VOICE_AGENTLESS',
    title: 'Voice · Agentless',
    icon: <VoiceIcon />,
    color: '#065f46', bg: '#dcfce7',
    desc: 'Play a pre-recorded audio file to each number, no agents required.',
    bullets: ['Audio library picker', 'AMD (answering-machine detection)', 'Gateway selection'],
  },
  {
    key: 'VOICE_AGENT',
    title: 'Voice · Agent-Assisted',
    icon: <AgentIcon />,
    color: '#5b21b6', bg: '#ede9fe',
    desc: 'Dial contacts and connect them to an available agent.',
    bullets: ['Preview / Progressive / Predictive', 'Agent roster assignment', 'Wrap-up & retry rules'],
  },
  {
    key: 'EMAIL',
    title: 'Email',
    icon: <EmailIcon />,
    color: '#9a3412', bg: '#ffedd5',
    desc: 'Send a transactional or marketing email to a list of addresses.',
    bullets: ['From / Reply-to identity', 'HTML body or saved template', 'Subject + plain-text fallback'],
  },
  {
    key: 'HYBRID',
    title: 'Hybrid',
    icon: <HybridIcon />,
    color: '#831843', bg: '#fce7f3',
    desc: 'Waterfall across channels — try the preferred one first, fall back on failure.',
    bullets: ['Ordered channel priority', 'Fallback on: no-route · failure · timeout', 'One contact list, many channels'],
  },
];

export default function Step0Type({ form, update }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        What kind of campaign are you creating?
      </Typography>

      <Grid container spacing={2}>
        {TYPES.map(t => {
          const selected = form.campaignType === t.key;
          return (
            <Grid item xs={12} sm={6} md={4} key={t.key}>
              <Card
                variant="outlined"
                sx={{
                  borderColor: selected ? 'primary.main' : 'divider',
                  borderWidth: selected ? 2 : 1,
                  bgcolor: selected ? 'action.hover' : 'background.paper',
                  height: '100%',
                }}
              >
                <CardActionArea
                  onClick={() => update({ campaignType: t.key })}
                  sx={{ height: '100%', p: 2 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Box sx={{
                      width: 40, height: 40, borderRadius: 1,
                      bgcolor: t.bg, color: t.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {t.icon}
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {t.title}
                    </Typography>
                    {selected && <Chip size="small" label="Selected" color="primary" sx={{ ml: 'auto' }} />}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t.desc}
                  </Typography>
                  <Box component="ul" sx={{ pl: 2, my: 0 }}>
                    {t.bullets.map(b => (
                      <Typography key={b} component="li" variant="caption" color="text.secondary">
                        {b}
                      </Typography>
                    ))}
                  </Box>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

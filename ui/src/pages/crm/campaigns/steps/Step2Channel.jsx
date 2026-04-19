import { Box, Typography, Chip } from '@mui/material';
import ChannelSms             from './channel/ChannelSms';
import ChannelVoiceAgentless  from './channel/ChannelVoiceAgentless';
import ChannelVoiceAgent      from './channel/ChannelVoiceAgent';
import ChannelEmail           from './channel/ChannelEmail';
import ChannelHybrid          from './channel/ChannelHybrid';

// Step 2 — dispatches to the correct channel config based on campaignType.

const TYPE_LABEL = {
  SMS:             'SMS · Bulk',
  VOICE_AGENTLESS: 'Voice · Agentless broadcast',
  VOICE_AGENT:     'Voice · Agent-assisted',
  EMAIL:           'Email',
  HYBRID:          'Hybrid · Multi-channel waterfall',
};

export default function Step2Channel(props) {
  const t = props.form.campaignType;
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
          Channel settings
        </Typography>
        <Chip size="small" label={TYPE_LABEL[t] || t} color="primary" variant="outlined" />
      </Box>

      {t === 'SMS'             && <ChannelSms            {...props} />}
      {t === 'VOICE_AGENTLESS' && <ChannelVoiceAgentless {...props} />}
      {t === 'VOICE_AGENT'     && <ChannelVoiceAgent     {...props} />}
      {t === 'EMAIL'           && <ChannelEmail          {...props} />}
      {t === 'HYBRID'          && <ChannelHybrid         {...props} />}
    </Box>
  );
}

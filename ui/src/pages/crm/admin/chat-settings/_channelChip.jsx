import { Chip } from '@mui/material';
import { CHAT_CHANNEL_COLORS } from '../../../../services/crm';

export default function ChannelChip({ channel, size = 'small' }) {
  if (!channel) return null;
  const color = CHAT_CHANNEL_COLORS[channel] || '#888';
  return (
    <Chip
      size={size}
      label={channel}
      variant="outlined"
      sx={{
        fontSize: 11,
        textTransform: 'capitalize',
        borderColor: color,
        color,
        '& .MuiChip-label': { fontWeight: 500 },
      }}
    />
  );
}

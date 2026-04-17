import { Box, Paper, Typography, Link as MuiLink, IconButton } from '@mui/material';
import {
  Email as EmailIcon, Phone as PhoneIcon, Language as WebIcon,
  Place as PlaceIcon, Business as BusinessIcon, Person as PersonIcon,
  MoreHoriz as MoreIcon,
} from '@mui/icons-material';

// Mirrors EspoCRM's client/res/templates/record/panels/side.tpl structure:
//   <label class="control-label">Label</label>
//   <div class="field">value</div>
// — stacked, not side-by-side. Each label is uppercase tiny gray with
// an optional field-kind icon (email/phone/website/address/person).

const ICONS = {
  email:   EmailIcon,
  tel:     PhoneIcon,
  url:     WebIcon,
  address: PlaceIcon,
  account: BusinessIcon,
  person:  PersonIcon,
};

export function FieldRow({ label, value, kind, multiline, noneText = 'None' }) {
  const Icon = kind ? ICONS[kind] : null;
  const isEmpty = value == null || value === '' || (Array.isArray(value) && !value.length);
  let rendered;
  if (isEmpty) {
    rendered = <Typography variant="body2" color="text.disabled" sx={{ fontSize: 13 }}>{noneText}</Typography>;
  } else if (kind === 'email' && typeof value === 'string') {
    rendered = <MuiLink href={`mailto:${value}`} sx={{ fontSize: 13 }}>{value}</MuiLink>;
  } else if (kind === 'tel' && typeof value === 'string') {
    rendered = <MuiLink href={`tel:${value}`} sx={{ fontSize: 13 }}>{value}</MuiLink>;
  } else if (kind === 'url' && typeof value === 'string') {
    const href = /^https?:/.test(value) ? value : `https://${value}`;
    rendered = <MuiLink href={href} target="_blank" rel="noopener" sx={{ fontSize: 13 }}>{value}</MuiLink>;
  } else if (typeof value === 'string' || typeof value === 'number') {
    rendered = (
      <Typography variant="body2" sx={{ fontSize: 13, whiteSpace: multiline ? 'pre-wrap' : 'normal' }}>
        {value}
      </Typography>
    );
  } else {
    // React element (Chip, MuiLink, etc.) — render in Box to avoid <p><div>… nesting.
    rendered = <Box sx={{ fontSize: 13 }}>{value}</Box>;
  }

  return (
    <Box sx={{ mb: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        {Icon && <Icon sx={{ fontSize: 13, color: 'text.secondary' }} />}
        <Typography variant="overline" sx={{
          fontSize: 10, letterSpacing: 0.8, fontWeight: 600,
          color: 'text.secondary', lineHeight: 1,
        }}>
          {label}
        </Typography>
      </Box>
      <Box>{rendered}</Box>
    </Box>
  );
}

export function Panel({ title, children, actions, dense = false, styleHint }) {
  // Styled to match the EspoCRM screenshot — white card, thin top section as
  // header, 1px border, rounded 6-8px.
  const bodyPad = dense ? 2 : 3;
  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 2,
        borderRadius: 1.5,
        overflow: 'hidden',
        borderColor: 'divider',
        ...(styleHint === 'success' && { borderTopColor: 'success.main', borderTopWidth: 2 }),
      }}
    >
      {title && (
        <Box sx={{
          px: bodyPad,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'background.default',
          borderBottom: 1,
          borderColor: 'divider',
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
            {title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {actions}
          </Box>
        </Box>
      )}
      <Box sx={{ px: bodyPad, py: dense ? 2 : 2.5 }}>
        {children}
      </Box>
    </Paper>
  );
}

export function PanelKebab({ onClick }) {
  return (
    <IconButton size="small" onClick={onClick}>
      <MoreIcon fontSize="small" />
    </IconButton>
  );
}

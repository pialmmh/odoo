import { Box } from '@mui/material';
import { AdminPageHeader } from '../_shared';
import SettingsForm from '../_SettingsForm';

// Mirrors application/Espo/Resources/layouts/Settings/sms.json
// SMS providers come from extensions (metadata/app/smsProviders.json). In the
// base build it's empty, so we render the provider field as free-text.
// Install an SMS-provider extension to get a dropdown inside native EspoCRM.
const PANELS = [
  {
    fields: [
      { name: 'smsProvider',           label: 'SMS Provider',     type: 'varchar',
        help: 'Provider key (e.g. Twilio, Clickatell). Requires the matching extension.' },
      { name: 'outboundSmsFromNumber', label: 'From Number',      type: 'varchar' },
    ],
  },
];

export default function Sms() {
  return (
    <Box sx={{ px: 3, py: 2.5, maxWidth: 900 }}>
      <AdminPageHeader sectionLabel="Messaging" title="SMS"
        subtitle="SMS settings." />
      <SettingsForm panels={PANELS} />
    </Box>
  );
}

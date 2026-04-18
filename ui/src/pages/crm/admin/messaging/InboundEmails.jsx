import { Box } from '@mui/material';
import { AdminPageHeader } from '../_shared';
import SettingsForm from '../_SettingsForm';

// Mirrors application/Espo/Resources/layouts/Settings/inboundEmails.json
const PANELS = [
  {
    fields: [
      { name: 'emailMessageMaxSize',       label: 'Max message size (MB)',    type: 'int',
        help: 'Attachments larger than this will be skipped.' },
      { name: 'personalEmailMaxPortionSize', label: 'Personal max portion',   type: 'int',
        help: 'Max emails fetched per run for a personal IMAP account.' },
      { name: 'maxEmailAccountCount',      label: 'Max accounts per user',    type: 'int' },
      { name: 'inboundEmailMaxPortionSize', label: 'Group max portion',       type: 'int',
        help: 'Max emails fetched per run for a group IMAP account.' },
    ],
  },
];

export default function InboundEmails() {
  return (
    <Box sx={{ px: 3, py: 2.5, maxWidth: 900 }}>
      <AdminPageHeader sectionLabel="Messaging" title="Inbound Emails"
        subtitle="Settings for incoming emails." />
      <SettingsForm panels={PANELS} />
    </Box>
  );
}

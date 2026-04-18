import { Box } from '@mui/material';
import { AdminPageHeader } from '../_shared';
import SettingsForm from '../_SettingsForm';

// Mirrors application/Espo/Resources/layouts/Settings/outboundEmails.json
// plus SMTP fields controlled by client/src/views/admin/outbound-emails.js.
const PANELS = [
  {
    label: 'SMTP',
    fields: [
      { name: 'smtpServer',   label: 'SMTP Server',   type: 'varchar', placeholder: 'smtp.example.com', full: true },
      { name: 'smtpPort',     label: 'SMTP Port',     type: 'int',
        visibleWhen: (f) => !!f.smtpServer },
      { name: 'smtpSecurity', label: 'Security',      type: 'enum',
        options: [{ value: '', label: '(none)' }, 'SSL', 'TLS'],
        visibleWhen: (f) => !!f.smtpServer },
      { name: 'smtpAuth',     label: 'SMTP Auth',     type: 'bool',
        visibleWhen: (f) => !!f.smtpServer },
      { name: 'smtpUsername', label: 'SMTP Username', type: 'varchar',
        visibleWhen: (f) => !!f.smtpServer && f.smtpAuth },
      { name: 'smtpPassword', label: 'SMTP Password', type: 'password',
        visibleWhen: (f) => !!f.smtpServer && f.smtpAuth },
    ],
  },
  {
    label: 'Configuration',
    fields: [
      { name: 'outboundEmailFromAddress', label: 'From Address', type: 'varchar' },
      { name: 'outboundEmailIsShared',    label: 'Shared System Account', type: 'bool',
        help: 'If enabled, system will use these SMTP settings to send emails for all users.' },
      { name: 'outboundEmailFromName',    label: 'From Name',    type: 'varchar' },
      { name: 'outboundEmailBccAddress',  label: 'BCC Address',  type: 'varchar' },
    ],
  },
  {
    label: 'Mass Email',
    fields: [
      { name: 'massEmailMaxPerHourCount',           label: 'Max emails per hour',  type: 'int' },
      { name: 'massEmailMaxPerBatchCount',          label: 'Max emails per batch', type: 'int' },
      { name: 'massEmailOpenTracking',              label: 'Open tracking',        type: 'bool' },
      { name: 'massEmailVerp',                      label: 'VERP (bounce handling)', type: 'bool' },
      { name: 'massEmailDisableMandatoryOptOutLink', label: 'Disable mandatory opt-out link', type: 'bool' },
    ],
  },
  {
    label: 'Scheduled Send',
    fields: [
      { name: 'emailScheduledBatchCount', label: 'Scheduled batch count', type: 'int' },
    ],
  },
];

export default function OutboundEmails() {
  return (
    <Box sx={{ px: 3, py: 2.5, maxWidth: 900 }}>
      <AdminPageHeader sectionLabel="Messaging" title="Outbound Emails"
        subtitle="SMTP settings for outgoing emails." />
      <SettingsForm panels={PANELS} />
    </Box>
  );
}

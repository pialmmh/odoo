import { Chip } from '@mui/material';

const MAP = {
  ACTIVE:       { bg: 'var(--color-success-bg)',  fg: 'var(--color-success-text)',  bd: 'var(--color-success-border)', label: 'Active' },
  PROVISIONING: { bg: 'var(--color-warning-bg)',  fg: 'var(--color-warning-text)',  bd: 'var(--color-warning-border)', label: 'Provisioning' },
  SUSPENDED:    { bg: 'var(--color-neutral-bg)',  fg: 'var(--color-neutral-text)',  bd: 'var(--color-border)',         label: 'Suspended' },
  DELETED:      { bg: 'var(--color-bg-muted)',    fg: 'var(--color-text-muted)',    bd: 'var(--color-border)',         label: 'Deleted', strike: true },
  LOCKED:       { bg: 'var(--color-danger-bg)',   fg: 'var(--color-danger-text)',   bd: 'var(--color-danger-border)',  label: 'Locked' },
  PENDING:      { bg: 'var(--color-warning-bg)',  fg: 'var(--color-warning-text)',  bd: 'var(--color-warning-border)', label: 'Pending' },
  RUNNING:      { bg: 'var(--color-warning-bg)',  fg: 'var(--color-warning-text)',  bd: 'var(--color-warning-border)', label: 'Running' },
  SUCCESS:      { bg: 'var(--color-success-bg)',  fg: 'var(--color-success-text)',  bd: 'var(--color-success-border)', label: 'Success' },
  FAILED:       { bg: 'var(--color-danger-bg)',   fg: 'var(--color-danger-text)',   bd: 'var(--color-danger-border)',  label: 'Failed' },
};

export default function PartyStatusChip({ status }) {
  const s = MAP[status] || { bg: 'var(--color-neutral-bg)', fg: 'var(--color-neutral-text)', bd: 'var(--color-border)', label: status };
  return (
    <Chip
      size="small"
      label={s.label}
      sx={{
        bgcolor: s.bg,
        color: s.fg,
        border: '1px solid',
        borderColor: s.bd,
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-medium)',
        height: 22,
        textDecoration: s.strike ? 'line-through' : 'none',
      }}
    />
  );
}

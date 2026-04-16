import { Box, Tooltip } from '@mui/material';

// Horizontal clickable pipeline bar matching EspoCRM's status label display.
// Styles mirror entityDefs/Lead.json → fields.status.style
// (In Process=primary, Converted=success, Recycled=info, Dead=info).

const STATUS_STYLE = {
  'New':        { bg: 'grey.200',         fg: 'text.primary' },
  'Assigned':   { bg: 'warning.light',    fg: 'warning.dark' },
  'In Process': { bg: 'primary.main',     fg: 'primary.contrastText' },
  'Converted':  { bg: 'success.main',     fg: 'success.contrastText' },
  'Recycled':   { bg: 'info.light',       fg: 'info.dark' },
  'Dead':       { bg: 'grey.400',         fg: 'text.primary' },
};

export default function StatusPipelineBar({ statuses, current, onChange, disabled }) {
  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        borderRadius: 1,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
      }}
    >
      {statuses.map((status, i) => {
        const active = status === current;
        const style = STATUS_STYLE[status] || { bg: 'background.paper', fg: 'text.primary' };
        return (
          <Tooltip key={status} title={disabled ? '' : `Mark as ${status}`} arrow>
            <Box
              onClick={() => !disabled && !active && onChange?.(status)}
              sx={{
                flex: 1,
                px: 1.5,
                py: 1,
                textAlign: 'center',
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                cursor: disabled || active ? 'default' : 'pointer',
                bgcolor: active ? style.bg : 'background.paper',
                color: active ? style.fg : 'text.secondary',
                borderRight: i < statuses.length - 1 ? 1 : 0,
                borderColor: 'divider',
                transition: 'background-color 0.15s ease, color 0.15s ease',
                '&:hover': disabled || active ? {} : { bgcolor: 'action.hover' },
                userSelect: 'none',
              }}
            >
              {status}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

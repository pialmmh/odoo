import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, TextField, InputAdornment, Paper, Divider,
  Table, TableBody, TableRow, TableCell, Link as MuiLink, Tooltip,
} from '@mui/material';
import { Search as SearchIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { ADMIN_SECTIONS, espoDeepLink } from './adminPanelSpec';

export default function AdminIndex() {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const base = tenant ? `/${tenant}` : '';
  const [q, setQ] = useState('');

  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return ADMIN_SECTIONS;
    return ADMIN_SECTIONS
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (it) =>
            it.label.toLowerCase().includes(needle) ||
            (it.desc || '').toLowerCase().includes(needle),
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [q]);

  const onItemClick = (item, e) => {
    if (item.action) {
      // Actions like clearCache / rebuild — not implemented yet, open Espo.
      const url = espoDeepLink({ espoUrl: '#Admin' });
      window.open(url, '_blank', 'noopener');
      return;
    }
    navigate(`${base}/crm/admin/${item.key}`);
  };

  return (
    <Box sx={{ px: 3, py: 2.5, maxWidth: 1100 }}>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Administration
      </Typography>

      <TextField
        fullWidth
        size="small"
        placeholder="Search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 2.5 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {sections.map((section) => (
        <Paper
          key={section.key}
          variant="outlined"
          sx={{ mb: 2, borderRadius: 1.5, overflow: 'hidden' }}
        >
          <Box sx={{ px: 2, py: 1.25, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {section.label}
            </Typography>
          </Box>
          <Divider />
          <Table size="small">
            <TableBody>
              {section.items.map((item) => (
                <TableRow
                  key={item.key}
                  hover
                  onClick={() => onItemClick(item)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ width: 220, pl: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, color: 'primary.main' }}>
                      <Box sx={{ display: 'flex', width: 18, justifyContent: 'center', '& svg': { fontSize: 16 } }}>
                        {item.icon}
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item.label}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    <Typography variant="body2">{item.desc}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ width: 44 }}>
                    {item.espoUrl && (
                      <Tooltip title="Open in EspoCRM">
                        <MuiLink
                          href={espoDeepLink(item)}
                          target="_blank"
                          rel="noopener"
                          onClick={(e) => e.stopPropagation()}
                          sx={{ display: 'inline-flex', color: 'text.secondary' }}
                        >
                          <OpenInNewIcon sx={{ fontSize: 15 }} />
                        </MuiLink>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      ))}
    </Box>
  );
}

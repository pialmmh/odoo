import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, IconButton, Paper, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  DeleteOutline as DeleteIcon,
  Hub as ClusterIcon,
  Launch as LaunchIcon,
} from '@mui/icons-material';
import { listClusters, deleteCluster } from '../../services/temporal';

export default function NmsTemporalClusters() {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const base = tenant ? `/${tenant}` : '';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // cluster pending delete

  async function refresh() {
    setLoading(true);
    setRows(await listClusters());
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function doDelete() {
    if (!confirm) return;
    await deleteCluster(confirm.id);
    setConfirm(null);
    refresh();
  }

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        <ClusterIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>Temporal Clusters</Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate(`${base}/nms/temporal/new`)}
        >
          Add Cluster
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Register clusters you want to monitor. Each cluster groups one or more frontend endpoints (host:port).
      </Typography>

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Tag</TableCell>
              <TableCell>Endpoints</TableCell>
              <TableCell>Web UI</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell align="right" sx={{ width: 120 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                    <Typography variant="body2">No clusters registered yet.</Typography>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      sx={{ mt: 1 }}
                      onClick={() => navigate(`${base}/nms/temporal/new`)}
                    >
                      Add your first cluster
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            )}
            {rows.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                </TableCell>
                <TableCell>
                  {c.tag ? <Chip size="small" label={c.tag} color={c.color || 'default'} variant="outlined" /> : null}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {(c.endpoints || []).length} node{(c.endpoints || []).length === 1 ? '' : 's'}
                  </Typography>
                  {(c.endpoints || []).slice(0, 3).map((e, i) => (
                    <Typography key={i} variant="caption" component="div" sx={{ fontFamily: 'monospace' }}>
                      {e.tls ? 'grpcs://' : ''}{e.host}:{e.port}
                    </Typography>
                  ))}
                  {(c.endpoints || []).length > 3 && (
                    <Typography variant="caption" color="text.secondary">+{c.endpoints.length - 3} more</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {c.webuiBaseUrl ? (
                    <Tooltip title={c.webuiBaseUrl}>
                      <IconButton size="small" component="a" href={c.webuiBaseUrl} target="_blank" rel="noreferrer">
                        <LaunchIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary" sx={{
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden', maxWidth: 260,
                  }}>
                    {c.notes || ''}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => navigate(`${base}/nms/temporal/${c.id}/edit`)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => setConfirm(c)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        <DialogTitle>Remove cluster?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This only unregisters <strong>{confirm?.name}</strong> from the monitoring UI.
            The actual cluster is not affected.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={doDelete}>Remove</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

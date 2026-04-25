import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, TextField, InputAdornment,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  TablePagination, CircularProgress, Chip, Alert, IconButton, Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import { listProducts } from '../../services/erpProducts';
import { useNotification } from '../../components/ErrorNotification';

/**
 * ERP → Product list (experimental).
 * Read-only against the iDempiere catalog while the REST plugin is being
 * provisioned. Click a row to drill into the detail page.
 */
export default function ErpProductList() {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const { error: notifyError } = useNotification();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [search, setSearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listProducts({ search, page, size, sort: 'value', dir: 'asc' });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e) {
      notifyError('Failed to load products', e?.response?.data?.message || e.message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, page, size, notifyError]);

  useEffect(() => { load(); }, [load]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      if (pendingSearch !== search) {
        setSearch(pendingSearch);
        setPage(0);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [pendingSearch, search]);

  return (
    <Box sx={{ px: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Products</Typography>
          <Typography variant="caption" color="text.secondary">
            Experimental — read-only view of the ERP catalog
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search by key, name, or SKU"
            value={pendingSearch}
            onChange={(e) => setPendingSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            }}
            sx={{ width: 320 }}
          />
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={load}><RefreshIcon /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        This page is experimental. Writes (create / edit / delete) and child tabs (Price, Purchasing,
        Accounting, BOM, etc.) will be wired once the underlying engine's API plugin is installed.
      </Alert>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading && items.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Search Key</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>UOM</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Active</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Stocked</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Sold</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        No products
                      </TableCell>
                    </TableRow>
                  )}
                  {items.map((p) => (
                    <TableRow
                      key={p.id}
                      hover
                      onClick={() => navigate(`/${tenant}/erp/product/${p.id}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{p.value}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{p.name}</TableCell>
                      <TableCell>{p.productCategoryName || '—'}</TableCell>
                      <TableCell>{p.uomName || '—'}</TableCell>
                      <TableCell>
                        {p.productType
                          ? <Chip label={p.productType} size="small" variant="outlined" />
                          : '—'}
                      </TableCell>
                      <TableCell>{p.sku || '—'}</TableCell>
                      <TableCell align="center">
                        {p.isActive
                          ? <Chip label="Yes" size="small" color="success" variant="outlined" />
                          : <Chip label="No"  size="small" variant="outlined" />}
                      </TableCell>
                      <TableCell align="center">{p.isStocked ? '✓' : ''}</TableCell>
                      <TableCell align="center">{p.isSold ? '✓' : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={size}
            onRowsPerPageChange={(e) => { setSize(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[25, 50, 100, 200]}
          />
        </CardContent>
      </Card>
    </Box>
  );
}

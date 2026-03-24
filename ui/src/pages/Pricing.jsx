import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup, Chip, Divider,
} from '@mui/material';
import { getProductTemplates, getProductVariants, getAttributeValues } from '../services/odoo';

export default function Pricing() {
  const [templates, setTemplates] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('bandwidth');

  useEffect(() => {
    (async () => {
      try {
        const [tmpls, vars] = await Promise.all([
          getProductTemplates([['sale_ok', '=', true]]),
          getProductVariants([['active', '=', true]]),
        ]);
        // Enrich variants with attribute value names
        const allAttrIds = vars.flatMap(v => v.product_template_attribute_value_ids || []);
        const uniqueIds = [...new Set(allAttrIds)];
        const attrVals = uniqueIds.length > 0 ? await getAttributeValues(uniqueIds) : [];
        const attrMap = Object.fromEntries(attrVals.map(v => [v.id, v]));
        const enriched = vars.map(v => ({
          ...v,
          _attrs: (v.product_template_attribute_value_ids || []).map(id => attrMap[id]).filter(Boolean),
        }));
        setTemplates(tmpls);
        setVariants(enriched);
      } catch (e) {
        setError('Failed to load pricing: ' + e.message);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  // Group products by type
  const tmplMap = Object.fromEntries(templates.map(t => [t.id, t]));

  // Find bandwidth products (those with multiple variants from billing cycle)
  const bandwidthProducts = templates.filter(t => t.product_variant_count > 1 &&
    (t.categ_id?.[1]?.includes('Bandwidth') || t.categ_id?.[1]?.includes('Dedicated') || t.categ_id?.[1]?.includes('Internet')));
  const smsProducts = templates.filter(t => t.categ_id?.[1]?.includes('SMS'));
  const simpleProducts = templates.filter(t => t.product_variant_count <= 1 && !t.categ_id?.[1]?.includes('SMS'));

  // Build bandwidth pricing matrix using enriched attribute data
  const buildPricingMatrix = (tmplIds) => {
    const relevantVariants = variants.filter(v => tmplIds.includes(v.product_tmpl_id?.[0]));

    const rows = {};
    relevantVariants.forEach(v => {
      const tmpl = tmplMap[v.product_tmpl_id?.[0]];
      const tmplName = tmpl?.name || '';

      let bandwidth = '';
      let cycle = '';
      (v._attrs || []).forEach(a => {
        const attrName = a.attribute_id?.[1] || '';
        if (attrName === 'Bandwidth' || a.name.includes('Mbps') || a.name.includes('Gbps')) {
          bandwidth = a.name;
        } else if (attrName === 'Billing Cycle' || ['Monthly', 'Quarterly', 'Yearly'].includes(a.name)) {
          cycle = a.name;
        }
      });

      if (!bandwidth) bandwidth = tmplName;
      if (!cycle) cycle = 'Standard';

      const key = `${tmplName}|${bandwidth}`;
      if (!rows[key]) rows[key] = { product: tmplName, bandwidth, prices: {} };
      rows[key].prices[cycle] = v.lst_price;
    });

    return Object.values(rows).sort((a, b) => {
      const numA = parseFloat(a.bandwidth) || 0;
      const numB = parseFloat(b.bandwidth) || 0;
      return numA - numB;
    });
  };

  const bandwidthMatrix = buildPricingMatrix(bandwidthProducts.map(t => t.id));
  const cycles = ['Monthly', 'Quarterly', 'Yearly'];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Pricing</Typography>
          <Typography variant="body2" color="text.secondary">
            All service prices from Odoo catalog
          </Typography>
        </Box>
        <ToggleButtonGroup value={view} exclusive onChange={(_, v) => v && setView(v)} size="small">
          <ToggleButton value="bandwidth" sx={{ textTransform: 'none', px: 2 }}>Internet Plans</ToggleButton>
          <ToggleButton value="sms" sx={{ textTransform: 'none', px: 2 }}>SMS Packages</ToggleButton>
          <ToggleButton value="services" sx={{ textTransform: 'none', px: 2 }}>Other Services</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {view === 'bandwidth' && (
        <>
          {bandwidthProducts.map(tmpl => {
            const rows = bandwidthMatrix.filter(r => r.product === tmpl.name);
            if (rows.length === 0) return null;
            return (
              <Card key={tmpl.id} sx={{ mb: 3 }}>
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ p: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{tmpl.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{tmpl.description_sale}</Typography>
                    </Box>
                    {tmpl.x_kb_product_name && (
                      <Chip label={`Billing: ${tmpl.x_kb_product_name}`} size="small" variant="outlined" />
                    )}
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, width: 200 }}>Bandwidth</TableCell>
                          {cycles.map(c => (
                            <TableCell key={c} sx={{ fontWeight: 600 }} align="right">{c}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((row, i) => (
                          <TableRow key={i} hover>
                            <TableCell>
                              <Chip label={row.bandwidth} size="small"
                                sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 600 }} />
                            </TableCell>
                            {cycles.map(c => (
                              <TableCell key={c} align="right">
                                {row.prices[c] ? (
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                    ৳{row.prices[c].toLocaleString()}
                                  </Typography>
                                ) : (
                                  <Typography variant="body2" color="text.disabled">-</Typography>
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      {view === 'sms' && (
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2, pb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>SMS Packages</Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Package</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Price (BDT)</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Per SMS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {variants
                    .filter(v => smsProducts.some(t => t.id === v.product_tmpl_id?.[0]))
                    .sort((a, b) => a.lst_price - b.lst_price)
                    .map(v => {
                      const match = v.name.match(/(\d+[KM]?)\s*SMS/i);
                      const qty = match ? match[1] : '';
                      const count = qty.includes('M') ? parseFloat(qty) * 1000000 :
                        qty.includes('K') ? parseFloat(qty) * 1000 : parseFloat(qty) || 1;
                      const perSms = v.lst_price / count;
                      return (
                        <TableRow key={v.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{v.name}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              ৳{v.lst_price?.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="caption" color="text.secondary">
                              ৳{perSms.toFixed(2)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {view === 'services' && (
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2, pb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Other Services</Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Service</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Price (BDT)</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {simpleProducts
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(p => (
                      <TableRow key={p.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={p.categ_id?.[1] || '-'} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            ৳{p.list_price?.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }} noWrap>
                            {p.description_sale || '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

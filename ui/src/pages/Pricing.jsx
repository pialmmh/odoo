import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup, Chip, Divider,
} from '@mui/material';
import { getProductTemplates, getProductVariants, getAttributeValues, getCurrentRatesBulk } from '../services/odoo';

export default function Pricing() {
  const [templates, setTemplates] = useState([]);
  const [variants, setVariants] = useState([]);
  const [datedRates, setDatedRates] = useState({ variants: {}, templates: {} });
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

        // Fetch currently-active dated rates for all templates + variants in one bulk call
        const rates = await getCurrentRatesBulk(
          vars.map(v => v.id),
          tmpls.map(t => t.id),
          'standard',
        );
        setDatedRates(rates || { variants: {}, templates: {} });
      } catch (e) {
        setError('Failed to load pricing: ' + e.message);
      }
      setLoading(false);
    })();
  }, []);

  // Helper: get dated price for a variant, falling back to lst_price (keys are strings from backend)
  const getDatedVariantPrice = (variantId, listPrice) => {
    const dated = datedRates.variants?.[String(variantId)];
    return dated !== undefined ? { price: dated, effective: true } : { price: listPrice, effective: false };
  };
  const getDatedTemplatePrice = (tmplId, listPrice) => {
    const dated = datedRates.templates?.[String(tmplId)];
    return dated !== undefined ? { price: dated, effective: true } : { price: listPrice, effective: false };
  };

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
      if (!rows[key]) rows[key] = { product: tmplName, bandwidth, prices: {}, dated: {} };
      rows[key].prices[cycle] = v.lst_price;
      const datedInfo = getDatedVariantPrice(v.id, v.lst_price);
      rows[key].dated[cycle] = datedInfo;
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
            <strong>List</strong> = catalog list price. <strong>Effective</strong> = current dated price (falls back to List when no dated price is set).
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
                          <TableCell rowSpan={2} sx={{ fontWeight: 600, width: 180, verticalAlign: 'bottom' }}>Bandwidth</TableCell>
                          {cycles.map(c => (
                            <TableCell key={c} align="center" colSpan={2}
                              sx={{ fontWeight: 600, borderLeft: '1px solid #eee' }}>{c}</TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          {cycles.map(c => [
                            <TableCell key={`${c}-list`} align="right"
                              sx={{ fontWeight: 500, fontSize: 11, color: 'text.secondary', borderLeft: '1px solid #eee' }}>
                              List
                            </TableCell>,
                            <TableCell key={`${c}-dated`} align="right"
                              sx={{ fontWeight: 500, fontSize: 11, color: 'text.secondary' }}>
                              Effective
                            </TableCell>,
                          ])}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((row, i) => (
                          <TableRow key={i} hover>
                            <TableCell>
                              <Chip label={row.bandwidth} size="small"
                                sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 600 }} />
                            </TableCell>
                            {cycles.map(c => {
                              const list = row.prices[c];
                              const dated = row.dated[c];
                              return [
                                <TableCell key={`${c}-list`} align="right" sx={{ borderLeft: '1px solid #eee' }}>
                                  {list ? (
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                      ৳{list.toLocaleString()}
                                    </Typography>
                                  ) : (
                                    <Typography variant="body2" color="text.disabled">-</Typography>
                                  )}
                                </TableCell>,
                                <TableCell key={`${c}-dated`} align="right">
                                  {dated && dated.price != null ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                      <Typography variant="body2" sx={{ fontWeight: 700, color: dated.effective ? 'primary.main' : 'text.secondary' }}>
                                        ৳{dated.price.toLocaleString()}
                                      </Typography>
                                      {!dated.effective && (
                                        <Chip label="fallback" size="small"
                                          sx={{ height: 16, fontSize: 9, bgcolor: '#fff3e0', color: '#e65100' }} />
                                      )}
                                    </Box>
                                  ) : (
                                    <Typography variant="body2" color="text.disabled">-</Typography>
                                  )}
                                </TableCell>,
                              ];
                            })}
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
                    <TableCell sx={{ fontWeight: 600 }} align="right">List Price (BDT)</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Effective Price (BDT)</TableCell>
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
                      const dated = getDatedVariantPrice(v.id, v.lst_price);
                      const effective = dated.price;
                      const perSms = effective / count;
                      return (
                        <TableRow key={v.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{v.name}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              ৳{v.lst_price?.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: dated.effective ? 'primary.main' : 'text.secondary' }}>
                                ৳{effective?.toLocaleString()}
                              </Typography>
                              {!dated.effective && (
                                <Chip label="fallback" size="small"
                                  sx={{ height: 16, fontSize: 9, bgcolor: '#fff3e0', color: '#e65100' }} />
                              )}
                            </Box>
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
                    <TableCell sx={{ fontWeight: 600 }} align="right">List Price (BDT)</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Effective Price (BDT)</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {simpleProducts
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(p => {
                      const dated = getDatedTemplatePrice(p.id, p.list_price);
                      return (
                        <TableRow key={p.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={p.categ_id?.[1] || '-'} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              ৳{p.list_price?.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: dated.effective ? 'primary.main' : 'text.secondary' }}>
                                ৳{dated.price?.toLocaleString()}
                              </Typography>
                              {!dated.effective && (
                                <Chip label="fallback" size="small"
                                  sx={{ height: 16, fontSize: 9, bgcolor: '#fff3e0', color: '#e65100' }} />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }} noWrap>
                              {p.description_sale || '-'}
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
    </Box>
  );
}

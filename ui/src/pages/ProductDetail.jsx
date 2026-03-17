import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Chip, CircularProgress,
  Alert, Button, Divider, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Tooltip,
} from '@mui/material';
import { ArrowBack, Link as LinkIcon } from '@mui/icons-material';
import {
  getProductTemplate, getProductVariantsByTemplate, getAttributeValues,
} from '../services/odoo';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const tmpl = await getProductTemplate(parseInt(id));
        if (!tmpl) { setError('Product not found'); setLoading(false); return; }
        setTemplate(tmpl);

        const vars = await getProductVariantsByTemplate(tmpl.id);

        // Enrich variants with attribute value names
        const allAttrValIds = vars.flatMap(v => v.product_template_attribute_value_ids || []);
        const uniqueIds = [...new Set(allAttrValIds)];
        const attrVals = uniqueIds.length > 0 ? await getAttributeValues(uniqueIds) : [];
        const attrValMap = Object.fromEntries(attrVals.map(v => [v.id, v]));

        const enriched = vars.map(v => ({
          ...v,
          attributes: (v.product_template_attribute_value_ids || [])
            .map(id => attrValMap[id])
            .filter(Boolean),
        }));

        setVariants(enriched);
      } catch (e) {
        setError('Failed to load product: ' + e.message);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!template) return null;

  // Group variants by first attribute for a nice table layout
  const attrGroups = {};
  variants.forEach(v => {
    v.attributes.forEach(a => {
      const attrName = a.attribute_id?.[1] || 'Other';
      if (!attrGroups[attrName]) attrGroups[attrName] = new Set();
      attrGroups[attrName].add(a.name);
    });
  });

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/products')} sx={{ mb: 2 }}>
        Back to Products
      </Button>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>{template.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {template.categ_id?.[1] || 'Uncategorized'} &middot; {template.type === 'service' ? 'Service' : template.type}
              </Typography>
              {template.description_sale && (
                <Typography variant="body2" sx={{ mb: 1 }}>{template.description_sale}</Typography>
              )}
            </Box>
            {template.list_price > 0 && (
              <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>
                ৳{template.list_price.toLocaleString()}
              </Typography>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>Product Info</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <InfoRow label="Product ID" value={template.id} />
                <InfoRow label="Variants" value={template.product_variant_count} />
                <InfoRow label="Active" value={template.active ? 'Yes' : 'No'} />
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>Kill Bill Mapping</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <InfoRow label="KB Product Name" value={template.x_kb_product_name || 'Not mapped'} mono />
                <InfoRow label="KB Category" value={template.x_kb_category || 'Not set'} />
              </Box>
            </Grid>
          </Grid>

          {Object.keys(attrGroups).length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>Attributes</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {Object.entries(attrGroups).map(([attrName, values]) => (
                  <Box key={attrName}>
                    <Typography variant="caption" color="text.secondary">{attrName}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      {[...values].map(v => (
                        <Chip key={v} label={v} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      {variants.length > 0 && (
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2, pb: 1 }}>
              <Typography variant="h6">
                Variants & Pricing ({variants.length})
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Variant</TableCell>
                    {Object.keys(attrGroups).map(attr => (
                      <TableCell key={attr} sx={{ fontWeight: 600 }}>{attr}</TableCell>
                    ))}
                    <TableCell sx={{ fontWeight: 600 }} align="right">Price (BDT)</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>KB Plan</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Billing Period</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Trial</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {variants.map(v => {
                    const attrByGroup = {};
                    v.attributes.forEach(a => {
                      attrByGroup[a.attribute_id?.[1] || 'Other'] = a.name;
                    });
                    return (
                      <TableRow key={v.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {v.name}
                          </Typography>
                        </TableCell>
                        {Object.keys(attrGroups).map(attr => (
                          <TableCell key={attr}>
                            {attrByGroup[attr] && (
                              <Chip label={attrByGroup[attr]} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                            )}
                          </TableCell>
                        ))}
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            ৳{v.lst_price?.toLocaleString() || 0}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {v.x_kb_plan_name || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>{v.x_kb_billing_period || '-'}</TableCell>
                        <TableCell>
                          {v.x_kb_has_trial ? `${v.x_kb_trial_days}d` : '-'}
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

function InfoRow({ label, value, mono }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value}
      </Typography>
    </Box>
  );
}

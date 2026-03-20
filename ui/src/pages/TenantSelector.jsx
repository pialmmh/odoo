import { useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardActionArea, Grid, Chip, CircularProgress } from '@mui/material';
import { Business as BusinessIcon } from '@mui/icons-material';
import { useTenant } from '../context/TenantContext';

export default function TenantSelector() {
  const { tenants, loading, switchTenant } = useTenant();
  const navigate = useNavigate();

  const handleSelect = (tenant) => {
    switchTenant(tenant);
    navigate(`/${tenant.slug}/`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 8, px: 3 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>Select Tenant</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Choose a tenant to manage their infrastructure and billing.
      </Typography>
      <Grid container spacing={2}>
        {tenants.map(t => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={t.id}>
            <Card variant="outlined" sx={{ '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}>
              <CardActionArea onClick={() => handleSelect(t)} sx={{ p: 3, textAlign: 'center' }}>
                <BusinessIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h6" fontWeight={600}>{t.name}</Typography>
                <Chip label={t.slug} size="small" variant="outlined" sx={{ mt: 1, fontSize: 11 }} />
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
      {tenants.length === 0 && (
        <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
          No tenants found. Create a company partner in Odoo first.
        </Typography>
      )}
    </Box>
  );
}

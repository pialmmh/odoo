import {
  AppBar, Toolbar, Typography, Chip, Box, MenuItem,
  Select, Button, Divider,
} from '@mui/material';
import { Logout, Warning, Business } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { DRAWER_WIDTH } from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';

export default function TopBar() {
  const { auth, isSuper, logout, authMode, switchAuthMode } = useAuth();
  const { tenants, activeTenant, switchTenant, tenantSlug } = useTenant();
  const navigate = useNavigate();

  const handleSwitchTenant = (tenantId) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      switchTenant(tenant);
      navigate(`/${tenant.slug}/`);
    }
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: `calc(100% - ${DRAWER_WIDTH}px)`,
        ml: `${DRAWER_WIDTH}px`,
        bgcolor: '#fff',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <Box>
          {activeTenant ? (
            <Typography variant="body2" color="text.secondary">
              Tenant: <strong>{activeTenant.name}</strong>
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Warning sx={{ fontSize: 18, color: '#ff9f43' }} />
              <Typography variant="body2" color="text.secondary">
                Select a tenant
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Select
            size="small"
            value={activeTenant?.id || ''}
            onChange={(e) => handleSwitchTenant(e.target.value)}
            displayEmpty
            sx={{ minWidth: 180, fontSize: 13, height: 32 }}
            startAdornment={<Business sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />}
          >
            <MenuItem value="" disabled><em>Select tenant...</em></MenuItem>
            {tenants.map((t) => (
              <MenuItem key={t.id} value={t.id} sx={{ fontSize: 13 }}>
                {t.name}
              </MenuItem>
            ))}
          </Select>

          <Divider orientation="vertical" flexItem />

          <Chip
            label={authMode === 'keycloak' ? 'KC' : 'Local'}
            size="small"
            sx={{ height: 18, fontSize: 8, fontWeight: 700,
              bgcolor: authMode === 'keycloak' ? '#e3f2fd' : '#fff3e0',
              color: authMode === 'keycloak' ? '#1565c0' : '#e65100',
              cursor: 'pointer',
            }}
            onClick={() => switchAuthMode(authMode === 'keycloak' ? 'legacy' : 'keycloak')}
            title="Click to switch auth mode"
          />
          <Chip
            label={isSuper ? 'Super Admin' : 'Tenant Admin'}
            size="small"
            sx={{
              bgcolor: isSuper ? '#f3e5f5' : '#e8f5e9',
              color: isSuper ? '#7b1fa2' : '#2e7d32',
              fontWeight: 500, fontSize: 11, height: 22,
            }}
          />
          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 13 }}>
            {auth?.username}
          </Typography>
          <Button size="small" startIcon={<Logout sx={{ fontSize: 14 }} />} onClick={logout}
            sx={{ fontSize: 11, color: 'text.secondary', minWidth: 'auto' }}>
            Logout
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

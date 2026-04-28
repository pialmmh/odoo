import {
  AppBar, Toolbar, Typography, Chip, Box, MenuItem,
  Select, Button, Divider, Tooltip, IconButton,
} from '@mui/material';
import { Logout, Warning, Business, LightMode, DarkMode } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { DRAWER_WIDTH } from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { useAppTheme } from '../context/ThemeContext';

export default function TopBar() {
  const { auth, isSuper, logout } = useAuth();
  const { tenants, activeTenant, switchTenant, tenantSlug } = useTenant();
  const { themeKey, switchTheme, available, mode, toggleMode } = useAppTheme();
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
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
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
              <Warning sx={{ fontSize: 18, color: 'warning.main' }} />
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

          {/* Brand color switcher */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            {available.map(t => (
              <Tooltip key={t.key} title={t.label} arrow>
                <Box
                  onClick={() => switchTheme(t.key)}
                  sx={{
                    width: 14, height: 14, borderRadius: '50%',
                    bgcolor: t.color,
                    border: (theme) => themeKey === t.key
                      ? `2px solid ${theme.palette.text.primary}`
                      : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                    '&:hover': (theme) => ({ border: `2px solid ${theme.palette.text.disabled}` }),
                  }}
                />
              </Tooltip>
            ))}
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Light / Dark mode toggle */}
          <Tooltip title={mode === 'light' ? 'Switch to dark' : 'Switch to light'} arrow>
            <IconButton size="small" onClick={toggleMode} sx={{ color: 'text.secondary' }}>
              {mode === 'light' ? <DarkMode sx={{ fontSize: 18 }} /> : <LightMode sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem />

          {(() => {
            const roles = auth?.roles || [];
            const isTenantAdmin = roles.includes('tenant_admin');
            const label = isSuper ? 'Super Admin' : isTenantAdmin ? 'Tenant Admin' : 'Agent';
            const color = isSuper ? 'secondary' : isTenantAdmin ? 'success' : 'primary';
            return (
              <Chip label={label} size="small" color={color} variant="outlined"
                sx={{ fontWeight: 500, fontSize: 11, height: 22 }} />
            );
          })()}
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

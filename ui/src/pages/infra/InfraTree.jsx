import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, CircularProgress, IconButton, Tooltip, TextField,
  InputAdornment, Chip, Menu, MenuItem, ListItemIcon, ListItemText,
} from '@mui/material';
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';
import {
  Public as RegionIcon,
  Cloud as ZoneIcon,
  Business as DcIcon,
  Dns as ComputeIcon,
  Router as DeviceIcon,
  Storage as StorageIcon,
  Lan as NetworkIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Computer as ServerIcon,
  ViewInAr as ContainerIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import {
  getRegions, getAvailabilityZones, getDatacenters,
  getComputes, getNetworkDevices, getContainers,
} from '../../services/infra';
import { useAppTheme } from '../../context/ThemeContext';

const BADGE_BASE = { fontSize: 9, height: 16, ml: 0.5, fontWeight: 700, letterSpacing: 0.4, '& .MuiChip-label': { px: 0.7 } };

function SolidBadge({ label, color }) {
  return <Chip label={label} size="small" sx={{ ...BADGE_BASE, bgcolor: color, color: '#fff' }} />;
}
function OutlinedBadge({ label, color }) {
  return <Chip label={label} size="small" variant="outlined" sx={{ ...BADGE_BASE, borderColor: color, color, borderWidth: 1.5 }} />;
}
function TintedBadge({ label, color }) {
  return <Chip label={label} size="small" sx={{ ...BADGE_BASE, bgcolor: `${color}18`, color, border: 'none' }} />;
}

function TreeLabel({ icon, name, badge }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', py: 0.2 }}>
      {icon}
      <Typography fontSize={13} sx={{ flexGrow: 1 }}>{name}</Typography>
      {badge}
    </Box>
  );
}

const NODE_TYPE_LABELS = { dedicated_server: 'Server', vm: 'VM' };
const CONTAINER_TYPE_LABELS = { lxc: 'LXC', lxd: 'LXD', docker: 'Docker', podman: 'Podman', kubernetes: 'K8s' };

// Context menu items per node type → what children can be added
const CONTEXT_ACTIONS = {
  root: [{ label: 'Add Region', childType: 'add_region', icon: <RegionIcon fontSize="small" /> }],
  region: [{ label: 'Add Zone', childType: 'add_zone', icon: <ZoneIcon fontSize="small" /> }],
  zone: [{ label: 'Add Datacenter', childType: 'add_datacenter', icon: <DcIcon fontSize="small" /> }],
  datacenter: [
    { label: 'Add Compute', childType: 'add_compute', icon: <ComputeIcon fontSize="small" /> },
    { label: 'Add Network Device', childType: 'add_network_device', icon: <DeviceIcon fontSize="small" /> },
  ],
  compute: [{ label: 'Add Container', childType: 'add_container', icon: <ContainerIcon fontSize="small" /> }],
};

export default function InfraTree({ onSelect, onContextAction, partnerId }) {
  const [regions, setRegions] = useState([]);
  const [zones, setZones] = useState([]);
  const [datacenters, setDatacenters] = useState([]);
  const [computes, setComputes] = useState([]);
  const [devices, setDevices] = useState([]);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { brand } = useAppTheme();
  const ic = brand.infra;

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      // Filter datacenters by partner if tenant is selected
      const dcDomain = partnerId ? [['partner_id', '=', partnerId]] : [];
      const [r, z, d, comp, dev, cont] = await Promise.all([
        getRegions(), getAvailabilityZones(), getDatacenters(dcDomain),
        getComputes(), getNetworkDevices(), getContainers(),
      ]);
      setRegions(r); setZones(z); setDatacenters(d);
      setComputes(comp); setDevices(dev); setContainers(cont);
    } catch (e) {
      console.error('Failed to load infra tree', e);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => { loadTree(); }, [loadTree]);

  const handleSelect = (type, context) => {
    onSelect?.({ type, ...context });
  };

  const handleContextMenu = (e, nodeType, context) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, nodeType, context });
  };

  const handleContextAction = (childType) => {
    if (contextMenu) {
      onContextAction?.({ action: childType, ...contextMenu.context });
    }
    setContextMenu(null);
  };

  const filterMatch = (name) => !search || name.toLowerCase().includes(search.toLowerCase());

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>;
  }

  const contextActions = contextMenu ? (CONTEXT_ACTIONS[contextMenu.nodeType] || []) : [];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5, gap: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>Infrastructure</Typography>
        <Tooltip title="Add Region"><IconButton size="small" onClick={() => onContextAction?.({ action: 'add_region' })}><AddIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Refresh"><IconButton size="small" onClick={loadTree}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
      </Box>
      <TextField
        size="small" placeholder="Filter..." value={search} onChange={e => setSearch(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        sx={{ mx: 1, mb: 1 }}
      />
      <Box sx={{ flexGrow: 1, overflow: 'auto', px: 0.5 }} onContextMenu={(e) => handleContextMenu(e, 'root', {})}>
        <SimpleTreeView>
          {regions.filter(r => filterMatch(r.name)).map(region => (
            <TreeItem key={`r-${region.id}`} itemId={`r-${region.id}`}
              label={<TreeLabel icon={<RegionIcon fontSize="small" sx={{ mr: 0.5, color: ic.region }} />} name={region.name} badge={<SolidBadge label="Region" color={ic.region} />} />}
              onClick={() => handleSelect('region_detail', { region })}
              onContextMenu={(e) => handleContextMenu(e, 'region', { region })}
            >
              {zones.filter(z => z.region_id?.[0] === region.id && filterMatch(z.name)).map(zone => (
                <TreeItem key={`z-${zone.id}`} itemId={`z-${zone.id}`}
                  label={<TreeLabel icon={<ZoneIcon fontSize="small" sx={{ mr: 0.5, color: ic.zone }} />} name={zone.name} badge={<OutlinedBadge label="Zone" color={ic.zone} />} />}
                  onClick={() => handleSelect('zone_detail', { region, zone })}
                  onContextMenu={(e) => handleContextMenu(e, 'zone', { region, zone })}
                >
                  {datacenters.filter(dc => dc.zone_id?.[0] === zone.id).map(dc => {
                    const dcComputes = computes.filter(c => c.datacenter_id?.[0] === dc.id);
                    const dcDevices = devices.filter(d => d.datacenter_id?.[0] === dc.id);
                    return (
                      <TreeItem key={`dc-${dc.id}`} itemId={`dc-${dc.id}`}
                        label={<TreeLabel icon={<DcIcon fontSize="small" sx={{ mr: 0.5, color: ic.dc }} />} name={dc.name} badge={<TintedBadge label="DC" color={ic.dc} />} />}
                        onClick={() => handleSelect('datacenter_detail', { region, zone, datacenter: dc })}
                        onContextMenu={(e) => handleContextMenu(e, 'datacenter', { region, zone, datacenter: dc })}
                      >
                        {/* Computes */}
                        <TreeItem key={`dc-${dc.id}-computes`} itemId={`dc-${dc.id}-computes`}
                          label={<Box sx={{ display: 'flex', alignItems: 'center' }}><ComputeIcon fontSize="small" sx={{ mr: 0.5, color: ic.leaf }} /><Typography fontSize={13}>Computes</Typography>{dcComputes.length > 0 && <Chip label={dcComputes.length} size="small" sx={{ ml: 0.5, height: 16, fontSize: 9 }} />}</Box>}
                          onClick={(e) => { e.stopPropagation(); handleSelect('computes', { region, zone, datacenter: dc }); }}
                        >
                          {dcComputes.map(comp => {
                            const compContainers = containers.filter(ct => ct.compute_id?.[0] === comp.id);
                            return (
                              <TreeItem key={`comp-${comp.id}`} itemId={`comp-${comp.id}`}
                                label={<Box sx={{ display: 'flex', alignItems: 'center' }}><ServerIcon fontSize="small" sx={{ mr: 0.5, color: ic.leaf }} /><Typography fontSize={12}>{comp.name}</Typography><Chip label={NODE_TYPE_LABELS[comp.node_type] || comp.node_type} size="small" variant="outlined" sx={{ ml: 0.5, height: 14, fontSize: 8 }} /></Box>}
                                onClick={(e) => { e.stopPropagation(); handleSelect('compute_detail', { region, zone, datacenter: dc, compute: comp }); }}
                                onContextMenu={(e) => handleContextMenu(e, 'compute', { region, zone, datacenter: dc, compute: comp })}
                              >
                                {compContainers.map(ct => (
                                  <TreeItem key={`cont-${ct.id}`} itemId={`cont-${ct.id}`}
                                    label={<Box sx={{ display: 'flex', alignItems: 'center' }}><ContainerIcon fontSize="small" sx={{ mr: 0.5, color: ic.leaf, opacity: 0.7 }} /><Typography fontSize={11}>{ct.name}</Typography><Chip label={CONTAINER_TYPE_LABELS[ct.container_type] || ct.container_type} size="small" variant="outlined" sx={{ ml: 0.5, height: 14, fontSize: 8 }} /></Box>}
                                    onClick={(e) => { e.stopPropagation(); handleSelect('container_detail', { region, zone, datacenter: dc, compute: comp, container: ct }); }}
                                  />
                                ))}
                              </TreeItem>
                            );
                          })}
                        </TreeItem>
                        {/* Network Devices */}
                        <TreeItem key={`dc-${dc.id}-network_devices`} itemId={`dc-${dc.id}-network_devices`}
                          label={<Box sx={{ display: 'flex', alignItems: 'center' }}><DeviceIcon fontSize="small" sx={{ mr: 0.5, color: ic.leaf }} /><Typography fontSize={13}>Network Devices</Typography>{dcDevices.length > 0 && <Chip label={dcDevices.length} size="small" sx={{ ml: 0.5, height: 16, fontSize: 9 }} />}</Box>}
                          onClick={(e) => { e.stopPropagation(); handleSelect('network_devices', { region, zone, datacenter: dc }); }}
                        >
                          {dcDevices.map(dev => (
                            <TreeItem key={`dev-${dev.id}`} itemId={`dev-${dev.id}`}
                              label={<Box sx={{ display: 'flex', alignItems: 'center' }}><DeviceIcon fontSize="small" sx={{ mr: 0.5, color: ic.leaf, opacity: 0.7 }} /><Typography fontSize={12}>{dev.name}</Typography></Box>}
                              onClick={(e) => { e.stopPropagation(); handleSelect('device_detail', { region, zone, datacenter: dc, device: dev }); }}
                            />
                          ))}
                        </TreeItem>
                        {/* Storage */}
                        <TreeItem key={`dc-${dc.id}-storage`} itemId={`dc-${dc.id}-storage`}
                          label={<Box sx={{ display: 'flex', alignItems: 'center' }}><StorageIcon fontSize="small" sx={{ mr: 0.5, color: ic.leaf }} /><Typography fontSize={13}>Storage</Typography></Box>}
                          onClick={(e) => { e.stopPropagation(); handleSelect('storage', { region, zone, datacenter: dc }); }}
                        />
                        {/* Networks */}
                        <TreeItem key={`dc-${dc.id}-networks`} itemId={`dc-${dc.id}-networks`}
                          label={<Box sx={{ display: 'flex', alignItems: 'center' }}><NetworkIcon fontSize="small" sx={{ mr: 0.5, color: ic.leaf }} /><Typography fontSize={13}>Networks</Typography></Box>}
                          onClick={(e) => { e.stopPropagation(); handleSelect('networks', { region, zone, datacenter: dc }); }}
                        />
                      </TreeItem>
                    );
                  })}
                </TreeItem>
              ))}
            </TreeItem>
          ))}
        </SimpleTreeView>
      </Box>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null && contextActions.length > 0}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        {contextActions.map(a => (
          <MenuItem key={a.childType} onClick={() => handleContextAction(a.childType)} sx={{ fontSize: 13 }}>
            <ListItemIcon>{a.icon}</ListItemIcon>
            <ListItemText>{a.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

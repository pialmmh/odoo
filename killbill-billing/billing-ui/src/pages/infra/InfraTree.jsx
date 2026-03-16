import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, CircularProgress, IconButton, Tooltip, TextField,
  InputAdornment, Chip,
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
} from '@mui/icons-material';
import { getRegions, getAvailabilityZones, getDatacenters } from '../../services/infra';
import { useAppTheme } from '../../context/ThemeContext';

const TYPE_BADGE = { fontSize: 9, height: 16, ml: 0.5, fontWeight: 700, letterSpacing: 0.4 };

function TreeLabel({ icon, name, type, color }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', py: 0.2 }}>
      {icon}
      <Typography fontSize={13} sx={{ flexGrow: 1 }}>{name}</Typography>
      <Chip label={type} size="small"
        sx={{ ...TYPE_BADGE, bgcolor: color, color: '#fff' }} />
    </Box>
  );
}

export default function InfraTree({ onSelect }) {
  const [regions, setRegions] = useState([]);
  const [zones, setZones] = useState([]);
  const [datacenters, setDatacenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { brand } = useAppTheme();
  const ic = brand.infra; // infra colors

  const ENTITY_TYPES = [
    { key: 'computes', label: 'Computes', icon: <ComputeIcon fontSize="small" sx={{ mr: 0.5, color: ic.leaf }} /> },
    { key: 'network_devices', label: 'Network Devices', icon: <DeviceIcon fontSize="small" sx={{ mr: 0.5, color: ic.leaf }} /> },
    { key: 'storage', label: 'Storage', icon: <StorageIcon fontSize="small" sx={{ mr: 0.5, color: ic.leaf }} /> },
    { key: 'networks', label: 'Networks', icon: <NetworkIcon fontSize="small" sx={{ mr: 0.5, color: ic.leaf }} /> },
  ];

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const [r, z, d] = await Promise.all([
        getRegions(), getAvailabilityZones(), getDatacenters(),
      ]);
      setRegions(r);
      setZones(z);
      setDatacenters(d);
    } catch (e) {
      console.error('Failed to load infra tree', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  const handleSelect = (type, context) => {
    onSelect?.({ type, ...context });
  };

  const filterMatch = (name) => !search || name.toLowerCase().includes(search.toLowerCase());

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5, gap: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>
          Infrastructure
        </Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={loadTree}><RefreshIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Box>
      <TextField
        size="small" placeholder="Filter..."
        value={search} onChange={e => setSearch(e.target.value)}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
        }}
        sx={{ mx: 1, mb: 1 }}
      />
      <Box sx={{ flexGrow: 1, overflow: 'auto', px: 0.5 }}>
        <SimpleTreeView>
          {regions.filter(r => filterMatch(r.name)).map(region => (
            <TreeItem
              key={`r-${region.id}`}
              itemId={`r-${region.id}`}
              label={<TreeLabel icon={<RegionIcon fontSize="small" sx={{ mr: 0.5, color: ic.region }} />} name={region.name} type="Region" color={ic.region} />}
              onClick={() => handleSelect('region', { region })}
            >
              {zones.filter(z => z.region_id?.[0] === region.id && filterMatch(z.name)).map(zone => (
                <TreeItem
                  key={`z-${zone.id}`}
                  itemId={`z-${zone.id}`}
                  label={<TreeLabel icon={<ZoneIcon fontSize="small" sx={{ mr: 0.5, color: ic.zone }} />} name={zone.name} type="Zone" color={ic.zone} />}
                  onClick={() => handleSelect('zone', { region, zone })}
                >
                  {datacenters.filter(dc => dc.zone_id?.[0] === zone.id).map(dc => (
                    <TreeItem
                      key={`dc-${dc.id}`}
                      itemId={`dc-${dc.id}`}
                      label={<TreeLabel icon={<DcIcon fontSize="small" sx={{ mr: 0.5, color: ic.dc }} />} name={dc.name} type="DC" color={ic.dc} />}
                      onClick={() => handleSelect('datacenter', { region, zone, datacenter: dc })}
                    >
                      {ENTITY_TYPES.map(et => (
                        <TreeItem
                          key={`dc-${dc.id}-${et.key}`}
                          itemId={`dc-${dc.id}-${et.key}`}
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {et.icon}
                              <Typography fontSize={13}>{et.label}</Typography>
                            </Box>
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(et.key, { region, zone, datacenter: dc });
                          }}
                        />
                      ))}
                    </TreeItem>
                  ))}
                </TreeItem>
              ))}
            </TreeItem>
          ))}
        </SimpleTreeView>
      </Box>
    </Box>
  );
}

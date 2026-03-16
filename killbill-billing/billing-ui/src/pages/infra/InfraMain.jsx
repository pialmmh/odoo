import { useState, useCallback } from 'react';
import { Box, Paper } from '@mui/material';
import InfraTree from './InfraTree';
import InfraDetailPane from './InfraDetailPane';

const TREE_WIDTH = 280;

export default function InfraMain() {
  const [selection, setSelection] = useState(null);

  const handleSelect = useCallback((sel) => {
    // Only show detail pane for entity-type selections within a datacenter
    if (['computes', 'network_devices', 'storage', 'networks'].includes(sel.type) && sel.datacenter) {
      setSelection(sel);
    } else if (sel.type === 'datacenter') {
      // Default to network_devices when clicking a datacenter
      setSelection({ ...sel, type: 'network_devices' });
    }
  }, []);

  return (
    <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 120px)' }}>
      {/* Tree panel */}
      <Paper
        elevation={0}
        sx={{
          width: TREE_WIDTH,
          minWidth: TREE_WIDTH,
          borderRadius: 2,
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <InfraTree onSelect={handleSelect} />
      </Paper>

      {/* Detail panel */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <InfraDetailPane selection={selection} />
      </Box>
    </Box>
  );
}

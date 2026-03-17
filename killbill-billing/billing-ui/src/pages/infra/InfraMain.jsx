import { useState, useCallback } from 'react';
import { Box, Paper } from '@mui/material';
import InfraTree from './InfraTree';
import InfraDetailPane from './InfraDetailPane';

const TREE_WIDTH = 280;

export default function InfraMain() {
  const [selection, setSelection] = useState(null);

  const handleSelect = useCallback((sel) => {
    setSelection(sel);
  }, []);

  // Context action from tree right-click → open detail pane in "add" mode
  const handleContextAction = useCallback((action) => {
    // action: { action: 'add_zone', region, zone?, datacenter?, compute? }
    setSelection({ type: action.action, ...action });
  }, []);

  return (
    <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 120px)' }}>
      <Paper
        elevation={0}
        sx={{
          width: TREE_WIDTH, minWidth: TREE_WIDTH, borderRadius: 2,
          border: '1px solid #e5e7eb', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <InfraTree onSelect={handleSelect} onContextAction={handleContextAction} />
      </Paper>
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <InfraDetailPane selection={selection} onNavigate={handleSelect} />
      </Box>
    </Box>
  );
}

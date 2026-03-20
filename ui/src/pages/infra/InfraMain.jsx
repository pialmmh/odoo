import { useState, useCallback } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import InfraTree from './InfraTree';
import InfraDetailPane from './InfraDetailPane';
import { useTenant } from '../../context/TenantContext';

const TREE_WIDTH = 280;

export default function InfraMain() {
  const [selection, setSelection] = useState(null);
  const { activeTenant, partnerId } = useTenant();

  const handleSelect = useCallback((sel) => {
    setSelection(sel);
  }, []);

  const handleContextAction = useCallback((action) => {
    setSelection({ type: action.action, ...action });
  }, []);

  if (!activeTenant) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)', color: 'text.secondary' }}>
        <Typography>Select a tenant from the top bar to view infrastructure</Typography>
      </Box>
    );
  }

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
        <InfraTree onSelect={handleSelect} onContextAction={handleContextAction} partnerId={partnerId} />
      </Paper>
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <InfraDetailPane selection={selection} onNavigate={handleSelect} />
      </Box>
    </Box>
  );
}

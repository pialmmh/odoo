import { Box, Toolbar } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar, { DRAWER_WIDTH } from './Sidebar';
import TopBar from './TopBar';

export default function MainLayout() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f6fa' }}>
      <Sidebar />
      <TopBar />
      <Box component="main" sx={{ flexGrow: 1, p: 3, ml: 0 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}

import axios from 'axios';
import { getToken } from './keycloak';

// Dedicated client for the NMS API surface. Same JWT injection pattern as odoo.js.
const api = axios.create({
  baseURL: '/api/nms',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  let token = getToken();
  if (!token) {
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 500));
      token = getToken();
      if (token) break;
    }
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Galera ──────────────────────────────────────────────────────────────────

export async function listGaleraClusters() {
  const r = await api.get('/galera/clusters');
  return r.data;
}

export async function getGaleraStatus(clusterName) {
  const r = await api.get(`/galera/clusters/${encodeURIComponent(clusterName)}/status`);
  return r.data;
}

export async function getGaleraAlerts(clusterName) {
  const r = await api.get(`/galera/clusters/${encodeURIComponent(clusterName)}/alerts`);
  return r.data;
}

export async function getGaleraLogs(clusterName, tail = 200) {
  const r = await api.get(`/galera/clusters/${encodeURIComponent(clusterName)}/logs`, { params: { tail } });
  return r.data;
}

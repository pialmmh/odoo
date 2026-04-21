// Temporal monitoring — cluster/endpoint CRUD.
// v1: localStorage-backed so the UI is usable without the backend.
// When the Spring Boot endpoints land, swap the implementations of
// listClusters/getCluster/saveCluster/deleteCluster to call /api/nms/temporal/*.

const KEY = 'nms.temporal.clusters';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function nowIso() { return new Date().toISOString(); }

function uid() {
  return 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function listClusters() {
  return readAll();
}

export async function getCluster(id) {
  return readAll().find(c => c.id === id) || null;
}

export async function saveCluster(cluster) {
  const list = readAll();
  const ts = nowIso();
  if (cluster.id) {
    const i = list.findIndex(c => c.id === cluster.id);
    if (i >= 0) {
      list[i] = { ...list[i], ...cluster, updatedAt: ts };
    } else {
      list.push({ ...cluster, createdAt: ts, updatedAt: ts });
    }
  } else {
    list.push({ ...cluster, id: uid(), createdAt: ts, updatedAt: ts });
  }
  writeAll(list);
  return list[list.length - 1];
}

export async function deleteCluster(id) {
  writeAll(readAll().filter(c => c.id !== id));
}

export function emptyCluster() {
  return {
    id: null,
    name: '',
    tag: '',
    color: 'primary',       // one of: primary | success | warning | error | info
    webuiBaseUrl: '',
    notes: '',
    endpoints: [{ host: '', port: 7233, tls: false }],
  };
}

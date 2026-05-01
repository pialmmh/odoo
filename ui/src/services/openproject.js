/**
 * OpenProject HAL+JSON API client.
 *
 * Auth: Basic auth with "apikey" as username and the API token as password.
 * The token is read from VITE_OP_API_TOKEN; falls back to empty string
 * (all requests return 401) so the app doesn't hard-crash in environments
 * where OpenProject isn't running.
 *
 * lockVersion: every PATCH carries the lockVersion from the last GET/list.
 * A 409 is propagated unchanged — callers must show it, never retry silently.
 *
 * Principals: assignees and responsibles are principals (User|Group|Placeholder),
 * so we use /available_assignees, not /users.
 *
 * Custom fields: schema-driven; this file exposes getWorkPackageSchema() so
 * callers can discover custom fields rather than hard-coding names.
 */

import axios from 'axios';

const TOKEN = import.meta.env.VITE_OP_API_TOKEN || '';

const http = axios.create({
  baseURL: '/op-api/api/v3',
  headers: {
    'Content-Type': 'application/json',
    Authorization: TOKEN ? `Basic ${btoa(`apikey:${TOKEN}`)}` : '',
  },
});

// ── Projects ──────────────────────────────────────────────────────────────────

export async function listProjects({ pageSize = 50, offset = 1 } = {}) {
  const { data } = await http.get('/projects', { params: { pageSize, offset } });
  return {
    list: data._embedded?.elements || [],
    total: data.total ?? 0,
  };
}

// ── Work Packages ─────────────────────────────────────────────────────────────

/**
 * List work packages in a project.
 * @param {number|string} projectId  numeric or identifier string
 * @param {{ search, statusId, typeId, assigneeId, page, pageSize, sortBy }} params
 */
export async function listWorkPackages(projectId, {
  search = '',
  statusId = null,
  typeId = null,
  assigneeId = null,
  page = 1,
  pageSize = 25,
  sortBy = [['id', 'asc']],
} = {}) {
  const filters = [];

  if (search.trim()) {
    filters.push({ subjectOrId: { operator: '**', values: [search.trim()] } });
  }
  if (statusId) {
    filters.push({ status: { operator: '=', values: [String(statusId)] } });
  }
  if (typeId) {
    filters.push({ type: { operator: '=', values: [String(typeId)] } });
  }
  if (assigneeId) {
    filters.push({ assignee: { operator: '=', values: [String(assigneeId)] } });
  }

  const params = {
    pageSize,
    offset: page,
    sortBy: JSON.stringify(sortBy),
  };
  if (filters.length) {
    params.filters = JSON.stringify(filters);
  }

  const { data } = await http.get(`/projects/${projectId}/work_packages`, { params });
  return {
    list: (data._embedded?.elements || []).map(normalizeWP),
    total: data.total ?? 0,
  };
}

export async function getWorkPackage(id) {
  const { data } = await http.get(`/work_packages/${id}`);
  return normalizeWP(data);
}

/**
 * Get the form schema for creating/editing a work package.
 * The schema.availableStatuses and schema fields determine what the user can edit.
 */
export async function getWorkPackageForm(projectId, partial = {}) {
  const { data } = await http.post(`/projects/${projectId}/work_packages/form`, partial);
  return data;
}

/**
 * Create a work package via the form endpoint (writes through HAL).
 * @param {number|string} projectId
 * @param {{ subject, description, typeHref, statusHref, assigneeHref, dueDate, startDate }} payload
 */
export async function createWorkPackage(projectId, payload) {
  const body = buildHalPayload(payload);
  const { data } = await http.post(`/projects/${projectId}/work_packages`, body);
  return normalizeWP(data);
}

/**
 * Update a work package.
 * ALWAYS include lockVersion — 409 is propagated as-is.
 */
export async function updateWorkPackage(id, lockVersion, payload) {
  const body = { lockVersion, ...buildHalPayload(payload) };
  const { data } = await http.patch(`/work_packages/${id}`, body);
  return normalizeWP(data);
}

export async function deleteWorkPackage(id) {
  await http.delete(`/work_packages/${id}`);
}

// ── Activities (journal) ──────────────────────────────────────────────────────

export async function getActivities(workPackageId) {
  const { data } = await http.get(`/work_packages/${workPackageId}/activities`);
  return data._embedded?.elements || [];
}

export async function addComment(workPackageId, comment) {
  const { data } = await http.post(`/work_packages/${workPackageId}/activities`, {
    comment: { raw: comment },
  });
  return data;
}

// ── Statuses ──────────────────────────────────────────────────────────────────

export async function listStatuses() {
  const { data } = await http.get('/statuses');
  return data._embedded?.elements || [];
}

// ── Types ─────────────────────────────────────────────────────────────────────

export async function listTypes(projectId) {
  const { data } = await http.get(`/projects/${projectId}/types`);
  return data._embedded?.elements || [];
}

// ── Principals (assignees) ────────────────────────────────────────────────────

export async function listAvailableAssignees(projectId) {
  const { data } = await http.get(`/projects/${projectId}/available_assignees`);
  return data._embedded?.elements || [];
}

// ── Types (global, includes color) ────────────────────────────────────────────

export async function listAllTypes() {
  const { data } = await http.get('/types');
  return data._embedded?.elements || [];
}

// ── Relations ─────────────────────────────────────────────────────────────────

export async function listRelations(wpId) {
  const filter = JSON.stringify([{ involved: { operator: '=', values: [String(wpId)] } }]);
  const { data } = await http.get('/relations', { params: { filters: filter, pageSize: 50 } });
  return data._embedded?.elements || [];
}

// ── Children ──────────────────────────────────────────────────────────────────

export async function listChildren(wpId) {
  const filter = JSON.stringify([{ parent: { operator: '=', values: [String(wpId)] } }]);
  const { data } = await http.get('/work_packages', { params: { filters: filter, pageSize: 50 } });
  return (data._embedded?.elements || []).map(normalizeWP);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Flatten a HAL work package into a plain object the React components can use.
 * Always keep lockVersion so PATCH callers can round-trip it.
 */
function normalizeWP(wp) {
  const links = wp._links || {};
  return {
    id: wp.id,
    lockVersion: wp.lockVersion,
    subject: wp.subject || '',
    description: wp.description?.raw || '',
    startDate: wp.startDate || null,
    dueDate: wp.dueDate || null,
    estimatedTime: wp.estimatedTime || null,
    percentageDone: wp.percentageDone ?? null,
    createdAt: wp.createdAt || null,
    updatedAt: wp.updatedAt || null,

    // Links → flattened
    statusId: hrefId(links.status?.href),
    statusTitle: links.status?.title || null,
    statusColor: null, // enriched externally from /statuses

    typeId: hrefId(links.type?.href),
    typeTitle: links.type?.title || null,

    assigneeId: hrefId(links.assignee?.href),
    assigneeTitle: links.assignee?.title || null,

    responsibleId: hrefId(links.responsible?.href),
    responsibleTitle: links.responsible?.title || null,

    priorityId: hrefId(links.priority?.href),
    priorityTitle: links.priority?.title || null,

    versionId: hrefId(links.version?.href),
    versionTitle: links.version?.title || null,

    categoryId: hrefId(links.category?.href),
    categoryTitle: links.category?.title || null,

    projectId: hrefId(links.project?.href),
    projectTitle: links.project?.title || null,

    parentId: hrefId(links.parent?.href),
    parentTitle: links.parent?.title || null,

    // Raw links kept so callers can still do PATCH href routing
    _links: links,
  };
}

function hrefId(href) {
  if (!href) return null;
  const m = href.match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

function buildHalPayload({ subject, description, typeHref, statusHref, assigneeHref, priorityHref, dueDate, startDate }) {
  const body = {};
  if (subject !== undefined) body.subject = subject;
  if (description !== undefined) body.description = { format: 'markdown', raw: description };
  if (dueDate !== undefined) body.dueDate = dueDate || null;
  if (startDate !== undefined) body.startDate = startDate || null;

  const links = {};
  if (typeHref)     links.type     = { href: typeHref };
  if (statusHref)   links.status   = { href: statusHref };
  if (assigneeHref !== undefined) links.assignee = assigneeHref ? { href: assigneeHref } : { href: null };
  if (priorityHref) links.priority = { href: priorityHref };
  if (Object.keys(links).length) body._links = links;

  return body;
}

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = { ...options.headers };
  if (!isFormData && options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function requestBlob(endpoint) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Unable to load file');
  }
  return res.blob();
}

export const api = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),
  getPermissions: () => request('/auth/permissions'),
  getLanStatus: () => request('/auth/lan-status'),

  getDashboardStats: () => request('/dashboard/stats'),
  getMonthlyPermits: () => request('/dashboard/monthly-permits'),
  getStatusDistribution: () => request('/dashboard/status-distribution'),
  getWeeklyTransactions: () => request('/dashboard/weekly-transactions'),
  getRecentActivities: () => request('/dashboard/recent-activities'),

  getClients: (params) => request(`/clients?${new URLSearchParams(params)}`),
  getMyClient: () => request('/clients/me'),
  getClient: (id) => request(`/clients/${id}`),
  createClient: (data) => request('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id, data) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),

  getPermits: (params) => request(`/permits?${new URLSearchParams(params)}`),
  getPermit: (id) => request(`/permits/${id}`),
  createPermit: (data) => request('/permits', { method: 'POST', body: JSON.stringify(data) }),
  updatePermit: (id, data) => request(`/permits/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateRequirement: (permitId, reqId, status) =>
    request(`/permits/${permitId}/requirements/${reqId}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  reviewPermit: (id) => request(`/permits/${id}/review`, { method: 'POST' }),
  forwardPermit: (id) => request(`/permits/${id}/forward`, { method: 'POST' }),
  approvePermit: (id, remarks = '') =>
    request(`/permits/${id}/approve`, { method: 'POST', body: JSON.stringify({ remarks }) }),
  rejectPermit: (id, remarks) =>
    request(`/permits/${id}/reject`, { method: 'POST', body: JSON.stringify({ remarks }) }),
  releasePermit: (id) => request(`/permits/${id}/release`, { method: 'POST' }),

  getPermitDocuments: (permitId) => request(`/documents/permit/${permitId}`),
  uploadDocument: (permitId, formData) =>
    request(`/documents/permit/${permitId}`, { method: 'POST', body: formData }),
  replaceDocument: (documentId, formData) =>
    request(`/documents/${documentId}/replace`, { method: 'POST', body: formData }),
  updateDocumentStatus: (documentId, status, remarks = '') =>
    request(`/documents/${documentId}/status`, { method: 'PUT', body: JSON.stringify({ status, remarks }) }),
  getDocumentBlob: (documentId, download = false) =>
    requestBlob(`/documents/${documentId}/file${download ? '?download=1' : ''}`),
  getDocumentRecords: (params) => request(`/documents/records?${new URLSearchParams(params)}`),

  getPayments: (params) => request(`/payments?${new URLSearchParams(params)}`),
  getPendingPayments: () => request('/payments/pending'),
  getPermitPayments: (permitId) => request(`/payments/permit/${permitId}`),
  createPayment: (data) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),
  getReceipt: (id) => request(`/payments/${id}/receipt`),

  getUsers: (params) => request(`/users?${new URLSearchParams(params)}`),
  getStaff: () => request('/users/staff'),
  createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  getCollectionReport: (params) => request(`/reports/collection?${new URLSearchParams(params)}`),
  getPermitReport: (params) => request(`/reports/permits?${new URLSearchParams(params)}`),

  getAuditLogs: (params) => request(`/audit?${new URLSearchParams(params)}`),

  getNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PUT' }),

  getOfficeInfo: () => request('/settings/office'),
  updateOfficeInfo: (data) => request('/settings/office', { method: 'PUT', body: JSON.stringify(data) }),
  getSystemSettings: () => request('/settings/system'),
  updateSystemSettings: (data) => request('/settings/system', { method: 'PUT', body: JSON.stringify(data) }),
  getRbac: () => request('/settings/rbac'),
  updateRbac: (permissions) => request('/settings/rbac', { method: 'PUT', body: JSON.stringify({ permissions }) }),
  getBackupInfo: () => request('/settings/backup/info'),
  createBackup: () => request('/settings/backup', { method: 'POST' }),
  restoreBackup: (filename) => request('/settings/restore', { method: 'POST', body: JSON.stringify({ filename }) }),
  getPermitPreview: (id) => request(`/settings/permit/${id}/preview`),
};

const BASE_URL = 'http://localhost:4000/v1'; // change to your API

async function request(path, {method = 'GET', body, token} = {}) {
  const headers = {'Content-Type': 'application/json'};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', {method: 'POST', body: {email, password}}),
  me: (token) => request('/auth/me', {token}),

  // Masters
  divisions: (token) => request('/ref/divisions', {token}),
  ranges: (divisionId, token) => request(`/ref/ranges?divisionId=${divisionId}`, {token}),
  blocks: (rangeId, token) => request(`/ref/blocks?rangeId=${rangeId}`, {token}),
  beats: (blockId, token) => request(`/ref/beats?blockId=${blockId}`, {token}),
  species: (q, token) => request(`/ref/species?query=${encodeURIComponent(q||'')}`, {token}),
  roads: (divisionId, q, token) => request(`/ref/roads?divisionId=${divisionId}&query=${encodeURIComponent(q||'')}`, {token}),

  // Registers
  createRegister: (payload, token) => request('/registers', {method: 'POST', body: payload, token}),
  listRegisters: (query, token) => request(`/registers${query||''}`, {token}),
  getRegister: (id, token) => request(`/registers/${id}`, {token}),

  // Entries
  createEntry: (registerId, payload, token) => request(`/registers/${registerId}/entries`, {method:'POST', body: payload, token}),
  listEntries: (registerId, query, token) => request(`/registers/${registerId}/entries${query||''}`, {token}),
  updateEntry: (entryId, payload, token) => request(`/entries/${entryId}`, {method:'PATCH', body: payload, token}),

  // Workflow
  verifyEntry: (entryId, body, token) => request(`/entries/${entryId}/verify`, {method:'POST', body, token}),
  disposeEntry: (entryId, body, token) => request(`/entries/${entryId}/dispose`, {method:'POST', body, token}),
  superdariEntry: (entryId, body, token) => request(`/entries/${entryId}/superdari`, {method:'POST', body, token}),

  // Stats
  summary: (query, token) => request(`/stats/summary${query||''}`, {token}),
};

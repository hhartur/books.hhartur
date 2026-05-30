/**
 * books.hhartur — API Client
 * Gerencia tokens JWT + refresh automático
 */

const API_BASE = '/api';

// ─── Token storage ────────────────────────────────────────────
const Auth = {
  getAccessToken:  () => sessionStorage.getItem('access_token'),
  getRefreshToken: () => localStorage.getItem('refresh_token'),
  getUser:         () => JSON.parse(sessionStorage.getItem('user') || 'null'),

  setTokens(accessToken, refreshToken, user) {
    sessionStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    if (user) sessionStorage.setItem('user', JSON.stringify(user));
  },

  clear() {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('user');
    localStorage.removeItem('refresh_token');
  },

  isLoggedIn() {
    return !!this.getRefreshToken();
  },

  hasRole(...roles) {
    const user = this.getUser();
    return user && roles.includes(user.role);
  },
};

// ─── Fetch wrapper com refresh automático ────────────────────
let isRefreshing = false;
let refreshQueue = [];

async function apiFetch(path, options = {}) {
  const token = Auth.getAccessToken();
  const headers = { ...(options.headers || {}) };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Token expirado → tenta refresh
  if (res.status === 401) {
    const data = await res.json().catch(() => ({}));
    if (data.code === 'TOKEN_EXPIRED') {
      return refreshAndRetry(path, options);
    }
    // Refresh inválido → logout
    Auth.clear();
    window.location.href = '/';
    return;
  }

  return res;
}

async function refreshAndRetry(path, options) {
  if (isRefreshing) {
    return new Promise((resolve) => refreshQueue.push(resolve))
      .then(() => apiFetch(path, options));
  }

  isRefreshing = true;
  try {
    const refreshToken = Auth.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) throw new Error('Refresh failed');

    const { accessToken, refreshToken: newRefreshToken } = await res.json();
    Auth.setTokens(accessToken, newRefreshToken, Auth.getUser());
    refreshQueue.forEach(resolve => resolve());
    refreshQueue = [];

    return apiFetch(path, options);
  } catch {
    Auth.clear();
    window.location.href = '/';
  } finally {
    isRefreshing = false;
  }
}

// ─── API methods ──────────────────────────────────────────────
const api = {
  // Auth
  async login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return res.json();
  },

  async logout() {
    const refreshToken = Auth.getRefreshToken();
    await apiFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    Auth.clear();
    window.location.href = '/';
  },

  // Books
  async getBooks(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await apiFetch(`/books${qs ? '?' + qs : ''}`);
    return res.json();
  },

  async getBook(id) {
    const res = await apiFetch(`/books/${id}`);
    return res.json();
  },

  async getSecureUrl(id) {
    const res = await apiFetch(`/books/${id}/secure-url`);
    return res.json();
  },

  async createBook(formData) {
    const res = await apiFetch('/books', { method: 'POST', body: formData });
    return res.json();
  },

  async updateBook(id, formData) {
    const res = await apiFetch(`/books/${id}`, { method: 'PUT', body: formData });
    return res.json();
  },

  async deleteBook(id) {
    const res = await apiFetch(`/books/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Users
  async getUsers() {
    const res = await apiFetch('/users');
    return res.json();
  },

  async createUser(data) {
    const res = await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateUser(id, data) {
    const res = await apiFetch(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteUser(id) {
    const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
    return res.json();
  },
};

// ─── Guard: redireciona se não autenticado ────────────────────
function requireAuth() {
  if (!Auth.isLoggedIn()) {
    window.location.href = '/';
    return false;
  }
  return true;
}

function requireRole(...roles) {
  if (!requireAuth()) return false;
  if (!Auth.hasRole(...roles)) {
    window.location.href = '/books.html';
    return false;
  }
  return true;
}

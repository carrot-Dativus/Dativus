const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(newToken) {
  refreshSubscribers.forEach(cb => cb(newToken));
  refreshSubscribers = [];
}

async function tryRefreshToken() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('refresh_token 없음');

  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
    throw new Error('토큰 갱신 실패');
  }

  const data = await response.json();
  localStorage.setItem('token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token);
  return data.access_token;
}

async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await tryRefreshToken();
        isRefreshing = false;
        onRefreshed(newToken);
        // 원래 요청 재시도
        response = await fetch(url, {
          ...options,
          headers: { ...headers, Authorization: `Bearer ${newToken}` },
        });
      } catch {
        isRefreshing = false;
        return response;
      }
    } else {
      // 이미 갱신 중이면 대기 후 재시도
      await new Promise(resolve => refreshSubscribers.push(resolve));
      const newToken = localStorage.getItem('token');
      response = await fetch(url, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${newToken}` },
      });
    }
  }

  return response;
}

export const apiClient = {
  get: (endpoint) =>
    fetchWithAuth(`${API_BASE_URL}${endpoint}`),

  post: (endpoint, data) =>
    fetchWithAuth(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  put: (endpoint, data) =>
    fetchWithAuth(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (endpoint) =>
    fetchWithAuth(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
    }),

  logout: async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }
    localStorage.clear();
    window.location.href = '/login';
  },
};

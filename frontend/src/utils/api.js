const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

// ─── Token helpers ────────────────────────────────────────────────────────────
export const getToken = () => localStorage.getItem('access_token')
export const getRefreshToken = () => localStorage.getItem('refresh_token')
export const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
}
export const setTokens = (access, refresh) => {
  localStorage.setItem('access_token', access)
  if (refresh) localStorage.setItem('refresh_token', refresh)
}
export const setUser = (user) => localStorage.setItem('user', JSON.stringify(user))
export const clearAuth = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user')
}

// ─── Core fetch ───────────────────────────────────────────────────────────────
async function request(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  // Try refresh on 401
  if (res.status === 401 && getRefreshToken()) {
    const refreshRes = await fetch(`${BASE_URL}/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: getRefreshToken() }),
    })
    if (refreshRes.ok) {
      const data = await refreshRes.json()
      setTokens(data.access, data.refresh)
      headers['Authorization'] = `Bearer ${data.access}`
      res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
    } else {
      clearAuth()
      window.location.href = '/login'
      return
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || err.error || JSON.stringify(err))
  }

  if (res.status === 204) return null
  return res.json()
}

const get = (path, params) => {
  const url = params ? `${path}?${new URLSearchParams(params)}` : path
  return request(url)
}
const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) })
const put = (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) })
const patch = (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) })
const del = (path) => request(path, { method: 'DELETE' })

// ─── Multipart (file upload) ──────────────────────────────────────────────────
async function upload(path, formData, method = 'POST') {
  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: formData })
  if (!res.ok) throw new Error('Upload failed')
  return res.json()
}

// ─── API Endpoints ────────────────────────────────────────────────────────────
export const api = {
  // Auth
  login: (data) => post('/auth/login/', data),
  logout: (refresh) => post('/auth/logout/', { refresh }),
  me: () => get('/auth/me/'),
  updateMe: (data) => patch('/auth/me/', data),

  // Dashboard
  dashboard: () => get('/dashboard/'),

  // Reports
  reports: (params) => get('/reports/', params),

  // Users
  users: {
    list: (params) => get('/users/', params),
    get: (id) => get(`/users/${id}/`),
    create: (data) => post('/users/', data),
    update: (id, data) => patch(`/users/${id}/`, data),
    delete: (id) => del(`/users/${id}/`),
    toggleActive: (id) => post(`/users/${id}/toggle_active/`),
    changePassword: (id, password) => post(`/users/${id}/change_password/`, { password }),
  },

  // Suppliers
  suppliers: {
    list: (params) => get('/suppliers/', params),
    get: (slug) => get(`/suppliers/${slug}/`),
    create: (data) => post('/suppliers/', data),
    update: (slug, data) => patch(`/suppliers/${slug}/`, data),
    delete: (slug) => del(`/suppliers/${slug}/`),
  },

  // Categories
  categories: {
    list: (params) => get('/categories/', params),
    create: (data) => post('/categories/', data),
    update: (slug, data) => patch(`/categories/${slug}/`, data),
    delete: (slug) => del(`/categories/${slug}/`),
  },

  // Products
  products: {
    list: (params) => get('/products/', params),
    get: (slug) => get(`/products/${slug}/`),
    create: (data) => post('/products/', data),
    update: (slug, data) => patch(`/products/${slug}/`, data),
    delete: (slug) => del(`/products/${slug}/`),
    lowStock: () => get('/products/low_stock/'),
    expiringSoon: () => get('/products/expiring_soon/'),
    searchPOS: (q) => get('/products/search_pos/', { q }),
  },

  // Customers
  customers: {
    list: (params) => get('/customers/', params),
    get: (slug) => get(`/customers/${slug}/`),
    create: (data) => post('/customers/', data),
    update: (slug, data) => patch(`/customers/${slug}/`, data),
    search: (phone) => get('/customers/', { search: phone }),
  },

  // Sales
  sales: {
    list: (params) => get('/sales/', params),
    get: (slug) => get(`/sales/${slug}/`),
    create: (data) => post('/sales/', data),
    receipt: (slug) => get(`/sales/${slug}/receipt/`),
    refund: (slug) => post(`/sales/${slug}/refund/`),
  },

  // Stock Adjustments
  stock: {
    list: (params) => get('/stock-adjustments/', params),
    adjust: (data) => post('/stock-adjustments/', data),
  },

  // M-Pesa
  mpesa: {
    stkPush: (phone, amount) => post('/mpesa/stk-push/', { phone, amount }),
  },
}

// ─── Formatting helpers ───────────────────────────────────────────────────────
export const fmt = {
  currency: (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`,
  date: (s) => new Date(s).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }),
  datetime: (s) => new Date(s).toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  percent: (n) => `${Number(n || 0).toFixed(1)}%`,
}
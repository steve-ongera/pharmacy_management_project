import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setTokens, setUser } from '../utils/api'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const data = await api.login(form)
      setTokens(data.access, data.refresh)
      setUser(data.user)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="icon">
            <i className="bi bi-capsule-pill" />
          </div>
          <div>
            <div className="name">PharmaTrack</div>
            <div className="tagline">Pharmacy Management System</div>
          </div>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: 'var(--gray-900)' }}>
          Sign in to your account
        </h2>
        <p style={{ color: 'var(--gray-400)', fontSize: 13, marginBottom: 28 }}>
          Welcome back — enter your credentials below
        </p>

        {error && (
          <div className="alert alert-danger">
            <i className="bi bi-exclamation-circle-fill" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="input-group">
              <i className="bi bi-person input-prefix" />
              <input
                className="form-control"
                placeholder="your.username"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                required autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <div className="input-group">
                <i className="bi bi-lock input-prefix" />
                <input
                  className="form-control"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                  style={{ paddingRight: 40 }}
                />
              </div>
              <button type="button"
                onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}>
                <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'}`} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? (
              <><div className="spinner" style={{ width: 18, height: 18 }} /> Signing in...</>
            ) : (
              <><i className="bi bi-shield-lock" /> Sign In</>
            )}
          </button>
        </form>

        <div style={{ marginTop: 32, padding: 16, background: 'var(--gray-50)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--gray-500)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Demo Credentials:</div>
          <div>Username: <strong>admin</strong> · Password: <strong>admin123</strong></div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--gray-400)' }}>
          🇰🇪 Built for Kenyan Pharmacies
        </div>
      </div>
    </div>
  )
}
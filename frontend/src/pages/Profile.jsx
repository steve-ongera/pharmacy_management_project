import { useState, useEffect } from 'react'
import { api, getUser, setUser } from '../utils/api'

export default function Profile() {
  const currentUser = getUser()
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', username: ''
  })
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pwMessage, setPwMessage] = useState('')
  const [pwError, setPwError] = useState('')

  useEffect(() => {
    api.me().then(u => {
      setForm({
        first_name: u.first_name || '',
        last_name: u.last_name || '',
        email: u.email || '',
        phone: u.phone || '',
        username: u.username || '',
      })
    })
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setLoading(true); setMessage(''); setError('')
    try {
      const updated = await api.updateMe(form)
      setUser(updated)
      setMessage('Profile updated successfully.')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handlePassword = async () => {
    setPwError(''); setPwMessage('')
    if (passwordForm.password.length < 6) { setPwError('Password must be at least 6 characters.'); return }
    if (passwordForm.password !== passwordForm.confirm) { setPwError('Passwords do not match.'); return }
    setPwLoading(true)
    try {
      await api.users.changePassword(currentUser?.id, passwordForm.password)
      setPwMessage('Password changed successfully.')
      setPasswordForm({ password: '', confirm: '' })
    } catch (e) { setPwError(e.message) }
    finally { setPwLoading(false) }
  }

  const roleColor = { owner: 'var(--primary)', pharmacist: 'var(--success)', cashier: 'var(--warning)' }
  const role = currentUser?.role || 'cashier'
  const initials = ((form.first_name?.[0] || '') + (form.last_name?.[0] || '')) || form.username?.[0]?.toUpperCase() || '?'

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1>My Profile</h1>
          <p>Manage your account details and password</p>
        </div>
      </div>

      {/* Avatar & Identity */}
      <div className="card mb-4">
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: `linear-gradient(135deg, var(--primary), var(--primary-dark))`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 700, color: '#fff', flexShrink: 0
          }}>
            {initials}
          </div>
          <div>
            <h3 style={{ margin: 0, fontWeight: 700 }}>{form.first_name} {form.last_name || form.username}</h3>
            <div style={{ marginTop: 4 }}>
              <span className="badge" style={{ background: roleColor[role] + '20', color: roleColor[role], border: `1px solid ${roleColor[role]}40`, textTransform: 'capitalize' }}>
                <i className="bi bi-shield-check" style={{ marginRight: 4 }} />{role}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 6 }}>
              <i className="bi bi-person" style={{ marginRight: 4 }} />{form.username}
            </div>
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="card mb-4">
        <div className="card-header">
          <h4 style={{ margin: 0 }}><i className="bi bi-person-lines-fill" style={{ marginRight: 8 }} />Personal Information</h4>
        </div>
        <div className="card-body">
          {message && <div className="alert alert-success">{message}</div>}
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input className="form-control" value={form.first_name} onChange={e => set('first_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input className="form-control" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-control" value={form.username} onChange={e => set('username', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-control" placeholder="e.g. 0712345678" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Email Address</label>
              <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? 'Saving…' : <><i className="bi bi-check-lg" style={{ marginRight: 6 }} />Save Changes</>}
            </button>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="card-header">
          <h4 style={{ margin: 0 }}><i className="bi bi-lock" style={{ marginRight: 8 }} />Change Password</h4>
        </div>
        <div className="card-body">
          {pwMessage && <div className="alert alert-success">{pwMessage}</div>}
          {pwError && <div className="alert alert-danger">{pwError}</div>}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input className="form-control" type="password" placeholder="Min. 6 characters"
                value={passwordForm.password} onChange={e => setPasswordForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input className="form-control" type="password" placeholder="Repeat new password"
                value={passwordForm.confirm} onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button className="btn btn-outline" onClick={handlePassword} disabled={pwLoading}>
              {pwLoading ? 'Updating…' : <><i className="bi bi-lock-fill" style={{ marginRight: 6 }} />Update Password</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
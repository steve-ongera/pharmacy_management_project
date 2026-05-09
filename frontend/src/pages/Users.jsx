import { useState, useEffect } from 'react'
import { api, fmt, getUser } from '../utils/api'

const emptyForm = {
  first_name: '', last_name: '', username: '', email: '',
  phone: '', role: 'cashier', password: '', is_active: true
}

function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState(user ? { ...user, password: '' } : emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.username) { setError('Username is required'); return }
    if (!user && !form.password) { setError('Password is required for new users'); return }
    if (!user && form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const payload = { ...form }
      if (user && !payload.password) delete payload.password
      if (user) await api.users.update(user.id, payload)
      else await api.users.create(payload)
      onSave()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>{user ? 'Edit User' : 'Add New User'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
        <div className="modal-body">
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
              <label className="form-label">Username *</label>
              <input className="form-control" value={form.username} onChange={e => set('username', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-control" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="owner">Owner</option>
                <option value="pharmacist">Pharmacist</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-control" placeholder="0712 345 678" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">{user ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
              <input className="form-control" type="password" placeholder="Min. 6 characters" value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                <span className="form-label" style={{ margin: 0 }}>Active Account</span>
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving…' : user ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  )
}

const ROLE_COLORS = {
  owner: { bg: 'var(--primary)', label: 'Owner' },
  pharmacist: { bg: 'var(--success)', label: 'Pharmacist' },
  cashier: { bg: 'var(--warning)', label: 'Cashier' },
}

export default function Users() {
  const currentUser = getUser()
  const isOwner = currentUser?.role === 'owner'

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [pwModal, setPwModal] = useState(null)
  const [newPw, setNewPw] = useState('')
  const [pwError, setPwError] = useState('')

  const loadAll = () => {
    setLoading(true)
    api.users.list(search ? { search } : {})
      .then(data => setUsers(data.results || data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [search])

  const handleToggleActive = async (user) => {
    try {
      await api.users.toggleActive(user.id)
      loadAll()
    } catch (e) { alert(e.message) }
  }

  const handleDelete = async () => {
    try {
      await api.users.delete(deleteConfirm.id)
      setDeleteConfirm(null)
      loadAll()
    } catch (e) { alert(e.message) }
  }

  const handleResetPw = async () => {
    setPwError('')
    if (newPw.length < 6) { setPwError('Password must be at least 6 characters'); return }
    try {
      await api.users.changePassword(pwModal.id, newPw)
      setPwModal(null); setNewPw('')
    } catch (e) { setPwError(e.message) }
  }

  const initials = u => ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')) || u.username?.[0]?.toUpperCase() || '?'

  if (!isOwner) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <i className="bi bi-lock" style={{ fontSize: 48, color: 'var(--gray-300)' }} />
        <h3 style={{ marginTop: 16, color: 'var(--gray-400)' }}>Access Restricted</h3>
        <p style={{ color: 'var(--gray-300)' }}>Only the pharmacy owner can manage users.</p>
      </div>
    )
  }

  const roleCount = role => users.filter(u => u.role === role).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Staff & Users</h1>
          <p>Manage pharmacy staff accounts and access</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <i className="bi bi-person-plus" /> Add User
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Staff', value: users.length, icon: 'bi-people', color: 'var(--primary)' },
          { label: 'Owners', value: roleCount('owner'), icon: 'bi-person-badge', color: 'var(--primary)' },
          { label: 'Pharmacists', value: roleCount('pharmacist'), icon: 'bi-capsule', color: 'var(--success)' },
          { label: 'Cashiers', value: roleCount('cashier'), icon: 'bi-cash-register', color: 'var(--warning)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + '15', color: s.color }}>
              <i className={`bi ${s.icon}`} />
            </div>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="search-bar mb-4" style={{ maxWidth: 400 }}>
        <i className="bi bi-search" />
        <input className="form-control" placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {loading ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60 }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : users.map(u => {
          const role = ROLE_COLORS[u.role] || ROLE_COLORS.cashier
          const isMe = u.id === currentUser?.id
          return (
            <div key={u.id} className="card" style={{ opacity: u.is_active ? 1 : 0.65 }}>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                    background: `linear-gradient(135deg, ${role.bg}, ${role.bg}99)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 700, color: '#fff'
                  }}>
                    {initials(u)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {u.full_name || u.username}
                      {isMe && <span style={{ fontSize: 11, marginLeft: 6, background: 'var(--primary)', color: '#fff', borderRadius: 4, padding: '1px 6px' }}>You</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>@{u.username}</div>
                    <div style={{ marginTop: 6 }}>
                      <span className="badge" style={{ background: role.bg + '20', color: role.bg, border: `1px solid ${role.bg}40`, fontSize: 11 }}>
                        {role.label}
                      </span>
                      {!u.is_active && <span className="badge badge-gray" style={{ marginLeft: 4, fontSize: 11 }}>Inactive</span>}
                    </div>
                    {u.phone && <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}><i className="bi bi-telephone" style={{ marginRight: 4 }} />{u.phone}</div>}
                    {u.email && <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}><i className="bi bi-envelope" style={{ marginRight: 4 }} />{u.email}</div>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => setEditing(u)}>
                    <i className="bi bi-pencil" style={{ marginRight: 4 }} />Edit
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => { setPwModal(u); setNewPw(''); setPwError('') }} title="Reset password">
                    <i className="bi bi-lock" />
                  </button>
                  {!isMe && (
                    <>
                      <button className="btn btn-sm"
                        style={{ background: u.is_active ? 'var(--warning-light)' : 'var(--success-light)', color: u.is_active ? 'var(--warning)' : 'var(--success)', border: 'none' }}
                        onClick={() => handleToggleActive(u)} title={u.is_active ? 'Deactivate' : 'Activate'}>
                        <i className={`bi bi-${u.is_active ? 'pause-circle' : 'play-circle'}`} />
                      </button>
                      <button className="btn btn-sm"
                        style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}
                        onClick={() => setDeleteConfirm(u)} title="Delete">
                        <i className="bi bi-trash3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {(showAdd || editing) && (
        <UserModal
          user={editing}
          onClose={() => { setShowAdd(false); setEditing(null) }}
          onSave={() => { setShowAdd(false); setEditing(null); loadAll() }}
        />
      )}

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header"><h3>Delete User</h3></div>
            <div className="modal-body">
              <p>Delete <strong>{deleteConfirm.full_name || deleteConfirm.username}</strong>? This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {pwModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Reset Password</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setPwModal(null)}><i className="bi bi-x-lg" /></button>
            </div>
            <div className="modal-body">
              {pwError && <div className="alert alert-danger">{pwError}</div>}
              <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 12 }}>
                Set new password for <strong>{pwModal.full_name || pwModal.username}</strong>
              </p>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-control" type="password" placeholder="Min. 6 characters" value={newPw} onChange={e => setNewPw(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setPwModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleResetPw}>Set Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
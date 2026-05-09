import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, clearAuth, getUser } from '../utils/api'

export default function Navbar({ title }) {
  const navigate = useNavigate()
  const user = getUser()
  const [showMenu, setShowMenu] = useState(false)

  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem('refresh_token')
      await api.logout(refresh)
    } catch {}
    clearAuth()
    navigate('/login')
  }

  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-actions">
        {/* Notifications */}
        <button className="btn btn-ghost btn-sm" style={{ position: 'relative' }}>
          <i className="bi bi-bell" style={{ fontSize: 18 }} />
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 7, height: 7, background: 'var(--danger)',
            borderRadius: '50%', border: '1.5px solid white'
          }} />
        </button>

        {/* User menu */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowMenu(!showMenu)}
            style={{ gap: 8 }}
          >
            <div style={{
              width: 32, height: 32, background: 'var(--primary)',
              borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13
            }}>
              {user?.first_name?.[0] || user?.username?.[0] || 'U'}
            </div>
            <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)' }}>
                {user?.first_name || user?.username}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'capitalize' }}>
                {user?.role}
              </div>
            </div>
            <i className="bi bi-chevron-down" style={{ fontSize: 12 }} />
          </button>

          {showMenu && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onClick={() => setShowMenu(false)}
              />
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 8,
                background: 'white', border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
                minWidth: 180, zIndex: 100, overflow: 'hidden'
              }}>
                <button className="btn btn-ghost w-full" style={{ justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px' }}
                  onClick={() => { navigate('/profile'); setShowMenu(false) }}>
                  <i className="bi bi-person" /> My Profile
                </button>
                <button className="btn btn-ghost w-full" style={{ justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px' }}
                  onClick={() => { navigate('/settings'); setShowMenu(false) }}>
                  <i className="bi bi-gear" /> Settings
                </button>
                <hr style={{ border: 'none', borderTop: '1px solid var(--gray-100)', margin: 0 }} />
                <button className="btn btn-ghost w-full" style={{ justifyContent: 'flex-start', borderRadius: 0, padding: '10px 16px', color: 'var(--danger)' }}
                  onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right" /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
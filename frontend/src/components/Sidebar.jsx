import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { getUser } from '../utils/api'

const navItems = [
  { section: 'Main' },
  { path: '/dashboard', icon: 'bi-speedometer2', label: 'Dashboard' },
  { path: '/pos',       icon: 'bi-cart3',         label: 'Point of Sale' },
  { section: 'Inventory' },
  { path: '/inventory', icon: 'bi-boxes',          label: 'Inventory' },
  { path: '/products',  icon: 'bi-capsule',        label: 'Products' },
  { path: '/suppliers', icon: 'bi-truck',          label: 'Suppliers' },
  { section: 'Business' },
  { path: '/sales',     icon: 'bi-receipt',        label: 'Sales' },          // ← new
  { path: '/reports',   icon: 'bi-bar-chart-line', label: 'Reports' },
  { path: '/users',     icon: 'bi-people',         label: 'Users', roles: ['owner'] },
  { section: 'Account' },
  { path: '/profile',   icon: 'bi-person-circle',  label: 'Profile' },
  { path: '/settings',  icon: 'bi-gear',           label: 'Settings' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const user = getUser()

  const filteredItems = navItems.filter(item => {
    if (item.section || !item.roles) return true
    return item.roles.includes(user?.role)
  })

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <i className="bi bi-capsule-pill" />
        </div>
        <span className="logo-text">PharmaTrack</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {filteredItems.map((item, i) => {
          if (item.section) {
            return (
              <div key={i} className="nav-section-label" style={{ marginTop: i === 0 ? 0 : 12 }}>
                {item.section}
              </div>
            )
          }
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <i className={`bi ${item.icon}`} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Collapse button */}
      <div className="sidebar-footer">
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          <i className={`bi ${collapsed ? 'bi-layout-sidebar-reverse' : 'bi-layout-sidebar'}`} />
          <span>{collapsed ? '' : 'Collapse'}</span>
        </button>
      </div>
    </aside>
  )
}
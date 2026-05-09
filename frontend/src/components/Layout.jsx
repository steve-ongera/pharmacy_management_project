import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/pos': 'Point of Sale',
  '/inventory': 'Inventory',
  '/products': 'Products',
  '/suppliers': 'Suppliers',
  '/reports': 'Reports',
  '/users': 'User Management',
  '/profile': 'My Profile',
  '/settings': 'Settings',
}

export default function Layout() {
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'PharmaTrack'

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Navbar title={title} />
        <div className="page-body">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
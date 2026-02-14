import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../contexts/AuthContext'
import { supabase } from '../../libs/supabase'
import {
  LayoutDashboard, Package, ShoppingCart, Users, FileText,
  TrendingUp, Settings, LogOut, Menu, X, Warehouse, FileBox, Truck
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Sidebar() {
  const { user, profile } = useAuthContext()
  const navigate = useNavigate()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
    toast.success('Logged out successfully')
  }

  const closeMobileSidebar = () => {
    setIsMobileOpen(false)
  }

  // ═══════════════════════════════════════════════════════════
  // NAVIGATION - Matching your exact page files
  // ═══════════════════════════════════════════════════════════
  const navItems = [
    { 
      to: '/dashboard', 
      icon: LayoutDashboard, 
      label: 'Dashboard', 
      roles: ['owner', 'admin', 'accountant', 'cashier'] 
    },
    { 
      to: '/pos', 
      icon: ShoppingCart, 
      label: 'POS', 
      roles: ['owner', 'admin', 'cashier'] 
    },
    { 
      to: '/inventory', 
      icon: Warehouse, 
      label: 'Inventory', 
      roles: ['owner', 'admin', 'accountant'] 
    },
    { 
      to: '/customers', 
      icon: Users, 
      label: 'Customers', 
      roles: ['owner', 'admin', 'cashier'] 
    },
    { 
      to: '/suppliers', 
      icon: Truck, 
      label: 'Suppliers', 
      roles: ['owner', 'admin'] 
    },
    { 
      to: '/purchase-orders', 
      icon: FileBox, 
      label: 'Purchase Orders', 
      roles: ['owner', 'admin'] 
    },
    { 
      to: '/users', 
      icon: Users, 
      label: 'Users', 
      roles: ['owner', 'admin'] 
    },
    { 
      to: '/reports', 
      icon: FileText, 
      label: 'Reports', 
      roles: ['owner', 'admin', 'accountant'] 
    },
    { 
      to: '/my-sales', 
      icon: TrendingUp, 
      label: 'My Sales', 
      roles: ['cashier'] 
    },
    { 
      to: '/settings', 
      icon: Settings, 
      label: 'Settings', 
      roles: ['owner', 'admin'] 
    },
  ]

  const userRole = profile?.role || 'cashier'
  const filteredNavItems = navItems.filter(item => item.roles.includes(userRole))

  return (
    <>
      {/* Mobile Menu Button - Only visible on mobile */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closeMobileSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen bg-gray-900 text-white z-50 transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
          w-64 flex flex-col
        `}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">POS System</h1>
            <p className="text-xs text-gray-400 mt-1">Point of Sale</p>
          </div>
          {/* Close button - Only visible on mobile */}
          <button
            onClick={closeMobileSidebar}
            className="lg:hidden p-1 hover:bg-gray-800 rounded transition"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="px-6 py-4 bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold flex-shrink-0">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{profile?.full_name || 'User'}</p>
              <p className="text-xs text-gray-400 capitalize truncate">{profile?.role || 'cashier'}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeMobileSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white border-l-4 border-blue-400'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* LOGOUT BUTTON - Fixed and Always Visible */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="p-4 border-t border-gray-800 flex-shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-gray-300 hover:bg-red-600 hover:text-white rounded-lg transition"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}
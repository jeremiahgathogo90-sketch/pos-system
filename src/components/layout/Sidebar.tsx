import { NavLink } from 'react-router-dom'
import { useAuthContext } from '../../contexts/AuthContext'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  ShoppingBag,
  FileText,
  Settings,
  UserCog,
  DollarSign,
  LogOut,
} from 'lucide-react'

export default function Sidebar() {
  const { profile, signOut } = useAuthContext()

  const handleSignOut = async () => {
    await signOut()
  }

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['owner', 'admin', 'accountant'],
    },
    {
      name: 'POS',
      href: '/pos',
      icon: ShoppingCart,
      roles: ['owner', 'admin', 'accountant', 'cashier'],
    },
    {
      name: 'My Sales',
      href: '/my-sales',
      icon: DollarSign,
      roles: ['cashier'],
    },
    {
      name: 'Inventory',
      href: '/inventory',
      icon: Package,
      roles: ['owner', 'admin', 'accountant'],
    },
    {
      name: 'Customers',
      href: '/customers',
      icon: Users,
      roles: ['owner', 'admin', 'accountant', 'cashier'],
    },
    {
      name: 'Suppliers',
      href: '/suppliers',
      icon: Truck,
      roles: ['owner', 'admin', 'accountant'],
    },
    {
      name: 'Purchase Orders',
      href: '/purchase-orders',
      icon: ShoppingBag,
      roles: ['owner', 'admin', 'accountant'],
    },
    {
      name: 'Reports',
      href: '/reports',
      icon: FileText,
      roles: ['owner', 'admin', 'accountant'],
    },
    {
      name: 'Users',
      href: '/users',
      icon: UserCog,
      roles: ['owner', 'admin'],
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      roles: ['owner', 'admin'],
    },
  ]

  const filteredNavigation = navigation.filter((item) =>
    item.roles.includes(profile?.role || '')
  )

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold">POS System</h1>
        <p className="text-sm text-gray-400 mt-1">{profile?.full_name}</p>
        <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredNavigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>
      {profile?.role === 'cashier' && (
         <button
           className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 rounded-lg"
    >
           <DollarSign className="w-5 h-5" />
           <span>Manage Shift</span>
         </button>
       )}

      {/* Logout */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-gray-300 hover:bg-gray-800 hover:text-white transition"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}
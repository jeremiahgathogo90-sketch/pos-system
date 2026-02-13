import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar - hidden on mobile by default, shows on toggle */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-auto w-full">
        {/* Add top padding on mobile to account for floating menu button */}
        <div className="lg:p-0 pt-16 lg:pt-0 w-full h-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
import { Warehouse } from 'lucide-react'
import { LoginForm } from '@/components/auth/LoginForm'
import { useAuthStore } from '@/store/authStore'
import { Navigate } from '@tanstack/react-router'

export function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())

  if (isAuthenticated) {
    return <Navigate to="/sites" />
  }

  return (
    <div className="min-h-screen bg-kraft-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl
                          bg-kraft-700 shadow-lg shadow-kraft-800/20 mb-4">
            <Warehouse className="w-8 h-8 text-kraft-100" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-kraft-800">Inventory Snap</h1>
          <p className="text-sm text-kraft-400 mt-1">
            Warehouse inventory, instantly captured
          </p>
        </div>

        {/* Form card */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-kraft-700 mb-5">Sign in</h2>
          <LoginForm />
        </div>

        <p className="text-center text-xs text-kraft-400 mt-6">
          Having trouble? Contact your site administrator.
        </p>
      </div>
    </div>
  )
}

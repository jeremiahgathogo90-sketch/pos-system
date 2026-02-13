import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../libs/supabase'
import { useAuthContext } from '../contexts/AuthContext'
import { UserPlus, Trash2, ToggleLeft, ToggleRight, X, AlertTriangle, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES = ['owner', 'admin', 'accountant', 'cashier'] as const
type Role = typeof ROLES[number]

const ROLE_COLORS: Record<Role, string> = {
  owner:      'bg-purple-100 text-purple-700',
  admin:      'bg-blue-100 text-blue-700',
  accountant: 'bg-green-100 text-green-700',
  cashier:    'bg-gray-100 text-gray-700',
}

export default function UsersPage() {
  const { user: currentUser, profile: currentProfile } = useAuthContext()
  const queryClient = useQueryClient()

  const [showCreate, setShowCreate]         = useState(false)
  const [confirmDelete, setConfirmDelete]   = useState<any>(null)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'cashier' as Role,
  })

  // ── Fetch all users ──────────────────────────────────────────────────────
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // ── Create user ──────────────────────────────────────────────────────────
  const createUser = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error('Full name is required')
      if (!form.email.trim())     throw new Error('Email is required')
      if (!form.password.trim())  throw new Error('Password is required')
      if (form.password.length < 6) throw new Error('Password must be at least 6 characters')

      // 1. Create auth user via admin API (or regular signup)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        email_confirm: true,
        user_metadata: { full_name: form.full_name.trim() },
      })

      if (authError) {
        // Fallback: use regular signup
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          options: { data: { full_name: form.full_name.trim() } },
        })
        if (signUpError) throw signUpError

        const newUserId = signUpData.user?.id
        if (!newUserId) throw new Error('Failed to create user')

        // Upsert profile with the full name
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: newUserId,
            email: form.email.trim().toLowerCase(),
            full_name: form.full_name.trim(),
            role: form.role,
            is_active: true,
          }, { onConflict: 'id' })
        if (profileError) throw profileError
        return
      }

      const newUserId = authData.user?.id
      if (!newUserId) throw new Error('Failed to create user')

      // Upsert profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: newUserId,
          email: form.email.trim().toLowerCase(),
          full_name: form.full_name.trim(),
          role: form.role,
          is_active: true,
        }, { onConflict: 'id' })
      if (profileError) throw profileError
    },
    onSuccess: () => {
      toast.success(`${form.full_name} created successfully!`)
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowCreate(false)
      setForm({ full_name: '', email: '', password: '', role: 'cashier' })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create user')
    },
  })

  // ── Toggle active ────────────────────────────────────────────────────────
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !is_active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      toast.success(vars.is_active ? 'User deactivated' : 'User activated')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  // ── Delete user ──────────────────────────────────────────────────────────
  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      // Use SECURITY DEFINER RPC function - handles both profile + auth.users deletion
      const { data, error } = await supabase
        .rpc('delete_user_completely', { target_user_id: userId })

      if (error) throw new Error(error.message)
      if (data?.success === false) throw new Error(data.error || 'Failed to delete user')
    },
    onSuccess: () => {
      toast.success('User deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setConfirmDelete(null)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete user')
    },
  })

  const canManage = currentProfile?.role === 'owner' || currentProfile?.role === 'admin'

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">{users?.length || 0} total users</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <UserPlus className="w-5 h-5" />
            Add User
          </button>
        )}
      </div>

      {/* ── Users Table ── */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">Name</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">Email</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">Role</th>
              <th className="px-6 py-4 text-center font-semibold text-gray-700">Status</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">Joined</th>
              {canManage && <th className="px-6 py-4 text-center font-semibold text-gray-700">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">Loading users...</td></tr>
            )}
            {users?.map(u => (
              <tr key={u.id} className={`hover:bg-gray-50 ${!u.is_active ? 'opacity-60' : ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{u.full_name || '—'}</p>
                      {u.id === currentUser?.id && (
                        <span className="text-xs text-blue-500 font-medium">You</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{u.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${ROLE_COLORS[u.role as Role] || 'bg-gray-100 text-gray-700'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500 text-xs">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                {canManage && (
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {/* Activate / Deactivate */}
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => toggleActive.mutate({ id: u.id, is_active: u.is_active })}
                          title={u.is_active ? 'Deactivate' : 'Activate'}
                          className={`p-1.5 rounded-lg transition ${u.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                        >
                          {u.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                      )}

                      {/* Delete — only owner can delete; admin can't delete owner */}
                      {u.id !== currentUser?.id && (
                        currentProfile?.role === 'owner' ||
                        (currentProfile?.role === 'admin' && u.role !== 'owner')
                      ) && (
                        <button
                          onClick={() => setConfirmDelete(u)}
                          title="Delete user"
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}

                      {/* Own row — shield icon, no actions */}
                      {u.id === currentUser?.id && (
                       <span title="Cannot modify your own account">
                         <Shield className="w-5 h-5 text-gray-400" />
                        </span>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!isLoading && users?.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Create User Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Add New User</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Wanjiru"
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">This name appears on their POS page and receipts</p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="jane@example.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value as Role })}
                  className="w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {ROLES.filter(r => {
                    // Admins can't create owners
                    if (currentProfile?.role === 'admin' && r === 'owner') return false
                    return true
                  }).map(r => (
                    <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Preview */}
              {form.full_name && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <p className="text-blue-700">
                    <span className="font-semibold">{form.full_name}</span> will appear on their POS page as their cashier name.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  disabled={createUser.isPending}
                  className="flex-1 py-2.5 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createUser.mutate()}
                  disabled={createUser.isPending || !form.full_name || !form.email || !form.password}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {createUser.isPending ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete User?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-5">
              <p className="font-semibold text-gray-900">{confirmDelete.full_name}</p>
              <p className="text-sm text-gray-500">{confirmDelete.email}</p>
              <span className={`mt-2 inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize ${ROLE_COLORS[confirmDelete.role as Role]}`}>
                {confirmDelete.role}
              </span>
            </div>

            <p className="text-sm text-gray-600 mb-5">
              Deleting this user will remove their access. Their sales history will be retained.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleteUser.isPending}
                className="flex-1 py-2.5 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUser.mutate(confirmDelete.id)}
                disabled={deleteUser.isPending}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition"
              >
                {deleteUser.isPending ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
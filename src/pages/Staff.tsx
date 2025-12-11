import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import { api, login, getToken, setToken, clearToken } from '../api'

interface Subject { id: string; name: string; description?: string; color?: string; location?: string; customFields?: string[]; active?: boolean }
interface Slot { id: string; subjectId: string; subjectName: string; startTime: string; duration: number; maxCapacity: number; currentBookings: number }
interface Booking { id: string; studentName: string; studentId: string; studentEmail: string; subjectName: string; slotStart: string | null; slotDuration: number; createdAt: string | null; status: string; answers?: any }
interface User { id: string; name: string; username: string; email?: string; role: string }

type Tab = 'dashboard' | 'bookings' | 'subjects' | 'slots' | 'users' | 'settings'

export default function Staff() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!getToken())
  const [user, setUser] = useState({ name: 'Admin', role: 'admin' })
  const [tab, setTab] = useState<Tab>('dashboard')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Data
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState({ totalBookings: 0, todayBookings: 0, totalSubjects: 0, availableSlots: 0 })

  // Modals
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [showSlotModal, setShowSlotModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // Filters
  const [slotFilter, setSlotFilter] = useState({ subjectId: '', showPast: false, dateFrom: '', dateTo: '', status: '' })
  const [bookingSearch, setBookingSearch] = useState('')

  useEffect(() => {
    if (isLoggedIn) loadAll()
  }, [isLoggedIn])

  useEffect(() => {
    if (isLoggedIn && tab === 'slots') loadSlots()
  }, [tab, slotFilter])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type })

  const loadAll = async () => {
    try {
      const data = await api.get('/staff/data')
      setSubjects(data.subjects)
      setBookings(data.roster)
      setUser(data.user)
      loadStats()
    } catch (e) { showToast('Error loading data', 'error') }
  }

  const loadStats = async () => {
    try {
      const s = await api.get('/staff/stats')
      setStats(s)
    } catch (e) { }
  }

  const loadSlots = async () => {
    try {
      let url = `/staff/slots?showPast=${slotFilter.showPast}`
      if (slotFilter.subjectId) url += `&subjectId=${slotFilter.subjectId}`
      if (slotFilter.dateFrom) url += `&dateFrom=${slotFilter.dateFrom}`
      if (slotFilter.dateTo) url += `&dateTo=${slotFilter.dateTo}`
      if (slotFilter.status === 'available') url += `&availableOnly=true`
      let data = await api.get(url)
      // Client-side filter for "full" status
      if (slotFilter.status === 'full') {
        data = data.filter((s: Slot) => s.currentBookings >= s.maxCapacity)
      }
      setSlots(data)
    } catch (e) { showToast('Error loading slots', 'error') }
  }

  const loadUsers = async () => {
    try {
      const data = await api.get('/staff/users')
      setUsers(data)
    } catch (e) { showToast('Error loading users', 'error') }
  }

  const handleLogin = async (username: string, password: string) => {
    try {
      const data = await login(username, password)
      setToken(data.token)
      setUser({ name: data.name, role: data.role })
      setIsLoggedIn(true)
      showToast(`Welcome back, ${data.name}`)
    } catch (e) { showToast('Invalid credentials', 'error') }
  }

  const handleLogout = () => { clearToken(); setIsLoggedIn(false) }

  const filteredBookings = bookings.filter(b =>
    !bookingSearch ||
    b.studentName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
    b.studentId.toLowerCase().includes(bookingSearch.toLowerCase())
  )

  if (!isLoggedIn) return <LoginForm onLogin={handleLogin} toast={toast} onCloseToast={() => setToast(null)} />

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col flex-shrink-0">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">B</div>
            <div><div className="font-bold leading-tight">Booking CMS</div><div className="text-xs text-green-600 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Online</div></div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-xs font-bold text-gray-400 uppercase mb-2 px-3">Overview</div>
          <NavItem icon="fa-chart-pie" label="Dashboard" active={tab === 'dashboard'} onClick={() => setTab('dashboard')} />
          <div className="text-xs font-bold text-gray-400 uppercase mb-2 mt-6 px-3">Management</div>
          <NavItem icon="fa-calendar-check" label="Bookings" active={tab === 'bookings'} onClick={() => setTab('bookings')} />
          <NavItem icon="fa-graduation-cap" label="Subjects" active={tab === 'subjects'} onClick={() => setTab('subjects')} />
          <NavItem icon="fa-clock" label="Time Slots" active={tab === 'slots'} onClick={() => { setTab('slots'); loadSlots() }} />
          <div className="text-xs font-bold text-gray-400 uppercase mb-2 mt-6 px-3">System</div>
          <NavItem icon="fa-users" label="Users" active={tab === 'users'} onClick={() => { setTab('users'); loadUsers() }} />
          <NavItem icon="fa-gear" label="Settings" active={tab === 'settings'} onClick={() => setTab('settings')} />
        </nav>
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-sm font-bold text-indigo-600">{user.name.substring(0, 2).toUpperCase()}</div>
            <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{user.name}</div><div className="text-xs text-gray-400">{user.role === 'admin' ? 'Administrator' : 'Staff'}</div></div>
          </div>
          <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"><i className="fa-solid fa-right-from-bracket"></i> Sign Out</button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        {tab === 'dashboard' && <Dashboard stats={stats} bookings={bookings} onViewBooking={() => setTab('bookings')} />}
        {tab === 'bookings' && <BookingsTab bookings={filteredBookings} search={bookingSearch} onSearchChange={setBookingSearch} onCancel={async (id) => { await api.del(`/staff/bookings/${id}`); loadAll(); showToast('Booking cancelled') }} />}
        {tab === 'subjects' && <SubjectsTab subjects={subjects} onAdd={() => { setEditingSubject(null); setShowSubjectModal(true) }} onEdit={(s) => { setEditingSubject(s); setShowSubjectModal(true) }} onDelete={async (id) => { if (confirm('Delete this subject?')) { await api.del(`/staff/subjects/${id}`); loadAll(); showToast('Subject deleted') } }} />}
        {tab === 'slots' && <SlotsTab slots={slots} subjects={subjects} filter={slotFilter} onFilterChange={setSlotFilter} onGenerate={() => setShowSlotModal(true)} onDelete={async (id) => { await api.del(`/staff/slots/${id}`); loadSlots(); showToast('Slot deleted') }} onBulkDelete={async (ids) => { await api.post('/staff/slots/bulk-delete', { slotIds: ids }); loadSlots(); showToast(`Deleted ${ids.length} slots`) }} onUpdate={async (id, data) => { try { await api.put(`/staff/slots/${id}`, data); loadSlots(); showToast('Slot updated') } catch (e) { showToast('Failed to update', 'error') } }} onAddRow={async (data) => { try { await api.post('/staff/slots', data); loadSlots(); showToast('Slot added') } catch (e) { showToast('Failed to add slot', 'error') } }} />}
        {tab === 'users' && <UsersTab users={users} onAdd={() => { setEditingUser(null); setShowUserModal(true) }} onEdit={(u) => { setEditingUser(u); setShowUserModal(true) }} onDelete={async (id) => { if (confirm('Delete this user?')) { await api.del(`/staff/users/${id}`); loadUsers(); showToast('User deleted') } }} />}
        {tab === 'settings' && <SettingsTab onClearBookings={async () => { if (confirm('Delete ALL bookings?')) { try { await api.post('/staff/clear-bookings', {}); loadAll(); showToast('Bookings cleared') } catch (e: any) { showToast(e.message || 'Failed to clear bookings', 'error') } } }} />}
      </main>

      {/* Modals */}
      {showSubjectModal && <SubjectModal subject={editingSubject} onClose={() => setShowSubjectModal(false)} onSave={async (data) => { if (editingSubject) await api.put(`/staff/subjects/${editingSubject.id}`, data); else await api.post('/staff/subjects', data); setShowSubjectModal(false); loadAll(); showToast(editingSubject ? 'Subject updated' : 'Subject created') }} />}
      {showSlotModal && <SlotGenerateModal subjects={subjects} onClose={() => setShowSlotModal(false)} onGenerate={async (data) => { const r = await api.post('/staff/slots/generate', data); setShowSlotModal(false); loadSlots(); showToast(`Generated ${r.count} slots`) }} />}
      {showUserModal && <UserModal user={editingUser} onClose={() => setShowUserModal(false)} onSave={async (data) => { if (editingUser) await api.put(`/staff/users/${editingUser.id}`, data); else await api.post('/staff/users', data); setShowUserModal(false); loadUsers(); showToast(editingUser ? 'User updated' : 'User created') }} />}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

function NavItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition ${active ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
      <i className={`fa-solid ${icon} w-5`}></i>
      <span className="font-medium">{label}</span>
    </div>
  )
}

function LoginForm({ onLogin, toast, onCloseToast }: { onLogin: (u: string, p: string) => void; toast: any; onCloseToast: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    await onLogin(username, password)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl flex items-center justify-center mb-6 text-2xl shadow-lg"><i className="fa-solid fa-shield-halved"></i></div>
        <h1 className="text-2xl font-bold mb-1">Staff Portal</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to manage your booking system.</p>
        <div className="space-y-4">
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Username</label><input value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" className="w-full p-3 bg-gray-50 border rounded-lg" /></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSubmit()} placeholder="Enter password" className="w-full p-3 bg-gray-50 border rounded-lg" /></div>
          <button onClick={handleSubmit} disabled={loading} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 rounded-lg hover:opacity-90 flex justify-center items-center gap-2 shadow-lg disabled:opacity-50">
            {loading && <div className="spinner"></div>}
            {loading ? 'Signing in...' : 'Login'}
          </button>
          <div className="text-center pt-2"><Link to="/" className="text-xs text-gray-400 hover:text-indigo-600 underline">← Back to Student View</Link></div>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={onCloseToast} />}
    </div>
  )
}


function Dashboard({ stats, bookings, onViewBooking }: { stats: any; bookings: Booking[]; onViewBooking: () => void }) {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8"><h1 className="text-2xl font-bold">Dashboard</h1><p className="text-gray-500">Overview of your booking system.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Bookings" value={stats.totalBookings} icon="fa-calendar-check" color="blue" />
        <StatCard label="Today's Bookings" value={stats.todayBookings} icon="fa-calendar-day" color="green" />
        <StatCard label="Active Subjects" value={stats.totalSubjects} icon="fa-graduation-cap" color="purple" />
        <StatCard label="Available Slots" value={stats.availableSlots} icon="fa-clock" color="orange" />
      </div>
      <div className="bg-white rounded-xl border p-6">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold">Recent Bookings</h3><button onClick={onViewBooking} className="text-sm text-indigo-600 hover:underline">View all →</button></div>
        <div className="space-y-3">
          {bookings.slice(0, 5).map(b => (
            <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">{b.studentName.substring(0, 2).toUpperCase()}</div>
                <div><div className="font-semibold text-sm">{b.studentName}</div><div className="text-xs text-gray-400">{b.subjectName}</div></div>
              </div>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">{b.status}</span>
            </div>
          ))}
          {bookings.length === 0 && <div className="text-center text-gray-400 py-4">No bookings yet</div>}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colors: Record<string, string> = { blue: 'bg-blue-100 text-blue-600', green: 'bg-green-100 text-green-600', purple: 'bg-purple-100 text-purple-600', orange: 'bg-orange-100 text-orange-600' }
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-500 text-sm">{label}</span>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}><i className={`fa-solid ${icon}`}></i></div>
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  )
}

function BookingsTab({ bookings, search, onSearchChange, onCancel }: { bookings: Booking[]; search: string; onSearchChange: (s: string) => void; onCancel: (id: string) => void }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  const copyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }
  
  const shortId = (id: string) => id.length > 8 ? `${id.slice(0, 8)}...` : id
  
  // Format slot time as "h:mm AM - h:mm PM (dd/mm/yy)" in local timezone
  const formatSlotTime = (slotStart: string | null, duration: number) => {
    if (!slotStart) return 'Deleted Slot'
    const start = new Date(slotStart)
    const end = new Date(start.getTime() + duration * 60000)
    const timeFormat = { hour: 'numeric', minute: '2-digit', hour12: true } as const
    const startStr = start.toLocaleTimeString('en-US', timeFormat)
    const endStr = end.toLocaleTimeString('en-US', timeFormat)
    const dateStr = start.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
    return `${startStr} - ${endStr} (${dateStr})`
  }
  
  // Format submit timestamp in local timezone with AM/PM
  const formatSubmitTime = (createdAt: string | null) => {
    if (!createdAt) return '-'
    const dt = new Date(createdAt)
    const dateStr = dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
    const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    return `${dateStr}, ${timeStr}`
  }
  
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div><h1 className="text-2xl font-bold">Bookings</h1><p className="text-gray-500">Manage student reservations.</p></div>
      </div>
      <div className="bg-white rounded-xl border p-4 mb-4">
        <input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Search by name or ID..." className="w-full p-2 border rounded-lg bg-gray-50" />
      </div>
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b text-gray-500 uppercase text-xs font-semibold">
            <tr>
              <th className="p-4 pl-6">Booking ID</th>
              <th className="p-4">Student</th>
              <th className="p-4">Subject</th>
              <th className="p-4">Slot Time</th>
              <th className="p-4">Submitted</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right pr-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {bookings.map(b => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="p-4 pl-6">
                  <div className="flex items-center gap-1">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-600" title={b.id}>{shortId(b.id)}</code>
                    <button onClick={() => copyToClipboard(b.id)} className="p-1 text-gray-400 hover:text-indigo-600 rounded" title="Copy full ID">
                      <i className={`fa-solid ${copiedId === b.id ? 'fa-check text-green-500' : 'fa-copy'} text-xs`}></i>
                    </button>
                  </div>
                </td>
                <td className="p-4">
                  <div className="font-semibold">{b.studentName}</div>
                  <div className="text-xs text-gray-400">{b.studentId}</div>
                  <div className="text-xs text-gray-400">{b.studentEmail}</div>
                </td>
                <td className="p-4"><span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">{b.subjectName}</span></td>
                <td className="p-4 text-gray-600 whitespace-nowrap text-xs">{formatSlotTime(b.slotStart, b.slotDuration)}</td>
                <td className="p-4 text-gray-500 whitespace-nowrap text-xs">{formatSubmitTime(b.createdAt)}</td>
                <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{b.status}</span></td>
                <td className="p-4 pr-6 text-right"><button onClick={() => onCancel(b.id)} className="text-gray-400 hover:text-red-600 p-2 rounded hover:bg-red-50"><i className="fa-solid fa-trash-can"></i></button></td>
              </tr>
            ))}
            {bookings.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-400">No bookings found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SubjectsTab({ subjects, onAdd, onEdit, onDelete }: { subjects: Subject[]; onAdd: () => void; onEdit: (s: Subject) => void; onDelete: (id: string) => void }) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div><h1 className="text-2xl font-bold">Subjects</h1><p className="text-gray-500">Manage faculties.</p></div>
        <button onClick={onAdd} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"><i className="fa-solid fa-plus"></i> Add Subject</button>
      </div>
      <div className="space-y-3">
        {subjects.map(s => (
          <div key={s.id} className="bg-white border rounded-xl p-4 flex justify-between items-center hover:shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ background: s.color || '#4F46E5' }}><i className="fa-solid fa-graduation-cap text-lg"></i></div>
              <div><div className="font-bold">{s.name}</div>{s.description && <div className="text-sm text-gray-500">{s.description}</div>}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(s)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><i className="fa-solid fa-pen"></i></button>
              <button onClick={() => onDelete(s.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><i className="fa-solid fa-trash"></i></button>
            </div>
          </div>
        ))}
        {subjects.length === 0 && <div className="text-center text-gray-400 py-8 bg-white rounded-xl border">No subjects yet.</div>}
      </div>
    </div>
  )
}

function SlotsTab({ slots, subjects, filter, onFilterChange, onGenerate, onDelete, onBulkDelete, onUpdate, onAddRow }: { 
  slots: Slot[]; subjects: Subject[]; filter: any; onFilterChange: (f: any) => void; 
  onGenerate: () => void; onDelete: (id: string) => void; onBulkDelete?: (ids: string[]) => void;
  onUpdate?: (id: string, data: any) => void; onAddRow?: (data: any) => void 
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [newRows, setNewRows] = useState<any[]>([])
  const [showFilters, setShowFilters] = useState(false)

  // Toggle selection
  const toggleSelect = (id: string) => {
    const newSet = new Set(selected)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelected(newSet)
  }

  const toggleSelectAll = () => {
    if (selected.size === slots.length) setSelected(new Set())
    else setSelected(new Set(slots.map(s => s.id)))
  }

  const handleBulkDelete = () => {
    if (selected.size === 0) return
    if (confirm(`Delete ${selected.size} selected slot(s)?`)) {
      onBulkDelete?.(Array.from(selected))
      setSelected(new Set())
    }
  }

  // Inline editing
  const startEdit = (id: string, field: string, value: string) => {
    setEditingCell({ id, field })
    setEditValue(value)
  }

  const saveEdit = (overrideValue?: string) => {
    if (!editingCell || !onUpdate) return
    const { id, field } = editingCell
    const slot = slots.find(s => s.id === id)
    if (!slot) return

    const valueToUse = overrideValue !== undefined ? overrideValue : editValue
    
    // Don't save if value is empty or unchanged
    if (!valueToUse) {
      setEditingCell(null)
      return
    }

    let updateData: any = {}
    if (field === 'date') {
      // Keep the same time, just change the date (all in local timezone)
      const oldDt = new Date(slot.startTime)
      const hours = oldDt.getHours()
      const minutes = oldDt.getMinutes()
      const parts = valueToUse.split('-')
      if (parts.length !== 3) { setEditingCell(null); return }
      const [y, m, d] = parts.map(Number)
      if (isNaN(y) || isNaN(m) || isNaN(d)) { setEditingCell(null); return }
      const newDt = new Date(y, m - 1, d, hours, minutes, 0, 0)
      if (isNaN(newDt.getTime())) { setEditingCell(null); return }
      updateData.startTime = newDt.toISOString()
    } else if (field === 'time') {
      // Keep the same date, just change the time (all in local timezone)
      const oldDt = new Date(slot.startTime)
      const parts = valueToUse.split(':')
      if (parts.length < 2) { setEditingCell(null); return }
      const [h, min] = parts.map(Number)
      if (isNaN(h) || isNaN(min)) { setEditingCell(null); return }
      const newDt = new Date(oldDt.getFullYear(), oldDt.getMonth(), oldDt.getDate(), h, min, 0, 0)
      if (isNaN(newDt.getTime())) { setEditingCell(null); return }
      updateData.startTime = newDt.toISOString()
    } else if (field === 'duration') {
      updateData.duration = parseInt(valueToUse) || slot.duration
    } else if (field === 'capacity') {
      updateData.maxCapacity = parseInt(valueToUse) || slot.maxCapacity
    } else if (field === 'subject') {
      updateData.subjectId = valueToUse
    }

    onUpdate(id, updateData)
    setEditingCell(null)
  }

  const cancelEdit = () => setEditingCell(null)

  // Add new row - default to tomorrow to ensure it shows (not filtered by showPast)
  const addNewRow = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setNewRows([...newRows, {
      id: `new-${Date.now()}`,
      subjectId: subjects[0]?.id || '',
      date: tomorrow.toISOString().split('T')[0],
      time: '09:00',
      duration: 20,
      capacity: 1
    }])
  }

  const updateNewRow = (idx: number, field: string, value: any) => {
    setNewRows(newRows.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  const saveNewRow = async (idx: number) => {
    const row = newRows[idx]
    if (!row.subjectId || !row.date || !row.time) return
    
    const dt = new Date(`${row.date}T${row.time}`)
    await onAddRow?.({
      subjectId: row.subjectId,
      startTime: dt.toISOString(),
      duration: row.duration,
      maxCapacity: row.capacity
    })
    setNewRows(newRows.filter((_, i) => i !== idx))
  }

  const removeNewRow = (idx: number) => {
    setNewRows(newRows.filter((_, i) => i !== idx))
  }

  // Stats
  const totalSlots = slots.length
  const availableSlots = slots.filter(s => s.currentBookings < s.maxCapacity && new Date(s.startTime) > new Date()).length
  const fullSlots = slots.filter(s => s.currentBookings >= s.maxCapacity).length

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Time Slots</h1>
          <p className="text-gray-500">Manage availability and schedules.</p>
        </div>
        <button onClick={onGenerate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-sm">
          <i className="fa-solid fa-plus"></i> Generate Slots
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600"><i className="fa-solid fa-calendar"></i></div>
          <div><div className="text-2xl font-bold">{totalSlots}</div><div className="text-xs text-gray-500">Total Slots</div></div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-green-600"><i className="fa-solid fa-check"></i></div>
          <div><div className="text-2xl font-bold">{availableSlots}</div><div className="text-xs text-gray-500">Available</div></div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600"><i className="fa-solid fa-ban"></i></div>
          <div><div className="text-2xl font-bold">{fullSlots}</div><div className="text-xs text-gray-500">Fully Booked</div></div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Subject</label>
            <select value={filter.subjectId} onChange={e => onFilterChange({ ...filter, subjectId: e.target.value })} className="w-full p-2 border rounded-lg bg-gray-50">
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="min-w-[150px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Date From</label>
            <input type="date" value={filter.dateFrom || ''} onChange={e => onFilterChange({ ...filter, dateFrom: e.target.value })} className="w-full p-2 border rounded-lg bg-gray-50" />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Date To</label>
            <input type="date" value={filter.dateTo || ''} onChange={e => onFilterChange({ ...filter, dateTo: e.target.value })} className="w-full p-2 border rounded-lg bg-gray-50" />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
            <select value={filter.status || ''} onChange={e => onFilterChange({ ...filter, status: e.target.value })} className="w-full p-2 border rounded-lg bg-gray-50">
              <option value="">All Status</option>
              <option value="available">Available</option>
              <option value="full">Fully Booked</option>
            </select>
          </div>
          <div className="flex items-end gap-4 pt-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={filter.showPast} onChange={e => onFilterChange({ ...filter, showPast: e.target.checked })} className="w-4 h-4 rounded" />
              <span className="text-sm">Show past</span>
            </label>
            <button onClick={() => onFilterChange({ subjectId: '', showPast: false, dateFrom: '', dateTo: '', status: '' })} className="text-sm text-gray-500 hover:text-indigo-600">
              <i className="fa-solid fa-rotate-left mr-1"></i> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <span className="text-sm text-gray-600 bg-indigo-50 px-2 py-1 rounded">{selected.size} selected</span>
              <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 flex items-center gap-1">
                <i className="fa-solid fa-trash"></i> Delete
              </button>
              <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 text-gray-500 text-sm hover:text-gray-700">Clear</button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addNewRow} className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100 flex items-center gap-1">
            <i className="fa-solid fa-plus"></i> Add Row
          </button>
          <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 ${showFilters ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <i className="fa-solid fa-filter"></i> Filter
          </button>
          <span className="text-sm text-gray-400 ml-2">{slots.length} rows</span>
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" style={{ minWidth: '900px' }}>
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-200">
                <th className="w-10 p-2 border-r border-gray-200 text-center">
                  <input type="checkbox" checked={slots.length > 0 && selected.size === slots.length} onChange={toggleSelectAll} className="w-4 h-4 rounded" />
                </th>
                <th className="p-2 border-r border-gray-200 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide min-w-[150px]">Subject</th>
                <th className="p-2 border-r border-gray-200 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide min-w-[130px]">Date</th>
                <th className="p-2 border-r border-gray-200 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide min-w-[100px]">Time</th>
                <th className="p-2 border-r border-gray-200 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide min-w-[80px]">Duration</th>
                <th className="p-2 border-r border-gray-200 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide min-w-[80px]">Capacity</th>
                <th className="p-2 border-r border-gray-200 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide min-w-[80px]">Booked</th>
                <th className="p-2 text-center font-semibold text-gray-600 text-xs uppercase tracking-wide w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* New Rows */}
              {newRows.map((row, idx) => (
                <tr key={row.id} className="bg-green-50 border-b border-gray-200 hover:bg-green-100">
                  <td className="p-2 border-r border-gray-200 text-center text-green-600"><i className="fa-solid fa-plus"></i></td>
                  <td className="p-1 border-r border-gray-200">
                    <select value={row.subjectId} onChange={e => updateNewRow(idx, 'subjectId', e.target.value)} className="w-full p-1.5 border border-green-300 rounded bg-white text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500">
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                  <td className="p-1 border-r border-gray-200">
                    <input type="date" value={row.date} onChange={e => updateNewRow(idx, 'date', e.target.value)} className="w-full p-1.5 border border-green-300 rounded bg-white text-sm focus:ring-2 focus:ring-green-500" />
                  </td>
                  <td className="p-1 border-r border-gray-200">
                    <input type="time" value={row.time} onChange={e => updateNewRow(idx, 'time', e.target.value)} className="w-full p-1.5 border border-green-300 rounded bg-white text-sm focus:ring-2 focus:ring-green-500" />
                  </td>
                  <td className="p-1 border-r border-gray-200">
                    <input type="number" value={row.duration} onChange={e => updateNewRow(idx, 'duration', +e.target.value)} className="w-full p-1.5 border border-green-300 rounded bg-white text-sm focus:ring-2 focus:ring-green-500" />
                  </td>
                  <td className="p-1 border-r border-gray-200">
                    <input type="number" value={row.capacity} onChange={e => updateNewRow(idx, 'capacity', +e.target.value)} className="w-full p-1.5 border border-green-300 rounded bg-white text-sm focus:ring-2 focus:ring-green-500" />
                  </td>
                  <td className="p-2 border-r border-gray-200 text-gray-400 text-center">-</td>
                  <td className="p-2 text-center">
                    <button onClick={() => saveNewRow(idx)} className="text-green-600 hover:text-green-700 p-1 mr-1" title="Save"><i className="fa-solid fa-check"></i></button>
                    <button onClick={() => removeNewRow(idx)} className="text-red-400 hover:text-red-600 p-1" title="Cancel"><i className="fa-solid fa-times"></i></button>
                  </td>
                </tr>
              ))}
              {/* Existing Slots */}
              {slots.map(s => {
                const dt = new Date(s.startTime)
                const isPast = dt < new Date()
                const isFull = s.currentBookings >= s.maxCapacity
                const isEditing = (field: string) => editingCell?.id === s.id && editingCell?.field === field
                // Format date as YYYY-MM-DD in local timezone for the date input
                const localDateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
                // Format time as HH:MM in local timezone for the time input
                const localTimeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`

                return (
                  <tr key={s.id} className={`border-b border-gray-200 ${isPast ? 'bg-gray-50 text-gray-400' : 'hover:bg-blue-50'} ${selected.has(s.id) ? 'bg-indigo-50' : ''}`}>
                    <td className="p-2 border-r border-gray-200 text-center">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} className="w-4 h-4 rounded" />
                    </td>
                    {/* Subject Cell */}
                    <td className="p-1 border-r border-gray-200 cursor-pointer" onDoubleClick={() => startEdit(s.id, 'subject', s.subjectId)}>
                      {isEditing('subject') ? (
                        <select value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={e => saveEdit(e.target.value)} onKeyDown={e => e.key === 'Enter' ? saveEdit() : e.key === 'Escape' && cancelEdit()} autoFocus className="w-full p-1 border-2 border-indigo-500 rounded text-sm">
                          {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                        </select>
                      ) : (
                        <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">{s.subjectName}</span>
                      )}
                    </td>
                    {/* Date Cell */}
                    <td className="p-1 border-r border-gray-200 cursor-pointer" onDoubleClick={() => startEdit(s.id, 'date', localDateStr)}>
                      {isEditing('date') ? (
                        <input type="date" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={e => saveEdit(e.target.value)} onKeyDown={e => e.key === 'Enter' ? saveEdit() : e.key === 'Escape' && cancelEdit()} autoFocus className="w-full p-1 border-2 border-indigo-500 rounded text-sm" />
                      ) : (
                        <span className="px-2 py-1">{dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      )}
                    </td>
                    {/* Time Cell */}
                    <td className="p-1 border-r border-gray-200 cursor-pointer" onDoubleClick={() => startEdit(s.id, 'time', localTimeStr)}>
                      {isEditing('time') ? (
                        <input type="time" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={e => saveEdit(e.target.value)} onKeyDown={e => e.key === 'Enter' ? saveEdit() : e.key === 'Escape' && cancelEdit()} autoFocus className="w-full p-1 border-2 border-indigo-500 rounded text-sm" />
                      ) : (
                        <span className="px-2 py-1">{dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                      )}
                    </td>
                    {/* Duration Cell */}
                    <td className="p-1 border-r border-gray-200 cursor-pointer text-center" onDoubleClick={() => startEdit(s.id, 'duration', String(s.duration))}>
                      {isEditing('duration') ? (
                        <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={e => saveEdit(e.target.value)} onKeyDown={e => e.key === 'Enter' ? saveEdit() : e.key === 'Escape' && cancelEdit()} autoFocus className="w-full p-1 border-2 border-indigo-500 rounded text-sm text-center" />
                      ) : (
                        <span>{s.duration} min</span>
                      )}
                    </td>
                    {/* Capacity Cell */}
                    <td className="p-1 border-r border-gray-200 cursor-pointer text-center" onDoubleClick={() => startEdit(s.id, 'capacity', String(s.maxCapacity))}>
                      {isEditing('capacity') ? (
                        <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={e => saveEdit(e.target.value)} onKeyDown={e => e.key === 'Enter' ? saveEdit() : e.key === 'Escape' && cancelEdit()} autoFocus className="w-full p-1 border-2 border-indigo-500 rounded text-sm text-center" />
                      ) : (
                        <span>{s.maxCapacity}</span>
                      )}
                    </td>
                    {/* Booked Cell */}
                    <td className="p-2 border-r border-gray-200 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${isFull ? 'bg-red-100 text-red-700' : s.currentBookings > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.currentBookings}
                      </span>
                    </td>
                    {/* Actions Cell */}
                    <td className="p-2 text-center">
                      <button onClick={() => onDelete(s.id)} className="text-gray-400 hover:text-red-600 p-1" title="Delete">
                        <i className="fa-solid fa-trash text-xs"></i>
                      </button>
                    </td>
                  </tr>
                )
              })}
              {slots.length === 0 && newRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="text-gray-400">
                      <i className="fa-solid fa-table text-4xl mb-3"></i>
                      <p className="mb-2">No slots yet</p>
                      <div className="flex gap-2 justify-center">
                        <button onClick={addNewRow} className="text-green-600 hover:underline text-sm">+ Add row</button>
                        <span className="text-gray-300">or</span>
                        <button onClick={onGenerate} className="text-indigo-600 hover:underline text-sm">Generate slots</button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 flex justify-between items-center text-xs text-gray-500">
          <span>Double-click cell to edit • Press Enter to save • Esc to cancel</span>
          <span>{slots.length} total slots • {availableSlots} available • {fullSlots} full</span>
        </div>
      </div>
    </div>
  )
}

function UsersTab({ users, onAdd, onEdit, onDelete }: { users: User[]; onAdd: () => void; onEdit: (u: User) => void; onDelete: (id: string) => void }) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div><h1 className="text-2xl font-bold">Users</h1><p className="text-gray-500">Manage staff accounts.</p></div>
        <button onClick={onAdd} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"><i className="fa-solid fa-plus"></i> Add User</button>
      </div>
      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className="bg-white border rounded-xl p-4 flex justify-between items-center hover:shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-bold">{u.name.substring(0, 2).toUpperCase()}</div>
              <div><div className="font-bold">{u.name}</div><div className="text-sm text-gray-500">@{u.username}</div></div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{u.role}</span>
              <button onClick={() => onEdit(u)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><i className="fa-solid fa-pen"></i></button>
              <button onClick={() => onDelete(u.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><i className="fa-solid fa-trash"></i></button>
            </div>
          </div>
        ))}
        {users.length === 0 && <div className="text-center text-gray-400 py-8 bg-white rounded-xl border">No users found.</div>}
      </div>
    </div>
  )
}

function SettingsTab({ onClearBookings }: { onClearBookings: () => void }) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8"><h1 className="text-2xl font-bold">Settings</h1><p className="text-gray-500">Configure your booking system.</p></div>
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h3 className="font-bold mb-4 text-red-600"><i className="fa-solid fa-triangle-exclamation mr-2"></i>Danger Zone</h3>
        <div className="flex justify-between items-center py-3">
          <div><div className="font-medium">Clear All Bookings</div><div className="text-sm text-gray-500">Delete all booking records</div></div>
          <button onClick={onClearBookings} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium">Clear</button>
        </div>
      </div>
    </div>
  )
}


function SubjectModal({ subject, onClose, onSave }: { subject: Subject | null; onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState({ name: subject?.name || '', description: subject?.description || '', color: subject?.color || '#4F46E5', location: subject?.location || '', customFields: (subject?.customFields || []).join('\n'), active: subject?.active !== false })
  const [loading, setLoading] = useState(false)
  const colors = ['#4F46E5', '#059669', '#DC2626', '#D97706', '#7C3AED', '#DB2777']

  const handleSave = async () => {
    if (!form.name.trim()) return
    setLoading(true)
    try {
      await onSave({ name: form.name, description: form.description, color: form.color, location: form.location, customFields: form.customFields.split('\n').filter(f => f.trim()), active: form.active })
    } catch (e) { }
    setLoading(false)
  }

  return (
    <Modal title={subject ? 'Edit Subject' : 'Add Subject'} onClose={onClose} footer={<><button onClick={onClose} className="flex-1 py-3 border rounded-lg font-semibold hover:bg-gray-100">Cancel</button><button onClick={handleSave} disabled={loading} className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">{loading ? 'Saving...' : 'Save'}</button></>}>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Subject Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Engineering" className="w-full p-3 border rounded-lg bg-gray-50" /></div>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." rows={2} className="w-full p-3 border rounded-lg bg-gray-50 resize-none" /></div>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Color</label><div className="flex gap-2">{colors.map(c => <div key={c} onClick={() => setForm({ ...form, color: c })} className={`w-8 h-8 rounded-lg cursor-pointer border-2 ${form.color === c ? 'border-indigo-600 scale-110' : 'border-transparent'}`} style={{ background: c }}></div>)}</div></div>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Default Location</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Room 101" className="w-full p-3 border rounded-lg bg-gray-50" /></div>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Custom Fields (one per line)</label><textarea value={form.customFields} onChange={e => setForm({ ...form, customFields: e.target.value })} placeholder="e.g. Portfolio URL" rows={3} className="w-full p-3 border rounded-lg bg-gray-50 resize-none" /></div>
      <div className="flex items-center gap-3"><label className="switch"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /><span className="switch-slider"></span></label><div><div className="font-medium text-sm">Active</div><div className="text-xs text-gray-500">Visible to students</div></div></div>
    </Modal>
  )
}

function SlotGenerateModal({ subjects, onClose, onGenerate }: { subjects: Subject[]; onClose: () => void; onGenerate: (data: any) => void }) {
  const [form, setForm] = useState({ 
    subjectId: subjects[0]?.id || '', 
    duration: 20, 
    capacity: 1, 
    breakTime: 0, 
    location: '', 
    dates: [new Date().toISOString().split('T')[0]] as string[],
    endDate: '', 
    timeRanges: [{ startTime: '09:00', endTime: '17:00' }] as { startTime: string; endTime: string }[],
    days: [] as number[], 
    mode: 'dates' as 'dates' | 'recurring', 
    lunchBreak: false, 
    lunchStart: '12:00', 
    lunchEnd: '13:00' 
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setError('')

    if (subjects.length === 0) {
      setError('Please create a subject first before generating slots.')
      return
    }
    if (!form.subjectId) {
      setError('Please select a subject.')
      return
    }
    if (form.mode === 'dates' && form.dates.length === 0) {
      setError('Please select at least one date.')
      return
    }
    if (form.mode === 'recurring' && form.days.length === 0) {
      setError('Please select at least one day for recurring slots.')
      return
    }
    if (form.mode === 'recurring' && (!form.dates[0] || !form.endDate)) {
      setError('Please select start and end dates for recurring slots.')
      return
    }
    if (form.timeRanges.length === 0) {
      setError('Please add at least one time range.')
      return
    }

    setLoading(true)
    try {
      await onGenerate({
        subjectId: form.subjectId,
        dates: form.mode === 'dates' ? form.dates : null,
        startDate: form.mode === 'recurring' ? form.dates[0] : null,
        endDate: form.mode === 'recurring' ? form.endDate : null,
        timeRanges: form.timeRanges,
        duration: form.duration,
        capacity: form.capacity,
        breakTime: form.breakTime,
        location: form.location,
        days: form.mode === 'recurring' ? form.days : null,
        lunchBreak: form.lunchBreak ? { start: form.lunchStart, end: form.lunchEnd } : null
      })
    } catch (e: any) {
      setError(e.message || 'Failed to generate slots')
    }
    setLoading(false)
  }

  const toggleDay = (d: number) => setForm({ ...form, days: form.days.includes(d) ? form.days.filter(x => x !== d) : [...form.days, d] })

  const addDate = () => setForm({ ...form, dates: [...form.dates, ''] })
  const removeDate = (idx: number) => setForm({ ...form, dates: form.dates.filter((_, i) => i !== idx) })
  const updateDate = (idx: number, val: string) => setForm({ ...form, dates: form.dates.map((d, i) => i === idx ? val : d) })

  const addTimeRange = () => setForm({ ...form, timeRanges: [...form.timeRanges, { startTime: '09:00', endTime: '17:00' }] })
  const removeTimeRange = (idx: number) => setForm({ ...form, timeRanges: form.timeRanges.filter((_, i) => i !== idx) })
  const updateTimeRange = (idx: number, field: 'startTime' | 'endTime', val: string) => setForm({ ...form, timeRanges: form.timeRanges.map((t, i) => i === idx ? { ...t, [field]: val } : t) })

  if (subjects.length === 0) {
    return (
      <Modal title="Generate Time Slots" onClose={onClose} footer={<button onClick={onClose} className="flex-1 py-3 border rounded-lg font-semibold hover:bg-gray-100">Close</button>}>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-exclamation-triangle text-2xl text-yellow-600"></i>
          </div>
          <h3 className="font-bold text-lg mb-2">No Subjects Found</h3>
          <p className="text-gray-500 text-sm">Please create a subject first before generating time slots.</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Generate Time Slots" onClose={onClose} footer={<><button onClick={onClose} className="flex-1 py-3 border rounded-lg font-semibold hover:bg-gray-100">Cancel</button><button onClick={handleGenerate} disabled={loading} className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">{loading ? 'Generating...' : 'Generate'}</button></>}>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Subject *</label><select value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value })} className="w-full p-3 border rounded-lg bg-gray-50">{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Duration (min)</label><input type="number" value={form.duration} onChange={e => setForm({ ...form, duration: +e.target.value })} className="w-full p-3 border rounded-lg bg-gray-50" /></div>
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Max Capacity</label><input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: +e.target.value })} className="w-full p-3 border rounded-lg bg-gray-50" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Break Between (min)</label><input type="number" value={form.breakTime} onChange={e => setForm({ ...form, breakTime: +e.target.value })} className="w-full p-3 border rounded-lg bg-gray-50" /></div>
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Location</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Room" className="w-full p-3 border rounded-lg bg-gray-50" /></div>
      </div>

      {/* Mode Toggle */}
      <div className="p-1 bg-gray-100 rounded-lg flex text-sm font-medium">
        <button onClick={() => setForm({ ...form, mode: 'dates' })} className={`flex-1 py-2 rounded ${form.mode === 'dates' ? 'shadow bg-white text-black' : 'text-gray-500'}`}>Multiple Dates</button>
        <button onClick={() => setForm({ ...form, mode: 'recurring' })} className={`flex-1 py-2 rounded ${form.mode === 'recurring' ? 'shadow bg-white text-black' : 'text-gray-500'}`}>Recurring</button>
      </div>

      {/* Dates Section */}
      {form.mode === 'dates' ? (
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-gray-600">Dates *</label>
            <button onClick={addDate} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><i className="fa-solid fa-plus"></i> Add Date</button>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {form.dates.map((date, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input type="date" value={date} onChange={e => updateDate(idx, e.target.value)} className="flex-1 p-2 border rounded-lg bg-gray-50 text-sm" />
                {form.dates.length > 1 && <button onClick={() => removeDate(idx)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><i className="fa-solid fa-times"></i></button>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label><input type="date" value={form.dates[0] || ''} onChange={e => setForm({ ...form, dates: [e.target.value] })} className="w-full p-3 border rounded-lg bg-gray-50" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label><input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full p-3 border rounded-lg bg-gray-50" /></div>
          </div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Repeat On</label><div className="flex gap-2">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} onClick={() => toggleDay(i)} className={`flex-1 py-2 rounded border text-center text-sm font-bold cursor-pointer ${form.days.includes(i) ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-400'}`}>{d}</div>)}</div></div>
        </>
      )}

      {/* Time Ranges Section */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-gray-600">Time Ranges *</label>
          <button onClick={addTimeRange} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><i className="fa-solid fa-plus"></i> Add Time Range</button>
        </div>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {form.timeRanges.map((tr, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input type="time" value={tr.startTime} onChange={e => updateTimeRange(idx, 'startTime', e.target.value)} className="flex-1 p-2 border rounded-lg bg-gray-50 text-sm" />
              <span className="text-gray-400">to</span>
              <input type="time" value={tr.endTime} onChange={e => updateTimeRange(idx, 'endTime', e.target.value)} className="flex-1 p-2 border rounded-lg bg-gray-50 text-sm" />
              {form.timeRanges.length > 1 && <button onClick={() => removeTimeRange(idx)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><i className="fa-solid fa-times"></i></button>}
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center gap-3 mb-3"><input type="checkbox" checked={form.lunchBreak} onChange={e => setForm({ ...form, lunchBreak: e.target.checked })} className="w-4 h-4 rounded" /><label className="font-medium text-sm cursor-pointer">Add Lunch Break</label></div>
        {form.lunchBreak && <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs text-gray-500 mb-1">Break Start</label><input type="time" value={form.lunchStart} onChange={e => setForm({ ...form, lunchStart: e.target.value })} className="w-full p-2 border rounded-lg" /></div><div><label className="block text-xs text-gray-500 mb-1">Break End</label><input type="time" value={form.lunchEnd} onChange={e => setForm({ ...form, lunchEnd: e.target.value })} className="w-full p-2 border rounded-lg" /></div></div>}
      </div>
    </Modal>
  )
}

function UserModal({ user, onClose, onSave }: { user: User | null; onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState({ name: user?.name || '', username: user?.username || '', email: user?.email || '', password: '', role: user?.role || 'staff' })
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!form.name.trim() || !form.username.trim()) return
    if (!user && !form.password) return
    setLoading(true)
    try {
      const data: any = { name: form.name, email: form.email, role: form.role }
      if (form.password) data.password = form.password
      if (!user) data.username = form.username
      await onSave(data)
    } catch (e) { }
    setLoading(false)
  }

  return (
    <Modal title={user ? 'Edit User' : 'Add User'} onClose={onClose} footer={<><button onClick={onClose} className="flex-1 py-3 border rounded-lg font-semibold hover:bg-gray-100">Cancel</button><button onClick={handleSave} disabled={loading} className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">{loading ? 'Saving...' : 'Save'}</button></>}>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Full Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. John Doe" className="w-full p-3 border rounded-lg bg-gray-50" /></div>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Username *</label><input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} disabled={!!user} placeholder="e.g. johndoe" className="w-full p-3 border rounded-lg bg-gray-50 disabled:opacity-50" /></div>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" className="w-full p-3 border rounded-lg bg-gray-50" /></div>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">{user ? 'Password' : 'Password *'}</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={user ? 'Leave blank to keep current' : 'Enter password'} className="w-full p-3 border rounded-lg bg-gray-50" /></div>
      <div><label className="block text-xs font-semibold text-gray-600 mb-1">Role</label><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full p-3 border rounded-lg bg-gray-50"><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
    </Modal>
  )
}

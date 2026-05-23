import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  )
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }
  return { theme, toggle }
}

const RECOMMENDATION_COLORS: Record<string, string> = {
  'Strong candidate': 'tag-green',
  'Potential candidate': 'tag-blue',
  'Needs review': 'tag-yellow',
  'Not recommended': 'tag-red',
}

const STATUS_COLORS: Record<string, string> = {
  in_progress: 'tag-yellow',
  completed: 'tag-blue',
  analyzing: 'tag-blue',
  analyzed: 'tag-green',
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [company, setCompany] = useState<any>(null)
  const [roles, setRoles] = useState<any[]>([])
  const [candidates, setCandidates] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'roles' | 'candidates'>('roles')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const c = await api.getMyCompany()
      if (!c) { navigate('/onboarding'); return }
      setCompany(c)
      const [r, cands] = await Promise.all([api.listRoles(), api.listCandidates()])
      setRoles(r)
      setCandidates(cands)
    } catch {
      navigate('/onboarding')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/interview/${slug}`)
  }

  const deleteRole = async (id: string) => {
    if (!confirm('Delete this role?')) return
    await api.deleteRole(id)
    setRoles(r => r.filter(x => x.id !== id))
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-logo">Charlie<span className="logo-dot">.</span></div>
        <nav>
          <button className={`nav-item ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => setActiveTab('roles')}>
            Roles
          </button>
          <button className={`nav-item ${activeTab === 'candidates' ? 'active' : ''}`} onClick={() => setActiveTab('candidates')}>
            Candidates
          </button>
        </nav>
        <div className="sidebar-footer">
          <span className="user-email">{user?.email}</span>
          <button className="btn-theme" onClick={toggle}>
            {theme === 'dark'
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button className="btn-ghost" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <main className="main-content">
        {activeTab === 'roles' && (
          <>
            <div className="page-header">
              <div>
                <h1>{company?.name}</h1>
                <p className="subtitle">{roles.length} active role{roles.length !== 1 ? 's' : ''}</p>
              </div>
              <Link to="/roles/new" className="btn-primary">New role</Link>
            </div>

            {roles.length === 0 ? (
              <div className="empty-state">
                <p>No roles yet. Create your first role to start interviewing candidates.</p>
                <Link to="/roles/new" className="btn-primary">Create role</Link>
              </div>
            ) : (
              <div className="role-grid">
                {roles.map(role => (
                  <div key={role.id} className="role-card">
                    <div className="role-card-header">
                      <h3>{role.title}</h3>
                      <span className="tag tag-neutral">{role.tone}</span>
                    </div>
                    <p className="role-desc">{role.description}</p>
                    <div className="role-focus">
                      {(role.evaluation_focus || []).map((f: string) => (
                        <span key={f} className="tag tag-neutral">{f}</span>
                      ))}
                    </div>
                    <div className="role-card-footer">
                      <button className="btn-copy" onClick={() => copyLink(role.slug)}>
                        Copy interview link
                      </button>
                      <button className="btn-ghost-sm" onClick={() => deleteRole(role.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'candidates' && (
          <>
            <div className="page-header">
              <div>
                <h1>Candidates</h1>
                <p className="subtitle">{candidates.length} interview{candidates.length !== 1 ? 's' : ''} completed</p>
              </div>
            </div>

            {candidates.length === 0 ? (
              <div className="empty-state">
                <p>No candidates yet. Share an interview link to get started.</p>
              </div>
            ) : (
              <table className="candidates-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Recommendation</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div className="candidate-name">{c.candidate_name}</div>
                        <div className="candidate-email">{c.candidate_email}</div>
                      </td>
                      <td>{c.roles?.title}</td>
                      <td>
                        <span className={`tag ${STATUS_COLORS[c.status] || 'tag-neutral'}`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {c.reports?.[0]?.recommendation ? (
                          <span className={`tag ${RECOMMENDATION_COLORS[c.reports[0].recommendation] || 'tag-neutral'}`}>
                            {c.reports[0].recommendation}
                          </span>
                        ) : (
                          <span className="tag tag-neutral">Pending</span>
                        )}
                      </td>
                      <td>
                        {c.status === 'analyzed' && (
                          <Link to={`/candidates/${c.id}`} className="btn-ghost-sm">View report</Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </main>
    </div>
  )
}

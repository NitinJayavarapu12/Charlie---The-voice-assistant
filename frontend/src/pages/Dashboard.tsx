import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

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

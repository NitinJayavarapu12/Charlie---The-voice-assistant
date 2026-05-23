import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL

async function getHeaders(): Promise<Record<string, string>> {
  const session = await supabase.auth.getSession()
  const token = session.data.session?.access_token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...(options.headers as Record<string, string> || {}) } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  // Companies
  getMyCompany: () => request<any>('/companies/me'),
  createCompany: (data: { name: string; website?: string; description?: string }) =>
    request<any>('/companies/', { method: 'POST', body: JSON.stringify(data) }),
  updateCompany: (data: Partial<{ name: string; website: string; description: string }>) =>
    request<any>('/companies/me', { method: 'PATCH', body: JSON.stringify(data) }),

  // Roles
  listRoles: () => request<any[]>('/roles/'),
  createRole: (data: { title: string; description: string; evaluation_focus: string[]; tone: string }) =>
    request<any>('/roles/', { method: 'POST', body: JSON.stringify(data) }),
  getRole: (id: string) => request<any>(`/roles/${id}`),
  deleteRole: (id: string) => request<any>(`/roles/${id}`, { method: 'DELETE' }),

  // Public interview
  getInterviewBySlug: (slug: string) =>
    fetch(`${API_URL}/interview/${slug}`).then(r => r.ok ? r.json() : Promise.reject(new Error('Not found'))),
  startInterview: (slug: string, data: { candidate_name: string; candidate_email: string }) =>
    fetch(`${API_URL}/interview/${slug}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async r => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({ detail: r.statusText }))
        const err: any = new Error(body.detail || 'Request failed')
        err.status = r.status
        throw err
      }
      return r.json()
    }),
  updateInterviewSession: (interviewId: string, vapiCallId?: string) =>
    fetch(`${API_URL}/interview/session/${interviewId}${vapiCallId ? `?vapi_call_id=${vapiCallId}` : ''}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    }).then(r => r.json()),

  // Candidates (authed)
  listCandidates: (roleId?: string) =>
    request<any[]>(`/candidates${roleId ? `?role_id=${roleId}` : ''}`),

  // Reports (authed)
  getReport: (interviewId: string) => request<any>(`/reports/${interviewId}`),
}

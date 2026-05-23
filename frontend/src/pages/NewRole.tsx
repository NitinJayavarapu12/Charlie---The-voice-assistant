import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'

const FOCUS_OPTIONS = [
  { value: 'communication', label: 'Communication' },
  { value: 'seriousness', label: 'Seriousness' },
  { value: 'professionalism', label: 'Professionalism' },
  { value: 'adaptability', label: 'Adaptability' },
  { value: 'reliability', label: 'Reliability' },
]

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional', desc: 'Formal and structured' },
  { value: 'conversational', label: 'Conversational', desc: 'Friendly and natural' },
  { value: 'challenging', label: 'Challenging', desc: 'Probes deeply, pushes back' },
]

export default function NewRole() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '',
    description: '',
    evaluation_focus: ['communication', 'professionalism'] as string[],
    tone: 'professional',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleFocus = (val: string) => {
    setForm(f => ({
      ...f,
      evaluation_focus: f.evaluation_focus.includes(val)
        ? f.evaluation_focus.filter(x => x !== val)
        : [...f.evaluation_focus, val],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || form.evaluation_focus.length === 0) return
    setLoading(true)
    setError('')
    try {
      await api.createRole(form)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="new-role-page">
      <div className="new-role-card">
        <div className="card-nav">
          <Link to="/dashboard" className="back-link">← Dashboard</Link>
        </div>
        <h1>Create a role</h1>
        <p className="subtitle">Charlie will conduct first-round interviews for this position.</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Job title *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Sales Development Representative"
              required
            />
          </div>

          <div className="field">
            <label>Role description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of the role and what you're looking for..."
              rows={4}
            />
          </div>

          <div className="field">
            <label>What to evaluate *</label>
            <div className="checkbox-group">
              {FOCUS_OPTIONS.map(opt => (
                <label key={opt.value} className={`checkbox-item ${form.evaluation_focus.includes(opt.value) ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={form.evaluation_focus.includes(opt.value)}
                    onChange={() => toggleFocus(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Interview tone *</label>
            <div className="tone-group">
              {TONE_OPTIONS.map(opt => (
                <label key={opt.value} className={`tone-item ${form.tone === opt.value ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="tone"
                    value={opt.value}
                    checked={form.tone === opt.value}
                    onChange={() => setForm(f => ({ ...f, tone: opt.value }))}
                  />
                  <div>
                    <strong>{opt.label}</strong>
                    <span>{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create role'}
          </button>
        </form>
      </div>
    </div>
  )
}

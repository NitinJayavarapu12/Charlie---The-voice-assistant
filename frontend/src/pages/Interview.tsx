import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import VapiSDK from '@vapi-ai/web'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Vapi = (VapiSDK as any).default ?? VapiSDK
import { api } from '../lib/api'

type Stage = 'loading' | 'register' | 'ready' | 'connecting' | 'live' | 'done' | 'error'

const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY
const VAPI_ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID

export default function Interview() {
  const { slug } = useParams<{ slug: string }>()
  const [stage, setStage] = useState<Stage>('loading')
  const [role, setRole] = useState<any>(null)
  const [form, setForm] = useState({ candidate_name: '', candidate_email: '' })
  const [interviewId, setInterviewId] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(0)
  const vapiRef = useRef<typeof Vapi | null>(null)

  useEffect(() => {
    api.getInterviewBySlug(slug!)
      .then(data => { setRole(data); setStage('register') })
      .catch(() => setStage('error'))
  }, [slug])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.candidate_name.trim() || !form.candidate_email.trim()) return
    const interview = await api.startInterview(slug!, form)
    setInterviewId(interview.id)
    setStage('ready')
  }

  const startCall = async () => {
    setStage('connecting')
    const vapi = new Vapi(VAPI_PUBLIC_KEY)
    vapiRef.current = vapi

    vapi.on('call-start', () => setStage('live'))
    vapi.on('volume-level', (v: number) => setVolume(v))
    vapi.on('call-end', async () => {
      const callId = (vapi as any).callId || null
      if (interviewId) {
        await api.updateInterviewSession(interviewId, callId)
      }
      setStage('done')
    })
    vapi.on('error', () => setStage('error'))

    const jdContext = role?.description?.trim()
      ? `Job description for this role:\n${role.description}\n\nUse the job description to identify key technical skills, tools, and domain areas. Open the interview with a technical question that probes one of these areas.`
      : `Open the interview with a technical question appropriate for a ${role?.title || 'software'} role.`

    await vapi.start(VAPI_ASSISTANT_ID, {
      variableValues: {
        role_title: role?.title || '',
        company_name: role?.companies?.name || '',
        tone: role?.tone || 'professional',
        evaluation_focus: (role?.evaluation_focus || []).join(', '),
        jd_context: jdContext,
      },
      silenceTimeoutSeconds: 30,
    })
  }

  const endCall = () => {
    vapiRef.current?.stop()
  }

  const toggleMute = () => {
    if (!vapiRef.current) return
    vapiRef.current.setMuted(!isMuted)
    setIsMuted(m => !m)
  }

  if (stage === 'loading') {
    return (
      <div className="interview-page">
        <div className="loading-screen"><div className="spinner" /></div>
      </div>
    )
  }

  if (stage === 'error') {
    return (
      <div className="interview-page">
        <div className="interview-card">
          <h2>Interview not found</h2>
          <p>This link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  if (stage === 'done') {
    return (
      <div className="interview-page">
        <div className="interview-card done-card">
          <div className="done-icon">✓</div>
          <h2>Interview complete</h2>
          <p>Thank you, {form.candidate_name}. Your interview has been recorded and will be reviewed shortly.</p>
          <p className="done-sub">You can close this tab.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="interview-page">
      <div className="interview-card">
        <div className="company-header">
          <div className="company-avatar">{role?.companies?.name?.[0] || 'C'}</div>
          <div>
            <h3>{role?.companies?.name}</h3>
            <p>{role?.title}</p>
          </div>
        </div>

        {stage === 'register' && (
          <>
            <div className="role-info">
              <p>{role?.description || 'Please complete this voice interview to apply for this position.'}</p>
              <div className="role-tags">
                {(role?.evaluation_focus || []).map((f: string) => (
                  <span key={f} className="tag tag-neutral">{f}</span>
                ))}
              </div>
            </div>
            <form onSubmit={handleRegister} className="register-form">
              <h4>Your details</h4>
              <div className="field">
                <label>Full name</label>
                <input
                  value={form.candidate_name}
                  onChange={e => setForm(f => ({ ...f, candidate_name: e.target.value }))}
                  placeholder="Jane Smith"
                  required
                />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.candidate_email}
                  onChange={e => setForm(f => ({ ...f, candidate_email: e.target.value }))}
                  placeholder="jane@example.com"
                  required
                />
              </div>
              <button type="submit" className="btn-primary">Continue</button>
            </form>
          </>
        )}

        {stage === 'ready' && (
          <div className="ready-stage">
            <div className="interview-tips">
              <h4>Before you start</h4>
              <ul>
                <li>Find a quiet place with good microphone access</li>
                <li>The interview takes approximately 5–10 minutes</li>
                <li>Speak clearly and take your time</li>
              </ul>
            </div>
            <button className="btn-start" onClick={startCall}>
              Start Interview
            </button>
          </div>
        )}

        {(stage === 'connecting' || stage === 'live') && (
          <div className="live-stage">
            <div className={`voice-orb ${stage === 'live' ? 'active' : 'connecting'}`}
              style={{ '--volume': volume } as React.CSSProperties}>
              <div className="orb-ring" />
              <div className="orb-ring ring-2" />
              <div className="orb-core">
                {stage === 'connecting' ? '...' : 'AI'}
              </div>
            </div>
            <p className="live-status">
              {stage === 'connecting' ? 'Connecting...' : 'Interview in progress'}
            </p>
            <div className="call-controls">
              <button className={`btn-control ${isMuted ? 'muted' : ''}`} onClick={toggleMute}>
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button className="btn-end" onClick={endCall}>End interview</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
import VapiSDK from '@vapi-ai/web'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Vapi = (VapiSDK as any).default ?? VapiSDK
import { api } from '../lib/api'

type Stage = 'loading' | 'auth' | 'register' | 'ready' | 'connecting' | 'live' | 'done' | 'error' | 'blocked'

const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY
const VAPI_ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID

export default function Interview() {
  const { slug } = useParams<{ slug: string }>()
  const { theme, toggle } = useTheme()
  const [stage, setStage] = useState<Stage>('loading')
  const [role, setRole] = useState<any>(null)
  const [form, setForm] = useState({ candidate_name: '', candidate_email: '' })
  const [interviewId, setInterviewId] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(0)
  const vapiRef = useRef<typeof Vapi | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const [data, { data: { session } }] = await Promise.all([
          api.getInterviewBySlug(slug!),
          supabase.auth.getSession(),
        ])
        setRole(data)

        if (!session) {
          setStage('auth')
          return
        }

        setForm({
          candidate_name: session.user.user_metadata?.full_name || '',
          candidate_email: session.user.email || '',
        })

        if (localStorage.getItem(`charlie_interview_done_${slug}`)) {
          setStage('blocked')
          return
        }

        setStage('register')
      } catch {
        setStage('error')
      }
    }
    init()
  }, [slug])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.candidate_name.trim() || !form.candidate_email.trim()) return
    try {
      const interview = await api.startInterview(slug!, form)
      setInterviewId(interview.id)
      setStage('ready')
    } catch (err: any) {
      if (err?.status === 409 || err?.message?.includes('already_completed')) {
        setStage('blocked')
      } else {
        setStage('error')
      }
    }
  }

  const startCall = async () => {
    setStage('connecting')
    const vapi = new Vapi(VAPI_PUBLIC_KEY)
    vapiRef.current = vapi

    let vapiCallId: string | undefined

    vapi.on('call-start', async () => {
      setStage('live')
      const callId = (vapi as any).call?.id || (vapi as any).callId
      if (callId && interviewId) {
        vapiCallId = callId
        await api.saveCallId(interviewId, callId)
      }
    })
    vapi.on('volume-level', (v: number) => setVolume(v))

    vapi.on('call-end', async () => {
      if (interviewId) {
        await api.updateInterviewSession(interviewId, vapiCallId)
      }
      localStorage.setItem(`charlie_interview_done_${slug}`, form.candidate_email)
      setStage('done')
    })
    vapi.on('error', () => setStage('error'))

    const jdContext = role?.description?.trim()
      ? `Job description for this role:\n${role.description}\n\nUse the job description to identify key technical skills, tools, and domain areas. Open the interview with a technical question that probes one of these areas.`
      : `Open the interview with a technical question appropriate for a ${role?.title || 'software'} role.`

    const call = await vapi.start(VAPI_ASSISTANT_ID, {
      variableValues: {
        role_title: role?.title || '',
        company_name: role?.companies?.name || '',
        tone: role?.tone || 'professional',
        evaluation_focus: (role?.evaluation_focus || []).join(', '),
        jd_context: jdContext,
      },
      silenceTimeoutSeconds: 30,
    })
    vapiCallId = (call as any)?.id || undefined
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

  if (stage === 'blocked') {
    return (
      <div className="interview-page">
        <div className="interview-card done-card">
          <div className="done-icon">✓</div>
          <h2>Already completed</h2>
          <p>You've already completed this interview. Each candidate can only attempt it once.</p>
          <p className="done-sub">You can close this tab.</p>
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
          <div style={{ flex: 1 }}>
            <h3>{role?.companies?.name}</h3>
            <p>{role?.title}</p>
          </div>
          <button className="btn-theme" onClick={toggle} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark'
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
        </div>

        {stage === 'auth' && (
          <div className="ready-stage">
            <p style={{ textAlign: 'center', marginBottom: '8px' }}>
              Sign in to continue with your interview.
            </p>
            <button className="btn-google" onClick={signInWithGoogle}>
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>
        )}

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
                  readOnly
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
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

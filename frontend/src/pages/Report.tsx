import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'

const RECOMMENDATION_COLORS: Record<string, string> = {
  'Strong candidate': 'tag-green',
  'Potential candidate': 'tag-blue',
  'Needs review': 'tag-yellow',
  'Not recommended': 'tag-red',
}

export default function Report() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<any>(null)
  const [showTranscript, setShowTranscript] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getReport(id!)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!data) return <div className="loading-screen"><p>Report not found.</p></div>

  const { interview, report, transcript } = data

  return (
    <div className="report-page">
      <div className="report-header">
        <Link to="/dashboard" className="back-link">← Candidates</Link>
        <div className="report-title-row">
          <div>
            <h1>{interview?.candidate_name}</h1>
            <p className="subtitle">Applied for <strong>{interview?.roles?.title}</strong></p>
          </div>
          {report?.recommendation && (
            <span className={`tag tag-lg ${RECOMMENDATION_COLORS[report.recommendation] || 'tag-neutral'}`}>
              {report.recommendation}
            </span>
          )}
        </div>
      </div>

      <div className="report-body">
        {!report ? (
          <div className="report-pending">
            <div className="spinner" />
            <p>Analysis in progress. Refresh in a moment.</p>
          </div>
        ) : (
          <>
            <section className="report-section">
              <h2>Summary</h2>
              <p>{report.summary}</p>
            </section>

            <div className="report-two-col">
              <section className="report-section">
                <h2>Strengths</h2>
                <ul className="insight-list">
                  {(report.strengths || []).map((s: string, i: number) => (
                    <li key={i} className="insight-item strength">{s}</li>
                  ))}
                </ul>
              </section>

              <section className="report-section">
                <h2>Areas to probe</h2>
                <ul className="insight-list">
                  {(report.weaknesses || []).map((w: string, i: number) => (
                    <li key={i} className="insight-item weakness">{w}</li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="report-section">
              <h2>Behavioral insights</h2>
              <p>{report.behavioral_insights}</p>
            </section>

            {report.skill_scores && Object.keys(report.skill_scores).length > 0 && (
              <section className="report-section">
                <h2>Skill scores</h2>
                <div className="skill-scores">
                  {Object.entries(report.skill_scores).map(([skill, score]: [string, any]) => (
                    <div key={skill} className="skill-row">
                      <span className="skill-name">{skill}</span>
                      <div className="skill-bar">
                        {[1, 2, 3, 4, 5].map(n => (
                          <div key={n} className={`skill-pip ${n <= score ? 'filled' : ''}`} />
                        ))}
                      </div>
                      <span className="skill-score-label">{score}/5</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(report.questions_and_answers || []).length > 0 && (
              <section className="report-section">
                <h2>Interview breakdown</h2>
                <div className="qa-list">
                  {report.questions_and_answers.map((qa: any, i: number) => (
                    <div key={i} className="qa-item">
                      <div className="qa-question">{qa.question}</div>
                      <div className="qa-answer">{qa.answer_summary}</div>
                      <div className="qa-score">{qa.score}/5</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {transcript && (
              <section className="report-section">
                <button
                  className="transcript-toggle"
                  onClick={() => setShowTranscript(t => !t)}
                >
                  {showTranscript ? 'Hide' : 'Show'} transcript
                </button>
                {showTranscript && (
                  <pre className="transcript-body">{transcript}</pre>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../context/SessionContext'
import { wc } from './wcApi'
import Start, { btn, btnGhost } from './Start'
import QuestionDecode from './QuestionDecode'
import WriteStep from './WriteStep'
import UploadStep from './UploadStep'
import EditPass from './EditPass'
import ConfirmStep from './ConfirmStep'
import Report from './Report'
import WrapUp from './WrapUp'
import History from './History'

const ACTIVE_KEY = 'mathBuddy.wc.activeSession'

function rememberActive(id) {
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id)
    else window.localStorage.removeItem(ACTIVE_KEY)
  } catch {
    // storage unavailable: the session just won't resume after a refresh
  }
}

function recallActive() {
  try {
    return window.localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

/** Where an unfinished session should pick up, from what is already saved. */
export function stepFromReport(report) {
  const { session, submissions } = report
  const { draft, rewrite } = submissions
  if (session.status === 'done') return null
  if (rewrite) {
    if (rewrite.review) return { step: 'report', kind: 'rewrite' }
    return rewrite.confirmed
      ? { step: 'review', kind: 'rewrite', submission: rewrite }
      : { step: 'confirm', kind: 'rewrite', submission: rewrite }
  }
  if (draft) {
    if (draft.review) return { step: 'report', kind: 'draft' }
    return draft.confirmed
      ? { step: 'review', kind: 'draft', submission: draft }
      : { step: 'confirm', kind: 'draft', submission: draft }
  }
  return { step: 'question', kind: 'draft' }
}

function BackBar({ onBack, label = 'Back' }) {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <span aria-hidden="true">←</span> {label}
      </button>
    </div>
  )
}

export default function WritingCoach() {
  const { state, navigateTo } = useSession()
  const profile = state.profile
  const profileId = profile?.id

  const [step, setStep] = useState('loading')
  const [reminder, setReminder] = useState(null)
  const [session, setSession] = useState(null)
  const [kind, setKind] = useState('draft')
  const [report, setReport] = useState(null)
  const [submission, setSubmission] = useState(null) // { id, transcript }
  const [images, setImages] = useState(null) // browser only; never stored
  const [model, setModel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(async (fn) => {
    setBusy(true)
    setError(null)
    try {
      return await fn()
    } catch (err) {
      setError(err.message)
      return undefined
    } finally {
      setBusy(false)
    }
  }, [])

  const refreshReport = useCallback(
    async (sessionId) => {
      const r = await wc.report(profileId, sessionId)
      setReport(r)
      setSession(r.session)
      return r
    },
    [profileId]
  )

  const reviewSubmission = useCallback(
    async (submissionId, sessionId, nextKind) => {
      await wc.review(profileId, submissionId)
      await refreshReport(sessionId)
      setKind(nextKind)
      setStep('report')
    },
    [profileId, refreshReport]
  )

  // Load the reminder, and resume an unfinished session after a refresh.
  useEffect(() => {
    if (!profileId || profile.grade !== '7') return
    let cancelled = false
    ;(async () => {
      try {
        const rem = await wc.reminder(profileId)
        if (cancelled) return
        setReminder(rem)
        const activeId = recallActive()
        if (activeId) {
          try {
            const r = await wc.report(profileId, activeId)
            const resume = stepFromReport(r)
            if (cancelled) return
            if (resume) {
              setReport(r)
              setSession(r.session)
              setKind(resume.kind)
              if (resume.submission) setSubmission({ id: resume.submission.id, transcript: resume.submission.confirmed || resume.submission.original })
              if (resume.step === 'review') {
                setStep('reviewing')
                await reviewSubmission(resume.submission.id, activeId, resume.kind)
              } else {
                setStep(resume.step)
              }
              return
            }
          } catch {
            // the saved session is gone or not ours: start fresh
          }
          rememberActive(null)
        }
        if (!cancelled) setStep('start')
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setStep('start')
        }
      }
    })()
    return () => { cancelled = true }
  }, [profileId, profile?.grade, reviewSubmission])

  if (!profile || profile.grade !== '7') {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="text-ink-soft">Writing Coach is for grade 7. Pick your profile in Math Buddy first.</p>
        <button type="button" className={`${btn} mt-6`} onClick={() => navigateTo('home')}>Back to Math Buddy</button>
      </div>
    )
  }

  const errorBanner = error && (
    <div role="alert" className="mx-auto max-w-3xl px-6 pt-6 text-destructive">{error}</div>
  )

  async function begin(subject, schoolQuestion) {
    const s = await run(() => wc.createSession(profileId, { subject, school_question: schoolQuestion || null }))
    if (!s) return
    rememberActive(s.id)
    setSession(s)
    setReport(null)
    setKind('draft')
    setImages(null)
    setModel(null)
    setStep('question')
  }

  async function readPhotos(imgs) {
    const res = await run(() => wc.read(profileId, session.id, kind, imgs))
    if (!res) return
    setImages(imgs)
    setSubmission({ id: res.submission_id, transcript: res.transcript })
    setStep('confirm')
  }

  async function confirmText(text) {
    await run(async () => {
      await wc.confirm(profileId, submission.id, text)
      setStep('reviewing')
      await reviewSubmission(submission.id, session.id, kind)
    })
    // a failed review leaves the confirm step so he can try again
    setStep((s) => (s === 'reviewing' ? 'confirm' : s))
  }

  async function openModel() {
    const m = await run(() => wc.modelAnswer(profileId, session.id))
    if (!m) return
    setModel(m)
    setStep('wrapup')
  }

  async function finish(body) {
    const done = await run(() => wc.finish(profileId, session.id, body))
    if (!done) return
    rememberActive(null)
    await run(async () => {
      await refreshReport(session.id)
      setReminder(await wc.reminder(profileId)) // so the next reminder shows the goal he just set
    })
    setStep('done')
  }

  const feedback = report?.submissions.draft?.review

  switch (step) {
    case 'loading':
      return <p className="px-6 py-16 text-center text-ink-soft">Loading Writing Coach…</p>
    case 'start':
      return (
        <>
          <BackBar label="Back to Math Buddy" onBack={() => navigateTo('practice')} />
          {errorBanner}
          {reminder && (
            <Start reminder={reminder} busy={busy} onBegin={begin} onHistory={() => setStep('history')} />
          )}
        </>
      )
    case 'history':
      return (
        <History profileId={profileId} onBack={() => setStep('start')} onNew={() => setStep('start')} />
      )
    case 'question':
      return (
        <>
          <BackBar onBack={() => { setError(null); setStep('start') }} />
          {errorBanner}
          <QuestionDecode
            session={session}
            busy={busy}
            decodeResult={session.decode}
            onDecode={async (body) => {
              const res = await run(() => wc.decode(profileId, session.id, body))
              if (res) setSession((s) => ({ ...s, decode: res }))
            }}
            onContinue={() => setStep('write')}
          />
        </>
      )
    case 'write':
      return (
        <>
          <BackBar
            label={kind === 'rewrite' ? 'Back to my draft report' : 'Back'}
            onBack={() => {
              if (kind === 'rewrite') { setKind('draft'); setStep('report') } else setStep('question')
            }}
          />
          <WriteStep
            key={kind}
            session={session}
            kind={kind}
            feedback={kind === 'rewrite' ? feedback : null}
            onDone={() => setStep('edit')}
          />
        </>
      )
    case 'edit':
      return (
        <>
          <BackBar onBack={() => setStep('write')} />
          <EditPass topErrors={reminder?.top_errors} onDone={() => setStep('upload')} />
        </>
      )
    case 'upload':
      return (
        <>
          <BackBar onBack={() => { setError(null); setStep('edit') }} />
          <UploadStep
            title={kind === 'rewrite' ? 'Photograph your rewrite' : 'Photograph your answer'}
            busy={busy}
            error={error}
            onRead={readPhotos}
          />
        </>
      )
    case 'confirm':
      return (
        <>
          <BackBar label="Back to photos" onBack={() => { setError(null); setStep('upload') }} />
          <ConfirmStep
            key={submission.id}
            images={images}
            transcript={submission.transcript}
            busy={busy}
            error={error}
            onConfirm={confirmText}
          />
        </>
      )
    case 'reviewing':
      return <p className="px-6 py-16 text-center text-ink-soft" role="status">Marking your answer…</p>
    case 'report':
      return (
        <>
        {kind === 'rewrite' && (
          <BackBar label="Back to my draft report" onBack={() => setKind('draft')} />
        )}
        <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
          <header>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              / Your {kind === 'rewrite' ? 'rewrite' : 'draft'} report
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold text-ink">How you did</h1>
          </header>
          <Report report={report} kind={kind} />
          {errorBanner}
          <div className="flex flex-wrap gap-3">
            {kind === 'draft' && (
              <button type="button" className={btn} onClick={() => { setKind('rewrite'); setImages(null); setStep('write') }}>
                Rewrite it one level higher
              </button>
            )}
            <button type="button" className={kind === 'draft' ? btnGhost : btn} disabled={busy} onClick={openModel}>
              See the model answer
            </button>
          </div>
        </div>
        </>
      )
    case 'wrapup':
      return (
        <>
          <BackBar
            label="Back to my report"
            onBack={() => {
              setError(null)
              setKind(report?.submissions.rewrite?.review ? 'rewrite' : 'draft')
              setStep('report')
            }}
          />
          <WrapUp model={model} busy={busy} error={error} onFinish={finish} />
        </>
      )
    case 'done': {
      const d = report?.submissions.draft?.review
      const r = report?.submissions.rewrite?.review
      return (
        <div className="mx-auto max-w-xl px-6 py-16 text-center space-y-6">
          <h1 className="font-display text-4xl font-semibold text-ink">Practice saved</h1>
          {d && (
            <p className="text-ink-soft">
              Draft: Level {d.level} ({d.percent}%){r && ` · Rewrite: Level ${r.level} (${r.percent}%)`}
            </p>
          )}
          <div className="flex justify-center gap-3">
            <button type="button" className={btn} onClick={() => setStep('history')}>See my results</button>
            <button type="button" className={btnGhost} onClick={() => { setStep('start') }}>Done</button>
          </div>
        </div>
      )
    }
    default:
      return null
  }
}

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
import ModelAnswer from './ModelAnswer'
import History from './History'

const ACTIVE_KEY = 'mathBuddy.wc.activeSession'
const REWRITING_KEY = 'mathBuddy.wc.rewriting'

/** The practice to reopen next time, or null when nothing is pending. */
function rememberActive(id) {
  try {
    window.localStorage.removeItem(REWRITING_KEY)
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

/** He chose to rewrite a marked practice. The server only knows once he sends a photo. */
function rememberRewriting(id) {
  rememberActive(id)
  try {
    window.localStorage.setItem(REWRITING_KEY, id)
  } catch {
    // storage unavailable: a refresh just goes back to the start page
  }
}

function recallRewriting() {
  try {
    return window.localStorage.getItem(REWRITING_KEY)
  } catch {
    return null
  }
}

/**
 * Where a pending practice should pick up, or null if it is finished.
 * A practice is finished once its results are shown, whether or not he rewrites it.
 */
export function stepFromReport(report, { rewriting = false } = {}) {
  const { session, submissions } = report
  const { draft, rewrite } = submissions
  if (session.status === 'done') return null
  // An unmarked answer goes back to the check step: marking costs money and can fail,
  // so it only ever runs when he presses the button.
  if (rewrite) {
    return rewrite.review ? null : { step: 'confirm', kind: 'rewrite', submission: rewrite }
  }
  if (draft) {
    if (draft.review) return rewriting ? { step: 'write', kind: 'rewrite' } : null
    return { step: 'confirm', kind: 'draft', submission: draft }
  }
  return { step: session.decode ? 'write' : 'question', kind: 'draft' }
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
      rememberActive(null) // results shown: next time he starts fresh
      setKind(nextKind)
      setStep('report')
    },
    [profileId, refreshReport]
  )

  /** Reopen a saved practice at the right step. Returns false if it is already finished. */
  const openSession = useCallback(
    async (sessionId) => {
      const r = await wc.report(profileId, sessionId)
      const rewriting = recallRewriting() === sessionId
      const resume = stepFromReport(r, { rewriting })
      if (!resume) return false
      setReport(r)
      setSession(r.session)
      setKind(resume.kind)
      setImages(null)
      setSubmission(
        resume.submission
          ? { id: resume.submission.id, transcript: resume.submission.confirmed || resume.submission.original }
          : null
      )
      if (rewriting) rememberRewriting(sessionId)
      else rememberActive(sessionId)
      setStep(resume.step)
      return true
    },
    [profileId]
  )

  /** Back to the start page, with a fresh list of unfinished practice. */
  const goToStart = useCallback(() => {
    setError(null)
    setStep('start')
    wc.reminder(profileId).then(setReminder).catch(() => {})
  }, [profileId])

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
            if (await openSession(activeId)) return
            rememberActive(null) // already finished
          } catch (err) {
            // Only forget it if the server says it is gone. A temporary failure keeps his place.
            if (err.status === 404) rememberActive(null)
            else if (!cancelled) setError('Could not reopen your practice. Please try Continue below.')
          }
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
  }, [profileId, profile?.grade, openSession])

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
    setStep('question')
  }

  /** He chose to rewrite a marked practice, from its results or from My results. */
  function startRewrite(r) {
    rememberRewriting(r.session.id)
    setReport(r)
    setSession(r.session)
    setKind('rewrite')
    setImages(null)
    setStep('write')
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

  const feedback = report?.submissions.draft?.review
  const canRewrite = kind === 'draft' && !report?.submissions.rewrite?.review

  switch (step) {
    case 'loading':
      return <p className="px-6 py-16 text-center text-ink-soft">Loading Writing Coach…</p>
    case 'start':
      return (
        <>
          <BackBar label="Back to Math Buddy" onBack={() => navigateTo('practice')} />
          {errorBanner}
          {reminder && (
            <Start
              reminder={reminder}
              busy={busy}
              onBegin={begin}
              onHistory={() => setStep('history')}
              onContinue={(id) => run(() => openSession(id))}
            />
          )}
        </>
      )
    case 'history':
      return (
        <History profileId={profileId} onBack={goToStart} onNew={goToStart} onRewrite={startRewrite} />
      )
    case 'question':
      return (
        <>
          <BackBar onBack={() => { rememberActive(null); goToStart() }} />
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
              if (kind === 'rewrite') { rememberActive(null); setKind('draft'); setStep('report') } else setStep('question')
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
          <ModelAnswer key={report.session.id} profileId={profileId} session={report.session} />
          <div className="flex flex-wrap gap-3">
            {canRewrite && (
              <button
                type="button"
                className={btn}
                onClick={() => startRewrite(report)}
              >
                Rewrite it one level higher
              </button>
            )}
            <button type="button" className={canRewrite ? btnGhost : btn} onClick={goToStart}>New practice</button>
            <button type="button" className={btnGhost} onClick={() => setStep('history')}>My results</button>
          </div>
        </div>
        </>
      )
    default:
      return null
  }
}

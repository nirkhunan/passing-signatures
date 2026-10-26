import { useEffect, useMemo, useRef, useState } from 'react'
import Pitch from './Pitch.jsx'
import Swarm, { TriangleSwarm, PlayerSwarm } from './Swarm.jsx'
import StackedArea from './StackedArea.jsx'
import Prose from './Prose.jsx'
import { buildSlides } from '../story.js'
import { loadTeam } from '../lib/dataLoader.js'
import { CHAPTER_COLORS, CONFED_COLORS, CONFED_LABELS, codeOf, yearOf } from '../lib/theme.js'
import CountryPicker from './CountryPicker.jsx'

const FULL_SCREEN = new Set(['title', 'cta', 'lead', 'comment', 'clips'])

/** Slide-by-slide story: one persistent stage that changes with each step. */
export default function Story({ overview, people, extras, onExplore, startAt = 0 }) {
  const slides = useMemo(() => buildSlides(overview, people, extras), [overview, people, extras])
  const [i, setI] = useState(startAt)
  const [docs, setDocs] = useState({})
  const slide = slides[i]
  const touch = useRef(null)
  const [carrier, setCarrier] = useState(null)
  const [country, setCountry] = useState(null)
  const carrierId = slide.scene.kind === 'triple' ? carrier ?? slide.scene.person : null
  // Which team file a carrier slide needs for each year: the player's own team that year.
  const tripleSlug = (sc, t, who = sc.person) => people[who]?.tournaments.find((x) => x.t === t)?.slug

  const go = (d) => setI((x) => Math.max(0, Math.min(slides.length - 1, x + d)))

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, select, textarea, .ps-field')) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); go(1) }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Load the team networks this slide and its neighbours need.
  useEffect(() => {
    const need = []
    for (const s of slides.slice(Math.max(0, i - 1), i + 3)) {
      if (s.scene.kind === 'pitch') need.push([s.scene.t, s.scene.slug])
      if (s.scene.kind === 'triple') {
        const who = s === slide ? carrierId : s.scene.person
        for (const t of overview.tournaments) need.push([t.id, tripleSlug(s.scene, t.id, who)])
      }
    }
    for (const [t, slug] of need) {
      const k = `${t}/${slug}`
      if (!docs[k]) loadTeam(t, slug).then((d) => setDocs((m) => ({ ...m, [k]: d }))).catch(() => {})
    }
  }, [i, slides, carrierId])

  // Keep the last pitch on stage while the next one loads, so it glides instead of blinking.
  const lastPitch = useRef(null)
  const lastTriple = useRef({})
  const sc = slide.scene
  let pitchDoc = null
  if (sc.kind === 'pitch') {
    pitchDoc = docs[`${sc.t}/${sc.slug}`] ?? lastPitch.current
    if (docs[`${sc.t}/${sc.slug}`]) lastPitch.current = pitchDoc
  }
  // The chapter a visual slide belongs to, shown above its text.
  const chapterLabel = slides.slice(0, i + 1).reverse().find((s) => s.kicker)?.kicker

  return (
    <div
      className="story"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return
        const dx = e.changedTouches[0].clientX - touch.current
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        touch.current = null
      }}
    >
      <nav className="progress" aria-label="Story progress">
        {slides.map((s, k) => (
          <button
            key={s.id}
            className="progress-seg"
            style={{ '--seg': CHAPTER_COLORS[s.chapter] }}
            data-state={k < i ? 'done' : k === i ? 'now' : 'todo'}
            aria-label={`Go to step ${k + 1}`}
            aria-current={k === i ? 'step' : undefined}
            onClick={() => setI(k)}
          />
        ))}
      </nav>

      <header className="story-head">
        <button className="brand" onClick={() => setI(0)}>Passing Signatures</button>
        <button className="link-button" onClick={onExplore}>Skip to the explorer →</button>
      </header>

      {FULL_SCREEN.has(sc.kind) ? (
        <section key={slide.id} className={`hero ${sc.kind} fade-in`} aria-live="polite">
          {sc.kind === 'comment' && <CommentCard comment={sc.comment} />}
          {sc.kind === 'clips' && <Clips clips={sc.clips} />}
          {sc.kind === 'lead' && <p className="lead-kicker" style={{ '--seg': CHAPTER_COLORS[slide.chapter] }}>{slide.kicker}</p>}
          {slide.title && <h1 className="hero-title">{slide.title}</h1>}
          <Prose text={slide.text} className="hero-dek" />
          {sc.note && <Prose text={sc.note} className="hero-note" />}
          {sc.kind === 'title' && <button className="primary" onClick={() => go(1)}>Find out →</button>}
          {sc.kind === 'cta' && (
            <div className="hero-actions">
              <button className="primary" onClick={onExplore}>Open the explorer →</button>
              <button className="link-button" onClick={() => setI(0)}>Back to the start</button>
            </div>
          )}
          {i === 0 && <p className="hint">Use the arrows, ← → keys, or swipe.</p>}
        </section>
      ) : (
        <div className="story-body">
          <div className="caption" aria-live="polite">
            {chapterLabel && <p className="caption-kicker" style={{ '--seg': CHAPTER_COLORS[slide.chapter] }}>{chapterLabel}</p>}
            <Prose key={slide.id} text={slide.text} className="caption-text fade-in" />
            {sc.kind === 'swarm' && (
              <div className="caption-tools">
                <CountryPicker overview={overview} value={country} onChange={setCountry} />
                <ConfedKey />
              </div>
            )}
            {sc.kind === 'triple' && (
              <div className="carriers" role="group" aria-label="Choose a player">
                {sc.carriers.map((id) => {
                  const p = people[id]
                  const team = p.tournaments[p.tournaments.length - 1].team
                  return (
                    <button key={id} className={`carrier ${id === carrierId ? 'on' : ''}`} aria-pressed={id === carrierId} onClick={() => setCarrier(id)}>
                      {p.name} <small>{codeOf(team)}</small>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className="stage">
            {sc.kind === 'pitch' && pitchDoc && (
              <>
                <Pitch doc={pitchDoc} view={sc.view} ariaLabel={`${pitchDoc.team.name} passing network, ${yearOf(pitchDoc.tournament.id)}`} />
                <StageTag doc={pitchDoc} />
              </>
            )}
            {sc.kind === 'swarm' && <Swarm overview={overview} metric={sc.metric} highlight={sc.highlight} connect={sc.connect} country={country} />}
            {sc.kind === 'triangles' && <TriangleSwarm overview={overview} triangles={extras.triangles} mode={sc.mode} colour={sc.colour} focusType={sc.focusType} />}
            {sc.kind === 'area' && (
              <StackedArea
                tids={overview.tournaments.map((t) => t.id)}
                shares={extras.shares[sc.dataset]}
                order={extras.shares.order}
                focus={sc.focus}
                title={sc.title}
                ariaLabel={`Share of ${sc.dataset === 'passes' ? 'completed passes' : 'signature triangles'} by type, ${overview.tournaments.map((t) => yearOf(t.id)).join(', ')}`}
              />
            )}
            {sc.kind === 'players' && <PlayerSwarm overview={overview} players={extras.players} focusPos={sc.focusPos} medians={sc.medians} />}
            {sc.kind === 'triple' && (
              <div className="triple">
                {overview.tournaments.map((t) => {
                  const fresh = docs[`${t.id}/${tripleSlug(sc, t.id, carrierId)}`]
                  if (fresh) lastTriple.current[t.id] = fresh
                  const d = fresh ?? lastTriple.current[t.id]
                  return (
                    <div key={t.id} className="triple-cell">
                      <div className="triple-label">{yearOf(t.id)}{d && <small> {d.team.name}</small>}</div>
                      {d && <Pitch doc={d} view={{ ...sc.view, focus: carrierId }} ariaLabel={`${d.team.name} ${yearOf(t.id)}`} />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <button className="nav-arrow prev" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous step">‹</button>
      <button className="nav-arrow next" onClick={() => go(1)} disabled={i === slides.length - 1} aria-label="Next step">›</button>
    </div>
  )
}

/** The opening "comment" card (like the reference's Boomer Bob) — labelled as a composite. */
function CommentCard({ comment }) {
  return (
    <figure className="comment-card">
      <div className="comment-head">
        <span className="comment-avatar" aria-hidden="true">{comment.initials}</span>
        <div>
          <b>{comment.name}</b>
          <small>{comment.meta}</small>
        </div>
      </div>
      {comment.lines.map((l, k) => <p key={k}>{l}</p>)}
    </figure>
  )
}

/** Real news clips and a real post, quoted briefly with source + link. */
function Clips({ clips }) {
  return (
    <div className="clip-grid">
      {clips.map((c, k) => (
        <a key={k} className={`clip clip-${c.type}`} href={c.url} target="_blank" rel="noopener noreferrer" style={{ '--tilt': `${c.tilt ?? 0}deg` }}>
          {c.type === 'post' ? (
            <>
              <span className="clip-post-head"><b>{c.source}</b> <small>{c.handle} · on X</small></span>
              <span className="clip-post-text">{c.text}</span>
              <small className="clip-foot">View post ↗</small>
            </>
          ) : (
            <>
              <small className="clip-source">{c.source} · {c.date}</small>
              <span className="clip-headline">{c.headline}</span>
              {c.quote && <span className="clip-quote">“{c.quote}”</span>}
              <small className="clip-foot">Read ↗</small>
            </>
          )}
        </a>
      ))}
    </div>
  )
}

function StageTag({ doc }) {
  return (
    <div className="stage-tag">
      <span className="stage-team">{doc.team.name}</span>
      <span className="stage-year">{yearOf(doc.tournament.id)} · {doc.team.stage}</span>
    </div>
  )
}

export function ConfedKey() {
  return (
    <ul className="confed-key" aria-label="Colour key">
      {Object.entries(CONFED_LABELS).map(([k, label]) => (
        <li key={k}><span className="dot" style={{ background: CONFED_COLORS[k] }} />{label}</li>
      ))}
    </ul>
  )
}

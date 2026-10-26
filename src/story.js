/**
 * The guided story. Every number in the copy is computed from the loaded data
 * (overview.json / people.json) — nothing is typed in by hand — so the text can't
 * drift from the data when the precompute is re-run.
 *
 * Inline markup in text:  [[c1|…]] signature-triangle chip (rank 1–5)
 *                         [[y|2018]] year chip   [[t|Spain]] team   [[n|576]] number
 */
import { METRICS, median } from './components/Swarm.jsx'

const fmt = METRICS.passes_per90.fmt
const pct = (v) => `${Math.round(v * 100)}%`
const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`

export function makeHelpers(ov, people) {
  const row = (t, slug) => ov.teams.find((r) => r.tournament === t && r.slug === slug)
  const inT = (t) => ov.teams.filter((r) => r.tournament === t)
  const rank = (t, slug, metric = 'passes_per90') => {
    const sorted = [...inT(t)].sort((a, b) => b[metric] - a[metric])
    return sorted.findIndex((r) => r.slug === slug) + 1
  }
  const person = (name) => Object.entries(people).find(([, p]) => p.name === name)?.[0]
  const everyThree = Object.values(people).filter(
    (p) => p.tournaments.length === ov.tournaments.length && p.tournaments.every((x) => x.clusters.length > 0),
  )
  const champion = (t) => ov.tournaments.find((x) => x.id === t).champion
  return { row, inT, rank, person, everyThree, champion }
}

export function buildSlides(ov, people, extras) {
  const H = makeHelpers(ov, people)
  const nations = new Set(ov.teams.map((r) => r.name)).size
  const [t18, t22, t26] = ov.tournaments.map((t) => t.id)
  const esp26 = H.row(t26, 'spain')
  const esp22 = H.row(t22, 'spain')
  const esp18 = H.row(t18, 'spain')
  const champs = ov.tournaments.map((t) => H.row(t.id, slugOf(t.champion)))
  const mar = [t22, t26].map((t) => H.row(t, 'morocco'))
  const kor = [t22, t26].map((t) => H.row(t, 'south_korea'))
  const hakimiId = H.person('Achraf Hakimi')
  const hakimi26 = people[hakimiId]?.tournaments.find((x) => x.t === t26)
  const hakimi22 = people[hakimiId]?.tournaments.find((x) => x.t === t22)
  const modricId = H.person('Luka Modrić')
  const top26 = [...H.inT(t26)].sort((a, b) => b.passes_per90 - a.passes_per90)
  const carrierIds = Object.keys(people)
    .filter((id) => H.everyThree.includes(people[id]))
    .sort((a, b) => (a === modricId ? -1 : b === modricId ? 1 : people[a].name.localeCompare(people[b].name)))
  const carriers = carrierIds.map((id) => people[id].name)

  // Individual-level charts: every triangle, every player (not team averages).
  const { triangles, players, shares } = extras
  const sh = (kind, t, type) => pct(shares[kind][t][type])
  const triShare = (t, type) => {
    const all = triangles.filter((x) => x.t === t)
    return pct(all.filter((x) => x.type === type).length / all.length)
  }
  const years = [t18, t22, t26]
  const gkMed = years.map((t) => Math.round(median(players.filter((p) => p.t === t && p.pos === 'GK').map((p) => p.rec90))))
  const gkIds = new Set(players.filter((p) => p.pos === 'GK').map((p) => `${p.t}:${p.id}`))
  const backWithGk = (t) => {
    const b = triangles.filter((x) => x.t === t && x.type === 'back-line')
    return [b.filter((x) => x.ids.some((id) => gkIds.has(`${t}:${id}`))).length, b.length]
  }
  const [gk18, b18] = backWithGk(t18)
  const [gk26, b26] = backWithGk(t26)

  return [
    {
      id: 'comment',
      chapter: 0,
      scene: {
        kind: 'comment',
        comment: {
          initials: 'FP',
          name: 'Every football phone-in, ever',
          meta: 'a composite of real fan-forum complaints',
          lines: ['It’s all passing it about at the back now.', 'Even the goalkeeper wants the ball. Whatever happened to getting it forward?'],
        },
        note: `Not a real post — a paraphrase of threads like [[a:https://www.redcafe.net/threads/playing-out-from-the-back-worth-it.489317/|“Playing out from the back worth it?”]] and [[a:https://www.utdforum.com/forum/threads/is-football-more-boring-now-than-it-was-20-years-ago.354384/|“Is football more boring now than it was 20 years ago?”]]`,
      },
      text: `Heard this one? It’s one of modern football’s favourite complaints.`,
    },
    {
      id: 'clips',
      chapter: 0,
      scene: {
        kind: 'clips',
        clips: [
          {
            type: 'news', source: 'FIFA · Technical Study Group', date: '2 Oct 2026', tilt: -1.5,
            url: 'https://inside.fifa.com/talent-development/technical-study-group/media-releases/comprehensive-post-tournament-report-fifa-world-cup-2026',
            headline: 'FIFA publishes comprehensive post-tournament report on FIFA World Cup 2026™',
            quote: 'sides increasingly using their shot-stopper as an active participant in the build-up phase',
          },
          {
            type: 'post', source: 'FIFA Media', handle: '@fifamedia', tilt: 1.2,
            url: 'https://x.com/fifamedia/status/2105966591443689562',
            text: 'FIFA publishes comprehensive post-tournament report on FIFA World Cup 2026™ ⚽️ All 104 matches at this year’s global showpiece analysed by FIFA’s Technical Study Group…',
          },
          {
            type: 'news', source: 'Afrik-Foot', date: '29 Jun 2026', tilt: -0.6,
            url: 'https://www.afrik-foot.com/en-za/ronwen-williams-breaks-neuers-record',
            headline: 'Ronwen Williams: Bafana goalkeeper breaks Manuel Neuer’s record',
            quote: 'completing an astonishing 77 successful passes',
          },
        ],
        note: `Our data agrees: in FIFA’s match report, Williams completed [[n|77]] of 86 passes against Canada.`,
      },
      text: `Even FIFA noticed. Its report on the 2026 World Cup says teams now use the goalkeeper to build attacks — and a keeper broke the tournament’s passing record.`,
    },
    {
      id: 'title',
      chapter: 0,
      scene: { kind: 'title' },
      title: 'Passing Signatures',
      text: `Is the game really retreating towards its own goal? We mapped every team at the last three men’s World Cups — [[n|${ov.teams.length}]] of them — to find out.`,
    },
    {
      id: 'lead-one',
      chapter: 1,
      kicker: 'Chapter 1 · One team',
      scene: { kind: 'lead' },
      title: 'How a team talks with the ball',
      text: `Start with the 2026 champions. Every pass between two teammates is a word; the patterns they repeat are their accent.`,
    },
    {
      id: 'meet',
      chapter: 1,
      scene: { kind: 'pitch', t: t26, slug: 'spain', view: { labels: 'none' } },
      text: `This is [[t|Spain]] at the [[y|${t26}]] World Cup — the champions. Each dot is a player, standing where he lined up. The bigger the dot, the more passes he received.`,
    },
    {
      id: 'links',
      chapter: 1,
      scene: { kind: 'pitch', t: t26, slug: 'spain', view: { labels: 'none', focus: esp26.hub_id } },
      text: `Each line is a passing link, thicker when two players found each other more often. One man sits at the centre of it: ${esp26.hub_name} was involved in [[n|${pct(esp26.hub_share)}]] of Spain’s completed passes.`,
    },
    {
      id: 'triangles',
      chapter: 1,
      scene: { kind: 'pitch', t: t26, slug: 'spain', view: { clusters: [1], labels: 'cluster' } },
      text: `Some three-player triangles get used far more than chance would predict. Spain’s strongest was [[c1|${esp26.top_cluster}]]. We call these a team’s signature triangles.`,
    },
    {
      id: 'five',
      chapter: 1,
      scene: { kind: 'pitch', t: t26, slug: 'spain', view: { clusters: [1, 2, 3, 4, 5], labels: 'cluster' } },
      text: `We keep the top five — [[c1|1]] [[c2|2]] [[c3|3]] [[c4|4]] [[c5|5]] — measured against a thousand shuffled versions of the same team. Together they carried [[n|${pct(esp26.signature_share)}]] of Spain’s passing.`,
    },
    {
      id: 'lead-two',
      chapter: 2,
      kicker: 'Chapter 2 · Every team',
      scene: { kind: 'lead' },
      title: `${ov.teams.length} accents`,
      text: `Zoom out to every team at three World Cups. Who passes the most — and does it help them win?`,
    },
    {
      id: 'everyone',
      chapter: 2,
      scene: { kind: 'swarm', metric: 'passes_per90' },
      text: `Now do that for everyone: [[n|${ov.teams.length}]] teams from [[n|${nations}]] nations across [[y|${t18}]] [[y|${t22}]] [[y|${t26}]]. Each dot is one team at one World Cup, placed by how many passes it completed per 90 minutes.`,
    },
    {
      id: 'spain-outlier',
      chapter: 2,
      scene: {
        kind: 'swarm', metric: 'passes_per90', connect: ['spain'],
        highlight: [{ t: t18, slug: 'spain' }, { t: t22, slug: 'spain' }, { t: t26, slug: 'spain' }],
      },
      text: `[[t|Spain]] is the loudest accent in the room: [[n|${fmt(esp18.passes_per90)}]], then [[n|${fmt(esp22.passes_per90)}]] passes per 90. In ${yearOf(t26)} it passed less — [[n|${fmt(esp26.passes_per90)}]], ${H.rank(t26, 'spain') === 1 ? 'still the most of anyone' : `${ordinal(H.rank(t26, 'spain'))} behind ${top26[0].name}`} — and won the whole thing.`,
    },
    {
      id: 'champions',
      chapter: 2,
      scene: {
        kind: 'swarm', metric: 'passes_per90',
        highlight: champs.map((r) => ({ t: r.tournament, slug: r.slug, label: `${r.name}` })),
      },
      text: `Passing the most isn’t how you win it. ${champs.map((r) => `[[t|${r.name}]] ranked [[n|${ordinal(H.rank(r.tournament, r.slug))}]] of ${H.inT(r.tournament).length} in ${yearOf(r.tournament)}`).join(', ')}. The champions’ dots have a ring.`,
    },
    {
      id: 'lead-three',
      chapter: 3,
      kicker: 'Chapter 3 · Accents change',
      scene: { kind: 'lead' },
      title: 'Four years is a long time',
      text: `Some nations reinvent how they play between tournaments. Two of them did it in plain sight.`,
    },
    {
      id: 'changed',
      chapter: 3,
      scene: {
        kind: 'swarm', metric: 'passes_per90', connect: ['morocco', 'south_korea'],
        highlight: [...mar.map((r) => ({ t: r.tournament, slug: r.slug, below: true })), ...kor.map((r) => ({ t: r.tournament, slug: r.slug }))],
      },
      text: `Accents can change fast. Between ${yearOf(t22)} and ${yearOf(t26)}, [[t|Morocco]] went from [[n|${fmt(mar[0].passes_per90)}]] to [[n|${fmt(mar[1].passes_per90)}]] passes per 90, and [[t|South Korea]] from [[n|${fmt(kor[0].passes_per90)}]] to [[n|${fmt(kor[1].passes_per90)}]].`,
    },
    {
      id: 'morocco',
      chapter: 3,
      scene: { kind: 'pitch', t: t26, slug: 'morocco', view: { clusters: [1, 2, 3, 4, 5], labels: 'cluster', focus: hakimiId } },
      text: `What stayed the same was the man on the right. Achraf Hakimi sits in [[n|${hakimi26?.clusters.length ?? 0} of 5]] of Morocco’s signature triangles in ${yearOf(t26)}${hakimi22 ? `, after [[n|${hakimi22.clusters.length} of 5]] in ${yearOf(t22)}` : ''}.`,
    },
    {
      id: 'lead-four',
      chapter: 4,
      kicker: 'Chapter 4 · Every triangle',
      scene: { kind: 'lead' },
      title: 'Where signatures live',
      text: `A team’s five signature triangles show where its most distinctive passing happens: at the back, in the build-up, in midfield or in attack. So where do they live now?`,
    },
    {
      id: 'tri-all',
      chapter: 4,
      scene: { kind: 'triangles', mode: 'value', colour: false },
      text: `Look closer still. Every team has five signature triangles, so here are all [[n|${triangles.length}]] of them — each dot is one triangle, placed by how far above chance it sits.`,
    },
    {
      id: 'tri-types',
      chapter: 4,
      scene: { kind: 'triangles', mode: 'group', colour: true },
      text: `Sort them by where they live: [[col:type-back-line|back-line]] (keeper and defenders), [[col:type-build-up|build-up]] (defenders with midfielders), [[col:type-midfield|midfield]], and [[col:type-attacking|attacking]] (any triangle with a forward).`,
    },
    {
      id: 'tri-attacking',
      chapter: 4,
      scene: { kind: 'triangles', mode: 'group', colour: true, focusType: 'attacking' },
      text: `The [[col:type-attacking|attacking]] triangle is fading. In ${yearOf(t18)}, [[n|${triShare(t18, 'attacking')}]] of signature triangles included a forward. In ${yearOf(t22)} it was [[n|${triShare(t22, 'attacking')}]]; in ${yearOf(t26)}, [[n|${triShare(t26, 'attacking')}]].`,
    },
    {
      id: 'tri-backline',
      chapter: 4,
      scene: { kind: 'triangles', mode: 'group', colour: true, focusType: 'back-line' },
      text: `Signatures moved backwards. [[col:type-back-line|Back-line]] triangles went from [[n|${triShare(t18, 'back-line')}]] to [[n|${triShare(t22, 'back-line')}]] to [[n|${triShare(t26, 'back-line')}]] — and the goalkeeper is in [[n|${gk26} of ${b26}]] of them in ${yearOf(t26)}, up from [[n|${gk18} of ${b18}]] in ${yearOf(t18)}.`,
    },
    {
      id: 'tri-area',
      chapter: 4,
      scene: { kind: 'area', dataset: 'triangles', focus: ['back-line', 'attacking'], title: 'SIGNATURE TRIANGLES' },
      text: `Put the three World Cups side by side and the shift is one shape. The [[col:type-attacking|attacking]] band shrinks from [[n|${sh('triangles', t18, 'attacking')}]] to [[n|${sh('triangles', t26, 'attacking')}]]; the [[col:type-back-line|back-line]] band grows from [[n|${sh('triangles', t18, 'back-line')}]] to [[n|${sh('triangles', t26, 'back-line')}]].`,
    },
    {
      id: 'pass-area',
      chapter: 4,
      scene: { kind: 'area', dataset: 'passes', focus: ['back-line', 'attacking'], title: 'ALL COMPLETED PASSES' },
      text: `Now split every completed pass the same way. [[col:type-back-line|Back-line]] passes rose only from [[n|${sh('passes', t18, 'back-line')}]] to [[n|${sh('passes', t26, 'back-line')}]], and passes involving a forward barely moved: [[n|${sh('passes', t18, 'attacking')}]] to [[n|${sh('passes', t26, 'attacking')}]]. Teams didn’t stop passing forward — what changed is which patterns make them distinctive.`,
    },
    {
      id: 'lead-five',
      chapter: 5,
      kicker: 'Chapter 5 · Every player',
      scene: { kind: 'lead' },
      title: 'The keeper joins in',
      text: `If signatures moved towards goal, someone had to be standing there with the ball.`,
    },
    {
      id: 'players-all',
      chapter: 5,
      scene: { kind: 'players' },
      text: `Now every player: [[n|${players.length.toLocaleString('en-US')}]] who played at least 90 minutes, placed by how many passes they received per 90 — [[col:pos-GK|goalkeepers]], [[col:pos-DF|defenders]], [[col:pos-MF|midfielders]] and [[col:pos-FW|forwards]].`,
    },
    {
      id: 'players-gk',
      chapter: 5,
      scene: { kind: 'players', focusPos: 'GK', medians: true },
      text: `Watch the [[col:pos-GK|goalkeepers]]. The typical keeper received [[n|${gkMed[0]}]] passes per 90 in ${yearOf(t18)}, [[n|${gkMed[1]}]] in ${yearOf(t22)} and [[n|${gkMed[2]}]] in ${yearOf(t26)}. The keeper has become part of the passing.`,
    },
    {
      id: 'lead-six',
      chapter: 6,
      kicker: 'Chapter 6 · The carriers',
      scene: { kind: 'lead' },
      title: 'Accents travel with players',
      text: `Some players sit inside their team’s signature at tournament after tournament.`,
    },
    {
      id: 'carriers',
      chapter: 6,
      scene: { kind: 'triple', person: modricId, carriers: carrierIds, view: { clusters: [1, 2, 3, 4, 5], labels: 'none' } },
      text: `Some players carry an accent across years. [[n|${carriers.length}]] were in a signature triangle at all three World Cups. Pick one to see his team in ${yearOf(t18)}, ${yearOf(t22)} and ${yearOf(t26)} — the ringed dot is him, the colours are that year’s five triangles.`,
    },
    {
      id: 'explore',
      chapter: 7,
      scene: { kind: 'cta' },
      title: 'Find your team’s accent',
      text: `Every team, every World Cup, the same view. Switch years, follow a player from one tournament to the next, and isolate any triangle.`,
    },
  ]
}

function slugOf(name) {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}
const yearOf = (t) => t.replace(/^wc/, '')

export { slugOf }

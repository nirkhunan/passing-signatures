import { CHIP_COLORS, clusterColor } from '../lib/theme.js'

/**
 * Renders story text with inline chips that double as the legend:
 *   [[c1|…]] signature triangle (colour = rank)   [[col:type-attacking|…]] any keyed colour
 *   [[y|wc2018]] year   [[t|Spain]] team   [[n|576]] number   [[a:https://…|link text]]
 */
export default function Prose({ text, as: Tag = 'p', className }) {
  const parts = []
  const re = /\[\[(c[1-5]|col:[\w-]+|a:[^|\]]+|y|t|n)\|([^\]]+)\]\]/g
  let last = 0
  let m
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const [, kind, body] = m
    const k = parts.length
    if (/^c[1-5]$/.test(kind)) {
      parts.push(<span key={k} className="chip chip-cluster" style={{ '--chip': clusterColor(Number(kind[1])) }}>{body}</span>)
    } else if (kind.startsWith('col:')) {
      parts.push(<span key={k} className="chip chip-cluster" style={{ '--chip': CHIP_COLORS[kind.slice(4)] ?? '#590D22' }}>{body}</span>)
    } else if (kind.startsWith('a:')) {
      parts.push(<a key={k} href={kind.slice(2)} target="_blank" rel="noopener noreferrer">{body}</a>)
    } else if (kind === 'y') {
      parts.push(<span key={k} className="chip chip-year">{body.replace(/^wc/, '')}</span>)
    } else if (kind === 't') {
      parts.push(<strong key={k} className="chip-team">{body}</strong>)
    } else {
      parts.push(<span key={k} className="chip-num">{body}</span>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <Tag className={className}>{parts}</Tag>
}

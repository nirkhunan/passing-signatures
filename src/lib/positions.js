/**
 * Group a player into a pitch line (defense / midfield / attack) from their
 * short position code. Used by the line-filter toggles so a viewer can isolate
 * a single line's passing. (Beyond the PRD — a readability aid.)
 */

const DEFENSE = new Set(['GK', 'RB', 'RCB', 'CB', 'LCB', 'LB', 'RWB', 'LWB'])
const MIDFIELD = new Set(['RDM', 'CDM', 'LDM', 'RCM', 'CM', 'LCM', 'RM', 'LM', 'RAM', 'CAM', 'LAM'])
const ATTACK = new Set(['RW', 'LW', 'RCF', 'CF', 'LCF', 'SS', 'ST'])

/** Ordered back-to-front for UI. */
export const LINES = ['defense', 'midfield', 'attack']

/**
 * @param {string} position - short code (e.g. "CDM")
 * @returns {('defense'|'midfield'|'attack')}
 */
export function playerLine(position) {
  if (DEFENSE.has(position)) return 'defense'
  if (ATTACK.has(position)) return 'attack'
  return 'midfield' // CM-family + any unmapped code defaults to midfield
}

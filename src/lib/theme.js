/**
 * Colour + label tokens shared by the SVG views. Mirrors the CSS variables in
 * index.css so JS-drawn marks and HTML chips always match.
 *
 * Palette (user, 2026-10-13): one crimson -> blush ramp
 *   coolors.co/palette/590d22-800f2f-a4133c-c9184a-ff4d6d-ff758f-ff8fa3-ffb3c1-ffccd5-fff0f3
 * Single-hue palettes separate categories less than mixed hues, so categorical sets
 * use well-spaced steps, ordered sets follow the ramp, and every chart also labels
 * its marks (codes, names, legend chips) rather than relying on colour alone.
 */
export const P = {
  c900: '#590D22',
  c800: '#800F2F',
  c700: '#A4133C',
  c600: '#C9184A',
  c500: '#FF4D6D',
  c400: '#FF758F',
  c300: '#FF8FA3',
  c200: '#FFB3C1',
  c100: '#FFCCD5',
  c50: '#FFF0F3',
}

export const CLUSTER_COLORS = { 1: P.c900, 2: P.c500, 3: P.c700, 4: P.c300, 5: P.c600 }
export const clusterColor = (rank) => CLUSTER_COLORS[rank] ?? P.c900

export const CONFED_COLORS = {
  UEFA: P.c900,
  CONMEBOL: P.c500,
  CONCACAF: P.c200,
  CAF: P.c700,
  AFC: P.c300,
  OFC: P.c600,
}
export const CONFED_LABELS = {
  UEFA: 'Europe',
  CONMEBOL: 'South America',
  CONCACAF: 'North & Central America',
  CAF: 'Africa',
  AFC: 'Asia',
  OFC: 'Oceania',
}

/** Where a signature triangle lives — ordered from own goal (darkest) to attack. */
export const TYPE_COLORS = {
  'back-line': P.c900,
  'build-up': P.c700,
  midfield: P.c200,
  attacking: P.c500,
}
export const TYPE_LABELS = {
  'back-line': 'Back-line',
  'build-up': 'Build-up',
  midfield: 'Midfield',
  attacking: 'Attacking',
}

/** Player position (the "every player" chart); keepers get the brightest step. */
export const POS_COLORS = {
  GK: P.c500,
  DF: P.c900,
  MF: P.c200,
  FW: P.c700,
}

/** Colours the story text can use for inline legend chips: [[col:key|text]]. */
export const CHIP_COLORS = {
  ...Object.fromEntries(Object.entries(TYPE_COLORS).map(([k, v]) => [`type-${k}`, v])),
  ...Object.fromEntries(Object.entries(POS_COLORS).map(([k, v]) => [`pos-${k}`, v])),
}

export const DIRECTION_COLORS = {
  forward: P.c500,
  lateral: P.c200,
  backward: P.c900,
}

/** Progress-bar colour per chapter: intro, one team, all teams, change, triangles, players, carriers, end. */
export const CHAPTER_COLORS = [P.c900, P.c600, P.c700, P.c500, P.c800, P.c400, P.c600, P.c900]

export const INK = P.c900
export const MUTED = P.c700
export const RULE = P.c100
export const SOFT = P.c200

/** Light text on dark fills, dark text on light fills. */
export function textOn(hex) {
  const n = parseInt(hex.slice(1), 16)
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
  return lum < 140 ? P.c50 : P.c900
}

export const POS_LABEL = { GK: 'Goalkeeper', DF: 'Defender', MF: 'Midfielder', FW: 'Forward' }

/** Short year label from a tournament id ("wc2026" -> "2026"). */
export const yearOf = (tid) => tid.replace(/^wc/, '')

/** FIFA three-letter codes, so every dot can name its country. */
export const TEAM_CODES = {
  Algeria: 'ALG', Argentina: 'ARG', Australia: 'AUS', Austria: 'AUT', Belgium: 'BEL',
  'Bosnia and Herzegovina': 'BIH', Brazil: 'BRA', 'Cabo Verde': 'CPV', Cameroon: 'CMR', Canada: 'CAN',
  Colombia: 'COL', 'Congo DR': 'COD', 'Costa Rica': 'CRC', Croatia: 'CRO', 'Curaçao': 'CUW',
  Czechia: 'CZE', "Côte d'Ivoire": 'CIV', Denmark: 'DEN', Ecuador: 'ECU', Egypt: 'EGY',
  England: 'ENG', France: 'FRA', Germany: 'GER', Ghana: 'GHA', Haiti: 'HAI', Iceland: 'ISL',
  Iran: 'IRN', Iraq: 'IRQ', Japan: 'JPN', Jordan: 'JOR', Mexico: 'MEX', Morocco: 'MAR',
  Netherlands: 'NED', 'New Zealand': 'NZL', Nigeria: 'NGA', Norway: 'NOR', Panama: 'PAN',
  Paraguay: 'PAR', Peru: 'PER', Poland: 'POL', Portugal: 'POR', Qatar: 'QAT', Russia: 'RUS',
  'Saudi Arabia': 'KSA', Scotland: 'SCO', Senegal: 'SEN', Serbia: 'SRB', 'South Africa': 'RSA',
  'South Korea': 'KOR', Spain: 'ESP', Sweden: 'SWE', Switzerland: 'SUI', Tunisia: 'TUN',
  'Türkiye': 'TUR', 'United States': 'USA', Uruguay: 'URU', Uzbekistan: 'UZB', Wales: 'WAL',
}
export const codeOf = (name) => TEAM_CODES[name] ?? name.slice(0, 3).toUpperCase()

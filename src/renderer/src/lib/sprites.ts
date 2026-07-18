/**
 * 专注花园矢量插画库：树木（按树种 × 成长阶段）与装饰物。
 * 全部为手工调色的扁平插画风 SVG 字符串，配合 v-html 使用，容器控制尺寸。
 */

export type TreeStage = 'sprout' | 'young' | 'mature'

interface Palette {
  crown: string
  crownDeep: string
  crownLight: string
  trunk: string
}

const PALETTES: Record<string, Palette> = {
  evergreen: { crown: '#4E9463', crownDeep: '#3C7A50', crownLight: '#6BAE7F', trunk: '#8A6248' },
  pine: { crown: '#39795B', crownDeep: '#2C6249', crownLight: '#4E9470', trunk: '#7A5843' },
  sakura: { crown: '#EFA8C2', crownDeep: '#E289AC', crownLight: '#F7C6D8', trunk: '#7A5140' },
  palm: { crown: '#4F9E6C', crownDeep: '#3D8258', crownLight: '#69B583', trunk: '#A67B54' },
  maple: { crown: '#D97B47', crownDeep: '#C4652F', crownLight: '#E69A67', trunk: '#7A5140' },
  xmas: { crown: '#3E7D5C', crownDeep: '#2F674A', crownLight: '#529571', trunk: '#7A5843' }
}

const GOLD: Palette = { crown: '#E2B54F', crownDeep: '#C69A31', crownLight: '#F4D488', trunk: '#9A7442' }

const wrap = (inner: string): string =>
  `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`

const groundShadow = '<ellipse cx="32" cy="58.6" rx="13" ry="2.8" fill="rgba(24,44,30,0.13)"/>'

const goldenHalo =
  '<circle cx="32" cy="31" r="25" fill="#F0C75E" opacity="0.13"/><circle cx="32" cy="31" r="17" fill="#F4D488" opacity="0.15"/>'

function trunk(x: number, y: number, w: number, h: number, color: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2.4}" fill="${color}"/>`
}

/* ---------- 各树种造型 ---------- */

function evergreen(p: Palette, stage: TreeStage): string {
  if (stage === 'young') {
    return (
      trunk(30.4, 40, 3.2, 18, p.trunk) +
      `<circle cx="32" cy="34.5" r="12.5" fill="${p.crownDeep}"/>` +
      `<circle cx="32" cy="33" r="12" fill="${p.crown}"/>` +
      `<circle cx="27.6" cy="28.8" r="4" fill="${p.crownLight}" opacity="0.75"/>`
    )
  }
  return (
    trunk(30, 38, 4, 20, p.trunk) +
    `<g fill="${p.crownDeep}"><circle cx="32" cy="26.5" r="15"/><circle cx="21.5" cy="34.5" r="9.5"/><circle cx="42.5" cy="34.5" r="9.5"/></g>` +
    `<g fill="${p.crown}"><circle cx="32" cy="25" r="14.5"/><circle cx="21.8" cy="33" r="9"/><circle cx="42.2" cy="33" r="9"/></g>` +
    `<circle cx="26" cy="19.5" r="5" fill="${p.crownLight}" opacity="0.8"/>` +
    `<circle cx="20" cy="30" r="2.6" fill="${p.crownLight}" opacity="0.55"/>`
  )
}

function pine(p: Palette, stage: TreeStage): string {
  if (stage === 'young') {
    return (
      trunk(30.2, 44, 3.6, 14, p.trunk) +
      `<path d="M32 14 L44 30 H20 Z" fill="${p.crown}"/>` +
      `<path d="M32 24 L47 44 H17 Z" fill="${p.crownDeep}"/>` +
      `<path d="M32 14 L26 22 H32 Z" fill="${p.crownLight}" opacity="0.7"/>`
    )
  }
  return (
    trunk(29.8, 46, 4.4, 12, p.trunk) +
    `<path d="M32 6 L43 21 H21 Z" fill="${p.crownLight}"/>` +
    `<path d="M32 13 L46 32 H18 Z" fill="${p.crown}"/>` +
    `<path d="M32 23 L50 47 H14 Z" fill="${p.crownDeep}"/>` +
    `<path d="M32 6 L27 13 H32 Z" fill="#FFFFFF" opacity="0.28"/>`
  )
}

function sakura(p: Palette, stage: TreeStage): string {
  if (stage === 'young') {
    return (
      trunk(30.4, 40, 3.2, 18, p.trunk) +
      `<g fill="${p.crownDeep}"><circle cx="26" cy="33" r="9"/><circle cx="38" cy="33" r="9"/></g>` +
      `<g fill="${p.crown}"><circle cx="26" cy="31.6" r="8.6"/><circle cx="38" cy="31.6" r="8.6"/></g>` +
      `<circle cx="24" cy="27.5" r="3.2" fill="${p.crownLight}" opacity="0.85"/>`
    )
  }
  return (
    trunk(30, 38, 4, 20, p.trunk) +
    `<path d="M31 42 L24.5 35.5 L27 33.2 L32.6 39.4 Z" fill="${p.trunk}"/>` +
    `<g fill="${p.crownDeep}"><circle cx="32" cy="24.5" r="13.5"/><circle cx="20.5" cy="31.5" r="9.5"/><circle cx="43.5" cy="31.5" r="9.5"/></g>` +
    `<g fill="${p.crown}"><circle cx="32" cy="23" r="13"/><circle cx="21" cy="30" r="9"/><circle cx="43" cy="30" r="9"/></g>` +
    `<circle cx="26.5" cy="18" r="4.6" fill="${p.crownLight}" opacity="0.9"/>` +
    `<g fill="${p.crownDeep}" opacity="0.65"><circle cx="36.5" cy="27" r="1.5"/><circle cx="27" cy="30.5" r="1.5"/><circle cx="41" cy="33.5" r="1.4"/></g>`
  )
}

function palm(p: Palette, stage: TreeStage): string {
  const fronds = (cx: number, cy: number, s: number): string =>
    `<g fill="${p.crown}">` +
    `<path d="M${cx} ${cy} C ${cx - 6 * s} ${cy - 7 * s} ${cx - 14 * s} ${cy - 6 * s} ${cx - 17 * s} ${cy - 1 * s} C ${cx - 11 * s} ${cy - 3.4 * s} ${cx - 4 * s} ${cy - 2.4 * s} ${cx} ${cy} Z"/>` +
    `<path d="M${cx} ${cy} C ${cx + 6 * s} ${cy - 7 * s} ${cx + 14 * s} ${cy - 6 * s} ${cx + 17 * s} ${cy - 1 * s} C ${cx + 11 * s} ${cy - 3.4 * s} ${cx + 4 * s} ${cy - 2.4 * s} ${cx} ${cy} Z"/>` +
    `</g>` +
    `<g fill="${p.crownDeep}">` +
    `<path d="M${cx} ${cy} C ${cx - 3 * s} ${cy - 9 * s} ${cx - 10 * s} ${cy - 12 * s} ${cx - 15 * s} ${cy - 10 * s} C ${cx - 9 * s} ${cy - 8.4 * s} ${cx - 3 * s} ${cy - 5.4 * s} ${cx} ${cy} Z"/>` +
    `<path d="M${cx} ${cy} C ${cx + 3 * s} ${cy - 9 * s} ${cx + 10 * s} ${cy - 12 * s} ${cx + 15 * s} ${cy - 10 * s} C ${cx + 9 * s} ${cy - 8.4 * s} ${cx + 3 * s} ${cy - 5.4 * s} ${cx} ${cy} Z"/>` +
    `</g>` +
    `<path d="M${cx} ${cy} C ${cx - 1.4 * s} ${cy - 10 * s} ${cx + 1.4 * s} ${cy - 12 * s} ${cx + 0.6 * s} ${cy - 14 * s} C ${cx + 2.6 * s} ${cy - 11 * s} ${cx + 1.8 * s} ${cy - 6 * s} ${cx} ${cy} Z" fill="${p.crownLight}"/>`

  if (stage === 'young') {
    return (
      `<ellipse cx="32" cy="56" rx="9" ry="3" fill="#E3D2A7" opacity="0.7"/>` +
      `<path d="M30.6 58 C30.6 48 31.4 42 33.4 36 L36.4 37 C34.8 43 34.2 49 34.2 58 Z" fill="${p.trunk}"/>` +
      fronds(35, 36.5, 0.82)
    )
  }
  return (
    `<ellipse cx="31" cy="57" rx="11" ry="3.4" fill="#E3D2A7" opacity="0.7"/>` +
    `<path d="M29.4 58 C29.4 46 31 37 37.4 28.6 L41 30.8 C35.6 38.6 33.8 47 33.8 58 Z" fill="${p.trunk}"/>` +
    `<path d="M31.4 50 h4.2 M32.4 43 h4.2 M34 36.4 h4.2" stroke="#8F6844" stroke-width="1.3" opacity="0.6"/>` +
    fronds(39.6, 28.8, 1) +
    `<g fill="#8F6844"><circle cx="36.8" cy="31.4" r="1.9"/><circle cx="41.6" cy="32.2" r="1.9"/></g>`
  )
}

function maple(p: Palette, stage: TreeStage): string {
  if (stage === 'young') {
    return (
      trunk(30.4, 40, 3.2, 18, p.trunk) +
      `<circle cx="32" cy="34" r="12.5" fill="${p.crownDeep}"/>` +
      `<circle cx="32" cy="32.4" r="12" fill="${p.crown}"/>` +
      `<circle cx="27.6" cy="28" r="4" fill="${p.crownLight}" opacity="0.8"/>`
    )
  }
  return (
    trunk(30, 38, 4, 20, p.trunk) +
    `<g fill="${p.crownDeep}"><circle cx="32" cy="27" r="15.5"/><circle cx="21" cy="33" r="8.5"/><circle cx="43" cy="33" r="8.5"/></g>` +
    `<g fill="${p.crown}"><circle cx="32" cy="25.4" r="15"/><circle cx="21.4" cy="31.6" r="8"/><circle cx="42.6" cy="31.6" r="8"/></g>` +
    `<circle cx="26" cy="19.6" r="5" fill="${p.crownLight}" opacity="0.85"/>` +
    `<g fill="${p.crownDeep}" opacity="0.5"><circle cx="38" cy="22" r="1.6"/><circle cx="30" cy="31" r="1.6"/></g>`
  )
}

function xmas(p: Palette, stage: TreeStage): string {
  const star =
    '<path d="M32 3.4 L33.6 7 L37.4 7.5 L34.6 10 L35.3 13.8 L32 11.9 L28.7 13.8 L29.4 10 L26.6 7.5 L30.4 7 Z" fill="#E8BC4F"/>'
  const baubles = (ids: Array<[number, number, string]>): string =>
    ids.map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="${c}"/>`).join('')
  if (stage === 'young') {
    return (
      trunk(30.2, 44, 3.6, 14, p.trunk) +
      `<path d="M32 16 L44 32 H20 Z" fill="${p.crown}"/>` +
      `<path d="M32 26 L47 46 H17 Z" fill="${p.crownDeep}"/>` +
      '<path d="M32 8.4 L33.2 11.2 L36.2 11.6 L34 13.6 L34.6 16.6 L32 15 L29.4 16.6 L30 13.6 L27.8 11.6 L30.8 11.2 Z" fill="#E8BC4F"/>' +
      baubles([
        [28, 28, '#D96A6A'],
        [37, 40, '#6FA8DC']
      ])
    )
  }
  return (
    trunk(29.8, 47, 4.4, 11, p.trunk) +
    `<path d="M32 8 L43 22 H21 Z" fill="${p.crownLight}"/>` +
    `<path d="M32 15 L46 33 H18 Z" fill="${p.crown}"/>` +
    `<path d="M32 25 L50 48 H14 Z" fill="${p.crownDeep}"/>` +
    star +
    baubles([
      [27.4, 19.4, '#D96A6A'],
      [37.6, 29, '#6FA8DC'],
      [24.4, 42, '#E8BC4F'],
      [40, 43.6, '#D96A6A']
    ])
  )
}

const sproutSvg =
  '<ellipse cx="32" cy="55.5" rx="8.5" ry="3.2" fill="#C9B08A"/>' +
  '<path d="M31.1 55 C31.1 49 31.4 45.4 32 42" stroke="#6E9A5B" stroke-width="2.6" stroke-linecap="round" fill="none"/>' +
  '<path d="M32 43.6 C27 43 23.8 39.6 23.4 34.6 C28.6 35 31.8 38.4 32 43.6 Z" fill="#5E9E6F"/>' +
  '<path d="M32 42.4 C36.6 41.6 39.4 38.6 39.8 34.2 C35.2 34.8 32.4 37.8 32 42.4 Z" fill="#7FBB8C"/>'

const BUILDERS: Record<string, (p: Palette, stage: TreeStage) => string> = {
  evergreen,
  pine,
  sakura,
  palm,
  maple,
  xmas
}

/** 树 SVG：species × 阶段 × 是否金树 */
export function treeSvg(species: string, stage: TreeStage, golden = false): string {
  if (stage === 'sprout' && !golden) return wrap(groundShadow + sproutSvg)
  const builder = BUILDERS[species] ?? evergreen
  const palette = golden ? GOLD : (PALETTES[species] ?? PALETTES.evergreen)
  const body = builder(palette, stage === 'sprout' ? 'mature' : stage)
  return wrap((golden ? goldenHalo : '') + groundShadow + body)
}

/* ---------- 装饰物 ---------- */

const DECOR_SVGS: Record<string, string> = {
  lantern:
    groundShadow +
    '<rect x="25" y="52.6" width="14" height="4.4" rx="1.6" fill="#8D97A3"/>' +
    '<rect x="28.6" y="38" width="6.8" height="15" rx="2" fill="#A8B1BC"/>' +
    '<rect x="23.4" y="26" width="17.2" height="12.6" rx="2.6" fill="#B8C1CB"/>' +
    '<rect x="26.4" y="28.4" width="11.2" height="7.8" rx="1.8" fill="#F4D488"/>' +
    '<rect x="30.8" y="28.4" width="2.4" height="7.8" fill="#E3B85C" opacity="0.7"/>' +
    '<path d="M20.6 26 L32 18.4 L43.4 26 Z" fill="#77828F"/>' +
    '<circle cx="32" cy="16.4" r="2.2" fill="#8D97A3"/>',
  bench:
    groundShadow +
    '<rect x="19.4" y="43.6" width="4" height="13" rx="1.4" fill="#7A5843"/>' +
    '<rect x="40.6" y="43.6" width="4" height="13" rx="1.4" fill="#7A5843"/>' +
    '<rect x="15" y="39.4" width="34" height="5.4" rx="2.2" fill="#B08454"/>' +
    '<rect x="15" y="27" width="34" height="4.4" rx="2.2" fill="#B08454"/>' +
    '<rect x="15" y="33" width="34" height="3.4" rx="1.7" fill="#9E744A"/>' +
    '<rect x="17.6" y="27" width="3.4" height="17" rx="1.5" fill="#8A6248"/>' +
    '<rect x="43" y="27" width="3.4" height="17" rx="1.5" fill="#8A6248"/>',
  windchime:
    groundShadow.replace('58.6', '57.2') +
    '<rect x="18" y="16" width="28" height="3.6" rx="1.8" fill="#8A6248"/>' +
    '<path d="M24.5 19.6 V24 M32 19.6 V26.6 M39.5 19.6 V22.4" stroke="#B0B8C2" stroke-width="1.4"/>' +
    '<rect x="21.8" y="24" width="5.4" height="17" rx="2.4" fill="#A9C4DA"/>' +
    '<rect x="29.3" y="26.6" width="5.4" height="21" rx="2.4" fill="#BFD4E5"/>' +
    '<rect x="36.8" y="22.4" width="5.4" height="14" rx="2.4" fill="#93B4CE"/>' +
    '<path d="M32 47.6 V52" stroke="#B0B8C2" stroke-width="1.3"/>' +
    '<path d="M29.4 54.8 L32 51.4 L34.6 54.8 L32 57.4 Z" fill="#E8A8BC"/>',
  pond:
    '<ellipse cx="32" cy="43" rx="21" ry="10.5" fill="#7FA9C9"/>' +
    '<ellipse cx="32" cy="42" rx="18.4" ry="8.8" fill="#A7CBE4"/>' +
    '<path d="M20 42.6 c3 -1.6 6 -1.6 9 0" stroke="#FFFFFF" stroke-width="1.4" opacity="0.55" fill="none" stroke-linecap="round"/>' +
    '<path d="M35 45.6 c2.6 -1.3 5.2 -1.3 7.8 0" stroke="#FFFFFF" stroke-width="1.2" opacity="0.45" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="24.4" cy="39" rx="4.6" ry="2.8" fill="#5E9E6F"/>' +
    '<path d="M24.4 39 L28.6 37.6 A4.6 2.8 0 0 0 24.4 36.2 Z" fill="#7FBB8C"/>' +
    '<g fill="#EFA8C2"><path d="M38.6 36.4 L40.4 32.6 L42.2 36.4 Z"/><path d="M36.6 37.4 L38.2 34.2 L39.4 37.4 Z" opacity="0.85"/><path d="M41.4 37.4 L42.8 34.4 L44.2 37.4 Z" opacity="0.85"/></g>' +
    '<ellipse cx="40.4" cy="38" rx="4.2" ry="1.7" fill="#E289AC"/>',
  fountain:
    groundShadow +
    '<ellipse cx="32" cy="51.4" rx="17" ry="5.6" fill="#9BA5B0"/>' +
    '<ellipse cx="32" cy="49.6" rx="14.6" ry="4.6" fill="#B8C1CB"/>' +
    '<ellipse cx="32" cy="49" rx="11.6" ry="3.4" fill="#A7CBE4"/>' +
    '<rect x="29" y="36" width="6" height="12" rx="2" fill="#9BA5B0"/>' +
    '<ellipse cx="32" cy="36" rx="8.6" ry="2.8" fill="#B8C1CB"/>' +
    '<ellipse cx="32" cy="35.4" rx="6.4" ry="1.9" fill="#A7CBE4"/>' +
    '<rect x="30.9" y="22" width="2.2" height="12" rx="1.1" fill="#8FBEDF"/>' +
    '<path d="M31.9 22 C28.6 24.6 26.8 27.4 26.4 30.4 M32.1 22 C35.4 24.6 37.2 27.4 37.6 30.4" stroke="#8FBEDF" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
    '<g fill="#BFDCEF"><circle cx="25.6" cy="32" r="1.3"/><circle cx="38.4" cy="32" r="1.3"/><circle cx="32" cy="19.6" r="1.5"/></g>',
  tent:
    groundShadow +
    '<path d="M32 17 L53 54 H11 Z" fill="#D97B5A"/>' +
    '<path d="M32 17 L53 54 H42.4 L32 30.6 Z" fill="#C4674A"/>' +
    '<path d="M32 30 L40.4 54 H23.6 Z" fill="#8E4A35"/>' +
    '<path d="M32 30 L38.6 54 H32 Z" fill="#7A3E2C"/>' +
    '<path d="M30 12.4 L32 17 L34 12.4" stroke="#8E4A35" stroke-width="2" fill="none" stroke-linecap="round"/>' +
    '<path d="M32 13 h7 l-1.8 2.4 L39 17.8 h-7 Z" fill="#E8BC4F"/>'
}

/** 装饰 SVG */
export function decorSvg(kind: string): string {
  return wrap(DECOR_SVGS[kind] ?? DECOR_SVGS.lantern)
}

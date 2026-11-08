// Parseur local déterministe : texte dicté (FR) → commande structurée.
// Gratuit, instantané, hors-ligne. Sert au rendu "live" pendant que le serveur parle
// et de filet de sécurité si le LLM n'est pas disponible.

import { MENU, MENU_BY_ID, type MenuItem } from '../data/menu'
import { makeLine, mergeLines } from './order'
import type { Line, Parsed } from './types'

// ───────────── normalisation ─────────────

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, ' ')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

const stem = (t: string) => (t.length > 3 && (t.endsWith('s') || t.endsWith('x')) ? t.slice(0, -1) : t)

function lev(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m || !n) return Math.max(m, n)
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[n]
}

function tokEq(a: string, b: string): 0 | 1 | 2 {
  if (a === b) return 2
  const L = Math.min(a.length, b.length)
  if (L >= 5 && lev(a, b) <= 1) return 1
  if (L >= 9 && lev(a, b) <= 2) return 1
  return 0
}

// ───────────── nombres ─────────────

const UNITS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
}
const TENS: Record<string, number> = { vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60 }

export function parseNumber(t: string[], i: number): { value: number; len: number } | null {
  const w = t[i]
  if (w === undefined) return null
  if (/^\d+$/.test(w)) return { value: parseInt(w, 10), len: 1 }
  if (w === 'dix' && ['sept', 'huit', 'neuf'].includes(t[i + 1])) return { value: 10 + UNITS[t[i + 1]], len: 2 }
  if (w in UNITS) return { value: UNITS[w], len: 1 }
  if (w in TENS) {
    const base = TENS[w]
    if (t[i + 1] === 'et' && (t[i + 2] === 'un' || t[i + 2] === 'une')) return { value: base + 1, len: 3 }
    const u = t[i + 1]
    if (u && u in UNITS && UNITS[u] >= 2 && UNITS[u] <= 9 && base < 60) return { value: base + UNITS[u], len: 2 }
    return { value: base, len: 1 }
  }
  return null
}

// ───────────── index des alias ─────────────

interface Alias {
  tokens: string[]
  item: MenuItem
}

const ALIASES: Alias[] = (() => {
  const out: Alias[] = []
  const seen = new Set<string>()
  for (const item of MENU) {
    for (const a of [item.name, ...item.aliases]) {
      const tokens = tokenize(a).map(stem)
      if (!tokens.length) continue
      const k = item.id + '|' + tokens.join(' ')
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ tokens, item })
    }
  }
  return out.sort((a, b) => b.tokens.length - a.tokens.length)
})()

const STOP = new Set(
  ('de du des la le les l d un une et pour a au aux avec en s il plait svp merci ensuite puis aussi plus encore ' +
    'table numero n no ca ce cela donc alors bon euh ok je veux voudrais prends prend mets mettez met sur par fois ' +
    'cl centilitre litre chacun commande bonjour voila fait me nous ajoute ajouter rajoute rajouter dessert entree plat ' +
    'boisson boissons ensuite apres avant que qui c est y a ont on vous moi toi lui sa son ses leur et ou aussi tout toute ' +
    'sans pas oui non deja rien comme bien tres meme dans ici la-bas pareil').split(' '),
)

// ───────────── parseur ─────────────

interface Match {
  i: number
  end: number // exclusif
  item: MenuItem
  qty: number
  size: string | null
  cuisson: string | null
  dessert: string | null
  notes: string[]
  dropped?: boolean
}

interface Mention<T> {
  i: number
  end: number
  v: T
}

const gapBefore = (m: { end: number }, i: number) => i - m.end // mention après match
const gapAfter = (mention: { end: number }, m: { i: number }) => m.i - mention.end // mention avant match

export function parseOrder(text: string): Parsed {
  const raw = tokenize(text)
  const stems = raw.map(stem)
  const n = raw.length
  const used: boolean[] = new Array(n).fill(false)
  const mark = (a: number, b: number) => {
    for (let k = a; k < b; k++) used[k] = true
  }

  // 1. numéro de table
  let table: number | null = null
  for (let i = 0; i < n && table === null; i++) {
    if (raw[i] !== 'table') continue
    let j = i + 1
    while (['numero', 'n', 'no', 'la', 'le', 'de'].includes(raw[j])) j++
    const num = parseNumber(raw, j)
    if (num && num.value >= 1 && num.value <= 99) {
      table = num.value
      mark(i, j + num.len)
    }
  }

  // 2. articles (plus long alias d'abord)
  const matches: Match[] = []
  for (let i = 0; i < n; ) {
    if (used[i]) {
      i++
      continue
    }
    let best: { a: Alias; exact: number } | null = null
    for (const a of ALIASES) {
      const L = a.tokens.length
      if (best && L < best.a.tokens.length) break
      if (i + L > n) continue
      let ok = true
      let exact = 0
      for (let k = 0; k < L; k++) {
        if (used[i + k]) { ok = false; break }
        const e = tokEq(stems[i + k], a.tokens[k])
        if (!e) { ok = false; break }
        if (e === 2) exact++
      }
      if (ok && (!best || L > best.a.tokens.length || exact > best.exact)) best = { a, exact }
    }
    if (best) {
      const L = best.a.tokens.length
      matches.push({ i, end: i + L, item: best.a.item, qty: 1, size: null, cuisson: null, dessert: null, notes: [] })
      mark(i, i + L)
      i += L
    } else i++
  }

  // 3. menu enfant : "avec fromage blanc / glace" = option du menu, pas un article en plus
  for (let k = 0; k < matches.length; k++) {
    const m = matches[k]
    if (m.item.id !== 'enfant-menu-enfant-sage') continue
    const next = matches[k + 1]
    const limit = Math.min(m.end + 5, next && next.item.id !== 'desserts-fromage-blanc' ? next.i : n)
    if (next && next.item.id === 'desserts-fromage-blanc' && next.i - m.end <= 4) {
      m.dessert = 'fromage blanc'
      next.dropped = true
    } else {
      for (let t = m.end; t < limit; t++)
        if (!used[t] && stems[t] === 'glace') {
          m.dessert = 'cornet de glace'
          mark(t, t + 1)
          if (raw[t - 1] === 'cornet') mark(t - 1, t)
          break
        }
    }
  }
  const live = matches.filter((m) => !m.dropped)
  const prevEnd = (idx: number) => (idx === 0 ? 0 : live[idx - 1].end)

  // 4. mentions : quantités, tailles, cuisson, notes
  const qtys: Mention<number>[] = []
  const sizeCl: Mention<number>[] = []
  const portions: Mention<number>[] = []
  const cuissons: Mention<string>[] = []

  for (let i = 0; i < n; i++) {
    if (used[i]) continue
    const w = raw[i]

    // demi-douzaine / douzaine (portion d'escargots)
    if (w === 'demi' && stems[i + 1] === 'douzaine') { portions.push({ i, end: i + 2, v: 6 }); mark(i, i + 2); i++; continue }
    if (stems[i] === 'douzaine') { portions.push({ i, end: i + 1, v: 12 }); mark(i, i + 1); continue }

    // cuisson
    if (w === 'bien' && raw[i + 1] === 'cuit') { cuissons.push({ i, end: i + 2, v: 'bien cuit' }); mark(i, i + 2); i++; continue }
    if (w === 'cuit' || w === 'cuite') { cuissons.push({ i, end: i + 1, v: 'bien cuit' }); mark(i, i + 1); continue }
    if (w === 'bleu') { cuissons.push({ i, end: i + 1, v: 'bleu' }); mark(i, i + 1); continue }
    if (w.startsWith('saignant')) { cuissons.push({ i, end: i + 1, v: 'saignant' }); mark(i, i + 1); continue }
    if (w === 'a' && raw[i + 1] === 'point') { cuissons.push({ i, end: i + 2, v: 'à point' }); mark(i, i + 2); i++; continue }
    if (w === 'point') { cuissons.push({ i, end: i + 1, v: 'à point' }); mark(i, i + 1); continue }

    // nombre (quantité, ou contenance si suivi de "cl")
    const num = parseNumber(raw, i)
    if (num) {
      const after = raw[i + num.len]
      if (after === 'cl' || after === 'centilitre' || after === 'centilitres') {
        sizeCl.push({ i, end: i + num.len + 1, v: num.value })
        mark(i, i + num.len + 1)
        i += num.len
        continue
      }
      if (after === 'litre' || after === 'litres' || after === 'l') {
        mark(i, i + num.len + 1)
        i += num.len
        continue
      }
      if (num.value >= 1 && num.value <= 20) {
        qtys.push({ i, end: i + num.len, v: num.value })
        mark(i, i + num.len)
        i += num.len - 1
        continue
      }
      if (num.value === 25 || num.value === 50) {
        sizeCl.push({ i, end: i + num.len, v: num.value })
        mark(i, i + num.len)
        i += num.len - 1
        continue
      }
      continue
    }
    const x = /^x(\d{1,2})$/.exec(w)
    if (x) { qtys.push({ i, end: i + 1, v: parseInt(x[1], 10) }); mark(i, i + 1); continue }

    // descripteurs de contenance
    if (w === 'demi' || w === 'demis' || w === 'petit' || w === 'petite' || w === 'petites') { sizeCl.push({ i, end: i + 1, v: 25 }); mark(i, i + 1); continue }
    if (w === 'pinte' || w === 'pintes' || w === 'grand' || w === 'grande' || w === 'grandes') { sizeCl.push({ i, end: i + 1, v: 50 }); mark(i, i + 1); continue }
    if (stems[i] === 'verre') { sizeCl.push({ i, end: i + 1, v: 12 }); mark(i, i + 1); continue }
    if (stems[i] === 'bouteille') { sizeCl.push({ i, end: i + 1, v: 75 }); mark(i, i + 1); continue }

    // notes "sans X" / "pas de X"
    if (w === 'sans' || (w === 'pas' && raw[i + 1] === 'de')) {
      let j = i + (w === 'pas' ? 2 : 1)
      while (['le', 'la', 'les', 'l', 'de', 'du', 'des', 'd'].includes(raw[j])) j++
      const words: string[] = []
      const start = j
      while (j < n && words.length < 3 && !used[j] && !['et', 'puis', 'ensuite', 'avec', 'pour', 'table'].includes(raw[j]) && !parseNumber(raw, j)) {
        words.push(raw[j])
        j++
      }
      if (words.length) {
        const anchorPrev = [...live].reverse().find((m) => m.end <= i && i - m.end <= 3)
        const anchorNext = live.find((m) => m.i >= start && m.i - j <= 3)
        const target = anchorPrev ?? anchorNext
        if (target) {
          target.notes.push('sans ' + words.join(' '))
          mark(i, j)
          i = j - 1
        }
      }
    }
  }

  // 5. affectations aux articles
  // 5a. quantités : dernière quantité située avant l'article (≤ 4 mots), pas déjà utilisée
  const qtyUsed = new Set<Mention<number>>()
  live.forEach((m, idx) => {
    const cands = qtys.filter((q) => !qtyUsed.has(q) && q.end <= m.i && q.i >= prevEnd(idx) && gapAfter(q, m) <= 4)
    const q = cands[cands.length - 1]
    if (q) {
      qtyUsed.add(q)
      m.qty = q.v
    } else {
      // "bavette x2" : quantité juste après l'article
      const post = qtys.find((p) => !qtyUsed.has(p) && p.i >= m.end && gapBefore(m, p.i) === 0 && raw[p.i].startsWith('x'))
      if (post) { qtyUsed.add(post); m.qty = post.v }
    }
  })

  // 5b. contenances : mention → article le plus proche qui propose cette taille
  const labelMatches = (m: Match, cl: number) => m.item.sizes?.some((s) => s.cl === cl)
  const sizeLabel = (m: Match, cl: number) => m.item.sizes!.find((s) => s.cl === cl)!.label
  const place = <T,>(men: Mention<T>, ok: (m: Match) => boolean, apply: (m: Match) => void) => {
    let best: { m: Match; gap: number } | null = null
    for (const m of live) {
      if (!ok(m)) continue
      const g = men.i >= m.end ? gapBefore(m, men.i) : men.end <= m.i ? gapAfter(men, m) : null
      if (g === null || g > 3) continue
      if (!best || g < best.gap || (g === best.gap && men.end <= m.i)) best = { m, gap: g }
    }
    if (best) apply(best.m)
  }
  for (const s of sizeCl)
    place(s, (m) => m.size === null && !!labelMatches(m, s.v), (m) => (m.size = sizeLabel(m, s.v)))
  for (const p of portions)
    place(p, (m) => m.size === null && !!m.item.sizes?.some((s) => s.label === 'x' + p.v), (m) => (m.size = 'x' + p.v))
  for (const c of cuissons)
    place(c, (m) => m.item.cuisson === true && m.cuisson === null, (m) => (m.cuisson = c.v))

  // 5c. "six escargots" : le nombre devant l'article est la taille de la portion
  live.forEach((m) => {
    if (m.size === null && m.item.sizes?.some((s) => s.label.startsWith('x')) && [6, 12].includes(m.qty)) {
      const lab = 'x' + m.qty
      if (m.item.sizes.some((s) => s.label === lab)) { m.size = lab; m.qty = 1 }
    }
  })

  // 6. restes non compris
  const unmatched: string[] = []
  let run: string[] = []
  const flush = () => { if (run.length) unmatched.push(run.join(' ')); run = [] }
  for (let i = 0; i < n; i++) {
    if (!used[i] && !STOP.has(raw[i]) && !parseNumber(raw, i)) run.push(raw[i])
    else flush()
  }
  flush()

  const lines: Line[] = mergeLines(
    live.map((m) =>
      makeLine({
        menuId: m.item.id,
        qty: m.qty,
        size: m.size ?? m.item.sizes?.[0]?.label ?? null,
        cuisson: m.cuisson,
        dessert: m.dessert,
        notes: m.notes,
      }),
    ),
  )
  return { table, lines, unmatched, source: 'local' }
}

export { MENU_BY_ID }

import { MENU_BY_ID, unitPrice } from '../data/menu'
import type { Line, SentOrder } from './types'

export function lineKey(l: Omit<Line, 'key'>): string {
  return [l.menuId, l.size ?? '', l.cuisson ?? '', l.dessert ?? '', l.notes.join('+')].join('|')
}

export function makeLine(p: Partial<Line> & { menuId: string }): Line {
  const base = {
    menuId: p.menuId,
    qty: Math.max(1, Math.round(p.qty ?? 1)),
    size: p.size ?? null,
    cuisson: p.cuisson ?? null,
    dessert: p.dessert ?? null,
    notes: p.notes ?? [],
  }
  return { ...base, key: lineKey(base) }
}

/** Fusionne des lignes identiques (même article/taille/options) en additionnant les quantités. */
export function mergeLines(...groups: Line[][]): Line[] {
  const out: Line[] = []
  for (const g of groups)
    for (const l of g) {
      const hit = out.find((o) => o.key === l.key)
      if (hit) hit.qty += l.qty
      else out.push({ ...l, notes: [...l.notes] })
    }
  return out
}

export function updateLine(l: Line, patch: Partial<Line>): Line {
  const next = { ...l, ...patch }
  return { ...next, key: lineKey(next) }
}

export function lineTotal(l: Line): number | null {
  const m = MENU_BY_ID[l.menuId]
  if (!m) return null
  const p = unitPrice(m, l.size)
  return p == null ? null : p * l.qty
}

export function total(lines: Line[]): { sum: number; partial: boolean } {
  let sum = 0
  let partial = false
  for (const l of lines) {
    const t = lineTotal(l)
    if (t == null) partial = true
    else sum += t
  }
  return { sum, partial }
}

/** Format JSON destiné à être poussé vers le POS (un seul contrat, versionné). */
export function toPosPayload(o: SentOrder) {
  return {
    schema: 'voice-pos-order/v1',
    id: o.id,
    restaurant: 'Chez Mamie',
    table: o.table,
    createdAt: o.createdAt,
    items: o.lines.map((l) => {
      const m = MENU_BY_ID[l.menuId]
      return {
        sku: l.menuId,
        name: m?.name ?? l.menuId,
        category: m?.category ?? null,
        course: m?.course ?? null,
        quantity: l.qty,
        size: l.size,
        unitPrice: m ? unitPrice(m, l.size) : null,
        currency: 'EUR',
        modifiers: { cuisson: l.cuisson, dessert: l.dessert },
        notes: l.notes,
      }
    }),
    transcript: o.transcript,
    meta: { stt: o.stt, parser: o.parser },
  }
}

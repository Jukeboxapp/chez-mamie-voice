import { describe, expect, it } from 'vitest'
import { parseOrder } from './parser'

const brief = (s: string) => {
  const p = parseOrder(s)
  return {
    table: p.table,
    lines: p.lines.map((l) => [l.qty, l.menuId, l.size, l.cuisson, l.dessert, ...l.notes].filter((x) => x !== null)),
    unmatched: p.unmatched,
  }
}

describe('parseOrder (local)', () => {
  it('table + bières avec quantités', () => {
    expect(brief('Table 5, deux blondes de soif et une blanche')).toEqual({
      table: 5,
      lines: [
        [2, 'pression-blonde-de-soif', '25cl'],
        [1, 'pression-blanche-de-france', '25cl'],
      ],
      unmatched: [],
    })
  })

  it('table en lettres, demi et pinte', () => {
    const r = brief('table douze un demi de blonde et une pinte de Tata IPA')
    expect(r.table).toBe(12)
    expect(r.lines).toEqual([
      [1, 'pression-blonde-de-soif', '25cl'],
      [1, 'pression-tata-ipa', '50cl'],
    ])
  })

  it('"demis" avec quantité avant le descripteur, taille en cl', () => {
    expect(brief('deux demis de blanche').lines).toEqual([[2, 'pression-blanche-de-france', '25cl']])
    expect(brief('une blonde 50 cl').lines).toEqual([[1, 'pression-blonde-de-soif', '50cl']])
  })

  it('cuisson de la bavette', () => {
    const r = brief('une bavette saignante et un confit de canard, deux profiteroles')
    expect(r.lines).toEqual([
      [1, 'plats-bavette-d-aloyau-grillee', 'saignant'],
      [1, 'plats-confit-de-canard-maison'],
      [2, 'desserts-profiteroles'],
    ])
  })

  it('escargots : douzaine / nombre = taille de portion', () => {
    expect(brief("une douzaine d'escargots").lines).toEqual([[1, 'entrees-escargots-de-bourgogne', 'x12']])
    expect(brief('six escargots').lines).toEqual([[1, 'entrees-escargots-de-bourgogne', 'x6']])
    expect(brief('deux demi douzaines escargots').lines).toEqual([[2, 'entrees-escargots-de-bourgogne', 'x6']])
  })

  it('notes "sans"', () => {
    expect(brief('un mojito sans glace et deux spritz Saint Germain').lines).toEqual([
      [1, 'coquetels-mojito', 'sans glace'],
      [2, 'coquetels-spritz-st-germain'],
    ])
  })

  it('menu enfant : le dessert est une option, pas un article en plus', () => {
    expect(brief('un menu enfant avec fromage blanc').lines).toEqual([[1, 'enfant-menu-enfant-sage', 'fromage blanc']])
    expect(brief('un menu enfant dessert cornet de glace').lines).toEqual([[1, 'enfant-menu-enfant-sage', 'cornet de glace']])
  })

  it('plus long alias gagne (café / café au lait / café gourmand)', () => {
    expect(brief('deux cafés, un café au lait et un café gourmand').lines).toEqual([
      [2, 'chaud-cafe'],
      [1, 'chaud-cafe-au-lait'],
      [1, 'desserts-cafe-gourmand-surprise'],
    ])
  })

  it('noms avec chiffres', () => {
    expect(brief('trois Pastis 51 et un Get 27').lines).toEqual([
      [3, 'aperitifs-pastis-51'],
      [1, 'aperitifs-get-27'],
    ])
  })

  it('pas de table → null ; mots inconnus remontés', () => {
    const r = brief('une licorne et une blonde')
    expect(r.table).toBeNull()
    expect(r.unmatched).toEqual(['licorne'])
    expect(r.lines).toEqual([[1, 'pression-blonde-de-soif', '25cl']])
  })

  it('fusionne les lignes identiques', () => {
    expect(brief('une blonde et deux blondes').lines).toEqual([[3, 'pression-blonde-de-soif', '25cl']])
  })

  it('tolère une faute de reconnaissance légère', () => {
    expect(brief('un mojitto').lines).toEqual([[1, 'coquetels-mojito']])
  })
})

import { useMemo, useState } from 'react'
import { TABLES } from '../data/floor'
import { MENU, type MenuItem } from '../data/menu'
import { total } from '../lib/order'
import type { Line } from '../lib/types'

interface Sub {
  label: string
  cats: string[]
}
interface Group {
  id: string
  label: string
  subs: Sub[]
}

// Classement façon caisse : grandes familles, puis sous-familles pour les boissons.
const GROUPS: Group[] = [
  { id: 'entrees', label: 'Entrées', subs: [{ label: 'Entrées', cats: ['entrees'] }] },
  { id: 'plats', label: 'Plats', subs: [{ label: 'Plats', cats: ['plats', 'enfant'] }] },
  { id: 'desserts', label: 'Desserts', subs: [{ label: 'Desserts', cats: ['desserts'] }] },
  {
    id: 'boissons',
    label: 'Boissons',
    subs: [
      { label: 'Bières', cats: ['pression', 'bouteille'] },
      { label: 'Softs', cats: ['softs'] },
      { label: 'Chaud', cats: ['chaud'] },
      { label: 'Apéros', cats: ['aperitifs', 'shooters'] },
      { label: 'Cocktails', cats: ['coquetels'] },
      { label: 'Gins', cats: ['gins'] },
      { label: 'Spiritueux', cats: ['vodkas', 'tequilas', 'rhums', 'whiskies'] },
      { label: 'Vins', cats: ['vins'] },
    ],
  },
]

const eur = (n: number | null) => (n == null ? '—' : `${n.toFixed(2).replace('.', ',')} €`)

interface Props {
  table: number | null
  lines: Line[]
  onPickTable(n: number | null): void
  onAdd(menuId: string, size: string | null): void
  onRemove(menuId: string): void
  onClose(): void
}

export function Catalog({ table, lines, onPickTable, onAdd, onRemove, onClose }: Props) {
  const [gid, setGid] = useState(GROUPS[0].id)
  const [sid, setSid] = useState(0)
  const group = GROUPS.find((g) => g.id === gid)!
  const sub = group.subs[Math.min(sid, group.subs.length - 1)]

  const items = useMemo(() => MENU.filter((m) => sub.cats.includes(m.category)), [sub])
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const l of lines) c[l.menuId] = (c[l.menuId] ?? 0) + l.qty
    return c
  }, [lines])
  const qty = lines.reduce((a, l) => a + l.qty, 0)
  const t = total(lines)

  return (
    <section className="pos">
      <header>
        <h2>Carte</h2>
        <select value={table ?? ''} onChange={(e) => onPickTable(e.target.value ? Number(e.target.value) : null)} aria-label="Table">
          <option value="">Table ?</option>
          {TABLES.map((x) => (
            <option key={x.n} value={x.n}>
              Table {x.n}
            </option>
          ))}
        </select>
        <button className="x" onClick={onClose} aria-label="Fermer la carte">
          ×
        </button>
      </header>

      <nav className="tabs groups">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            className={g.id === gid ? 'on' : ''}
            onClick={() => {
              setGid(g.id)
              setSid(0)
            }}
          >
            {g.label}
          </button>
        ))}
      </nav>
      {group.subs.length > 1 && (
        <nav className="tabs subs">
          {group.subs.map((s, i) => (
            <button key={s.label} className={i === sid ? 'on' : ''} onClick={() => setSid(i)}>
              {s.label}
            </button>
          ))}
        </nav>
      )}

      <div className="grid">
        {items.map((m) => (
          <Tile key={m.id} item={m} count={counts[m.id] ?? 0} onAdd={onAdd} onRemove={onRemove} />
        ))}
      </div>

      <footer>
        <span>
          {qty} article{qty > 1 ? 's' : ''} · <b>{eur(t.sum)}</b>
          {t.partial ? ' +' : ''}
        </span>
        <button className="primary" onClick={onClose}>
          Voir le ticket
        </button>
      </footer>
    </section>
  )
}

function Tile({ item, count, onAdd, onRemove }: { item: MenuItem; count: number; onAdd(id: string, size: string | null): void; onRemove(id: string): void }) {
  const sized = !!item.sizes
  return (
    <div className={`tile ${count ? 'has' : ''}`}>
      {count > 0 && (
        <div className="badge">
          <button onClick={() => onRemove(item.id)} aria-label={`Retirer ${item.name}`}>
            −
          </button>
          <b>{count}</b>
        </div>
      )}
      <button className="body" onClick={() => !sized && onAdd(item.id, null)} disabled={sized} aria-label={`Ajouter ${item.name}`}>
        <span className="n">{item.name}</span>
        {!sized && <span className="p">{item.price == null ? (item.note ?? 'prix à saisir') : eur(item.price)}</span>}
      </button>
      {sized && (
        <div className="sizes">
          {item.sizes!.map((s) => (
            <button key={s.label} onClick={() => onAdd(item.id, s.label)} aria-label={`Ajouter ${item.name} ${s.label}`}>
              {s.label}
              <small>{eur(s.price)}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

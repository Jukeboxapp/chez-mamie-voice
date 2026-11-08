import { MENU_BY_ID, unitPrice } from '../data/menu'
import { updateLine } from '../lib/order'
import type { Line } from '../lib/types'

const CUISSONS = ['bleu', 'saignant', 'à point', 'bien cuit']
const DESSERTS = ['cornet de glace', 'fromage blanc']

const cycle = (list: string[], cur: string | null) => list[(list.indexOf(cur ?? '') + 1) % list.length]

interface Props {
  line: Line
  onChange?(l: Line): void
  onRemove?(): void
  preview?: boolean
}

export function LineRow({ line, onChange, onRemove, preview }: Props) {
  const m = MENU_BY_ID[line.menuId]
  if (!m) return null
  const price = unitPrice(m, line.size)
  const edit = !!onChange && !preview
  const set = (p: Partial<Line>) => onChange?.(updateLine(line, p))

  return (
    <li className={`line ${preview ? 'preview' : ''}`}>
      {edit ? (
        <div className="stepper">
          <button onClick={() => (line.qty > 1 ? set({ qty: line.qty - 1 }) : onRemove?.())} aria-label="Moins">
            −
          </button>
          <span>{line.qty}</span>
          <button onClick={() => set({ qty: line.qty + 1 })} aria-label="Plus">
            +
          </button>
        </div>
      ) : (
        <span className="qty">{line.qty}×</span>
      )}
      <div className="what">
        <div className="name">{m.name}</div>
        <div className="chips">
          {m.sizes && line.size && (
            <button className="chip" disabled={!edit} onClick={() => set({ size: cycle(m.sizes!.map((s) => s.label), line.size) })}>
              {line.size}
            </button>
          )}
          {m.cuisson && (
            <button className={`chip ${line.cuisson ? '' : 'warn'}`} disabled={!edit} onClick={() => set({ cuisson: cycle(CUISSONS, line.cuisson) })}>
              {line.cuisson ?? 'cuisson ?'}
            </button>
          )}
          {m.id.startsWith('enfant-') && (
            <button className={`chip ${line.dessert ? '' : 'warn'}`} disabled={!edit} onClick={() => set({ dessert: cycle(DESSERTS, line.dessert) })}>
              {line.dessert ?? 'dessert ?'}
            </button>
          )}
          {line.notes.map((n) => (
            <span key={n} className="chip note">
              {n}
            </span>
          ))}
        </div>
      </div>
      <span className="price">{price == null ? '—' : `${(price * line.qty).toFixed(2).replace('.', ',')} €`}</span>
      {edit && (
        <button className="x" onClick={onRemove} aria-label="Supprimer">
          ×
        </button>
      )}
    </li>
  )
}

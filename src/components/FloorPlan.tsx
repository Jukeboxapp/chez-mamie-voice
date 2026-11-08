import { TABLES } from '../data/floor'

export interface TableStatus {
  count: number
  total: number
}

interface Props {
  selected: number | null
  status: Record<number, TableStatus>
  onSelect(n: number): void
}

export function FloorPlan({ selected, status, onSelect }: Props) {
  return (
    <div className="plan">
      <div className="zone zone-bar">BAR</div>
      <div className="zone zone-salle">
        <span>SALLE</span>
      </div>
      <div className="zone zone-door">entrée ▾</div>
      <div className="zone zone-terrasse">
        <span>TERRASSE</span>
      </div>
      {TABLES.map((t) => {
        const st = status[t.n]
        return (
          <button
            key={t.n}
            className={`table ${t.shape} ${st ? 'busy' : ''} ${selected === t.n ? 'sel' : ''}`}
            style={{ left: `${t.x}%`, top: `${t.y}%` }}
            onClick={() => onSelect(t.n)}
            aria-label={`Table ${t.n}`}
          >
            <b>{t.n}</b>
            {st && <small>{st.count} art.</small>}
          </button>
        )
      })}
    </div>
  )
}

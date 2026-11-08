import { useState } from 'react'
import { TABLES } from '../data/floor'
import { mergeLines, total, toPosPayload } from '../lib/order'
import type { Line, SentOrder } from '../lib/types'
import { LineRow } from './LineRow'

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

interface Props {
  table: number | null
  draft: Line[]
  preview: Line[] // lignes "live" pendant la dictée
  unmatched: string[]
  transcript: string
  listening: boolean
  processing: boolean
  sent: SentOrder[]
  stt: string
  onPickTable(n: number): void
  onChangeDraft(lines: Line[]): void
  onDismissUnmatched(): void
  onSend(): void
  onClear(): void
  onClose(): void
  onCloseTable(): void
}

export function TicketSheet(p: Props) {
  const [showJson, setShowJson] = useState(false)
  const sentLines = mergeLines(...p.sent.map((o) => o.lines))
  const sentTotal = total(sentLines)
  const shown = p.preview.length ? mergeLines(p.draft, p.preview) : p.draft
  const hasDraft = p.draft.length > 0
  const busy = p.listening || p.processing

  const pending: SentOrder = {
    id: 'ord_preview',
    table: p.table ?? 0,
    createdAt: new Date().toISOString(),
    lines: p.draft,
    transcript: p.transcript,
    stt: p.stt,
    parser: 'preview',
  }

  return (
    <section className="sheet" aria-live="polite">
      <header>
        <h2>{p.table ? `Table ${p.table}` : 'Quelle table ?'}</h2>
        <button className="x" onClick={p.onClose} aria-label="Fermer">
          ×
        </button>
      </header>

      {p.table === null && (hasDraft || busy) && (
        <div className="picker">
          {TABLES.map((t) => (
            <button key={t.n} onClick={() => p.onPickTable(t.n)}>
              {t.n}
            </button>
          ))}
        </div>
      )}

      {(p.listening || p.processing || p.transcript) && (
        <p className={`transcript ${busy ? 'live' : ''}`}>
          {p.listening && !p.transcript ? 'J’écoute…' : p.processing && !p.transcript ? 'Transcription…' : `« ${p.transcript} »`}
          {p.processing && p.transcript && <em> · analyse…</em>}
        </p>
      )}

      {shown.length > 0 && (
        <>
          <h3>À envoyer</h3>
          <ul className="lines">
            {p.draft.map((l) => (
              <LineRow
                key={l.key}
                line={l}
                onChange={(n) => p.onChangeDraft(mergeLines(p.draft.map((x) => (x.key === l.key ? n : x))))}
                onRemove={() => p.onChangeDraft(p.draft.filter((x) => x.key !== l.key))}
              />
            ))}
            {p.preview.map((l) => (
              <LineRow key={'p' + l.key} line={l} preview />
            ))}
          </ul>
        </>
      )}

      {p.unmatched.length > 0 && (
        <p className="unmatched">
          ⚠️ Non reconnu : {p.unmatched.map((u) => `« ${u} »`).join(', ')}
          <button onClick={p.onDismissUnmatched}>ok</button>
        </p>
      )}

      {hasDraft && (
        <>
          <div className="actions">
            <button className="ghost" onClick={p.onClear}>
              Effacer
            </button>
            <button className="primary" disabled={!p.table || busy} onClick={p.onSend}>
              {p.table ? `Envoyer · table ${p.table}` : 'Choisis une table'}
            </button>
          </div>
          <button className="link" onClick={() => setShowJson((v) => !v)}>
            {showJson ? 'Masquer' : 'Voir'} le JSON POS
          </button>
          {showJson && <pre>{JSON.stringify(toPosPayload(pending), null, 2)}</pre>}
        </>
      )}

      {!hasDraft && !busy && p.table && (
        <p className="hint">Maintiens le micro et dicte : « deux blondes, une bavette saignante… »</p>
      )}

      {p.sent.length > 0 && (
        <>
          <h3>
            Déjà envoyé <span>{eur(sentTotal.sum)}{sentTotal.partial ? ' +' : ''}</span>
          </h3>
          <ul className="lines sent">
            {sentLines.map((l) => (
              <LineRow key={l.key} line={l} />
            ))}
          </ul>
          <button className="link danger" onClick={p.onCloseTable}>
            Clôturer la table
          </button>
        </>
      )}
    </section>
  )
}

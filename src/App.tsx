import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Catalog } from './components/Catalog'
import { FloorPlan, type TableStatus } from './components/FloorPlan'
import { MicButton, type Phase } from './components/MicButton'
import { SettingsModal } from './components/SettingsModal'
import { TicketSheet } from './components/TicketSheet'
import { refineWithLlm } from './lib/llm'
import { makeLine, mergeLines, toPosPayload, total } from './lib/order'
import { parseOrder } from './lib/parser'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './lib/settings'
import { startListening, webSpeechSupported, type SttSession } from './lib/stt'
import type { Line, SentOrder } from './lib/types'

const ORDERS_KEY = 'mamie-orders-v1'

function loadOrders(): SentOrder[] {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY) ?? '[]')
  } catch {
    return []
  }
}

interface Draft {
  lines: Line[]
  transcripts: string[]
  unmatched: string[]
  parser: string
}
const EMPTY: Draft = { lines: [], transcripts: [], unmatched: [], parser: 'local' }

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => (typeof localStorage === 'undefined' ? DEFAULT_SETTINGS : loadSettings()))
  const [orders, setOrders] = useState<SentOrder[]>(loadOrders)
  const [selected, setSelected] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [phase, setPhase] = useState<Phase>('idle')
  const [liveText, setLiveText] = useState('')
  const [liveLines, setLiveLines] = useState<Line[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [posOpen, setPosOpen] = useState(false)
  const session = useRef<SttSession | null>(null)
  const toastTimer = useRef<number>()
  const lastStt = useRef('webspeech')

  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => {
    try {
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
    } catch {
      /* noop */
    }
  }, [orders])

  const say = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  // État de chaque table pour le plan
  const status = useMemo(() => {
    const out: Record<number, TableStatus> = {}
    for (const o of orders) {
      const s = (out[o.table] ??= { count: 0, total: 0 })
      s.count += o.lines.reduce((a, l) => a + l.qty, 0)
      s.total += total(o.lines).sum
    }
    return out
  }, [orders])

  const effectiveEngine = settings.engine === 'groq' && settings.groqKey ? 'groq' : 'webspeech'

  // ───────────── dictée ─────────────

  const startDictation = () => {
    if (phase !== 'idle') return
    if (settings.engine === 'groq' && !settings.groqKey) say('Pas de clé Groq : micro du navigateur utilisé')
    if (effectiveEngine === 'webspeech' && !webSpeechSupported()) {
      say('Reconnaissance vocale non supportée ici — utilise la carte ▦ ou Chrome/Safari')
      return
    }
    setLiveText('')
    setLiveLines([])
    setPhase('listening')
    session.current = startListening(effectiveEngine, settings.groqKey, {
      onInterim: (text) => {
        setLiveText(text)
        setLiveLines(parseOrder(text).lines)
      },
    })
  }

  const endDictation = async () => {
    const s = session.current
    session.current = null
    if (!s) return
    setPhase('processing')
    try {
      const text = await s.stop()
      await finalize(text, effectiveEngine)
    } catch (e) {
      say(e instanceof Error ? e.message : 'Erreur de dictée')
    } finally {
      setPhase('idle')
      setLiveLines([])
      setLiveText('')
    }
  }

  async function finalize(text: string, stt: string) {
    if (!text) {
      say('Je n’ai rien entendu')
      return
    }
    setLiveText(text)
    let parsed = parseOrder(text)
    if (settings.llm && settings.groqKey) {
      const ac = new AbortController()
      const timer = window.setTimeout(() => ac.abort(), 7000)
      try {
        const r = await refineWithLlm(text, settings.groqKey, ac.signal)
        if (r.lines.length || !parsed.lines.length) parsed = r
      } catch {
        say('IA indisponible — analyse locale')
      } finally {
        window.clearTimeout(timer)
      }
    }
    if (!parsed.lines.length && parsed.table === null) {
      say(`Rien compris dans « ${text} »`)
      setDraft((d) => ({ ...d, unmatched: [...d.unmatched, ...(parsed.unmatched.length ? parsed.unmatched : [text])] }))
      return
    }
    setDraft((d) => ({
      lines: mergeLines(d.lines, parsed.lines),
      transcripts: [...d.transcripts, text],
      unmatched: [...d.unmatched, ...parsed.unmatched],
      parser: parsed.source,
    }))
    setSelected((cur) => parsed.table ?? cur) // "table 5" dit à voix haute → on bascule dessus
    lastStt.current = stt
  }

  // Barre espace maintenue = micro (pratique pour la démo sur ordinateur)
  const kb = useRef({ startDictation, endDictation })
  kb.current = { startDictation, endDictation }
  useEffect(() => {
    let down = false
    const ok = (e: KeyboardEvent) => e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLButtonElement)
    const d = (e: KeyboardEvent) => {
      if (!ok(e) || e.repeat || down) return
      e.preventDefault()
      down = true
      kb.current.startDictation()
    }
    const u = (e: KeyboardEvent) => {
      if (!ok(e) || !down) return
      e.preventDefault()
      down = false
      kb.current.endDictation()
    }
    window.addEventListener('keydown', d)
    window.addEventListener('keyup', u)
    return () => {
      window.removeEventListener('keydown', d)
      window.removeEventListener('keyup', u)
    }
  }, [])

  // ───────────── actions ─────────────

  // Ajout / retrait manuel depuis la carte (même ticket que la voix)
  const addItem = (menuId: string, size: string | null) =>
    setDraft((d) => ({ ...d, lines: mergeLines(d.lines, [makeLine({ menuId, size })]) }))

  const removeOne = (menuId: string) =>
    setDraft((d) => {
      const i = d.lines.map((l) => l.menuId).lastIndexOf(menuId)
      if (i < 0) return d
      const lines = d.lines.flatMap((l, k) => (k !== i ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []))
      return { ...d, lines }
    })

  const selectTable = (n: number) => {
    if (selected === n && draft.lines.length === 0 && phase === 'idle') setSelected(null)
    else setSelected(n)
  }

  const clearDraft = () => setDraft(EMPTY)

  const closeSheet = () => {
    if (draft.lines.length && !window.confirm('Abandonner la commande en cours ?')) return
    clearDraft()
    setSelected(null)
  }

  const send = async () => {
    if (!selected || !draft.lines.length) return
    const order: SentOrder = {
      id: `ord_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      table: selected,
      createdAt: new Date().toISOString(),
      lines: draft.lines,
      transcript: draft.transcripts.join(' / '),
      stt: draft.transcripts.length ? lastStt.current : 'manual',
      parser: draft.transcripts.length ? draft.parser : 'manual',
    }
    setOrders((o) => [...o, order])
    clearDraft()
    navigator.vibrate?.([20, 40, 20])
    say(`Envoyé · table ${order.table}`)
    if (settings.webhook) {
      try {
        const r = await fetch(settings.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toPosPayload(order)),
        })
        if (!r.ok) say(`POS : erreur ${r.status}`)
      } catch {
        say('POS injoignable (commande gardée en local)')
      }
    }
  }

  const closeTable = () => {
    if (selected === null || !window.confirm(`Clôturer la table ${selected} ?`)) return
    setOrders((o) => o.filter((x) => x.table !== selected))
    setSelected(null)
  }

  const sheetOpen = selected !== null || draft.lines.length > 0 || phase !== 'idle'

  return (
    <div className="app">
      <header className="top">
        <img src="./logo.jpg" alt="" />
        <div>
          <h1>Talkie Pookie</h1>
          <p>Chez Mamie · service du midi</p>
        </div>
        <button className="gear" onClick={() => setShowSettings(true)} aria-label="Réglages">
          ⚙︎
        </button>
      </header>

      <main>
        <FloorPlan selected={selected} status={status} onSelect={selectTable} />
        <p className="legend">
          <i className="dot free" /> libre <i className="dot busy" /> commande en cours
        </p>
      </main>

      {posOpen && (
        <Catalog
          table={selected}
          lines={draft.lines}
          onPickTable={setSelected}
          onAdd={addItem}
          onRemove={removeOne}
          onClose={() => setPosOpen(false)}
        />
      )}

      {sheetOpen && !posOpen && (
        <TicketSheet
          table={selected}
          draft={draft.lines}
          preview={phase === 'listening' ? liveLines : []}
          unmatched={draft.unmatched}
          transcript={phase === 'idle' ? draft.transcripts[draft.transcripts.length - 1] ?? '' : liveText}
          listening={phase === 'listening'}
          processing={phase === 'processing'}
          sent={orders.filter((o) => o.table === selected)}
          stt={lastStt.current}
          onPickTable={setSelected}
          onChangeDraft={(lines) => setDraft((d) => ({ ...d, lines }))}
          onDismissUnmatched={() => setDraft((d) => ({ ...d, unmatched: [] }))}
          onSend={send}
          onClear={clearDraft}
          onClose={closeSheet}
          onCloseTable={closeTable}
        />
      )}

      {toast && <div className="toast">{toast}</div>}

      <footer className={`dock ${phase}`}>
        <button className="cart" onClick={() => setPosOpen((v) => !v)} aria-label="Ouvrir la carte">
          ▦<span>Carte</span>
        </button>
        <MicButton phase={phase} onStart={startDictation} onEnd={endDictation} />
        <div className="where">{selected ? `Table ${selected}` : 'Table ?'}</div>
        <p className="hint">
          {phase === 'listening' ? 'Parle… relâche pour valider' : phase === 'processing' ? 'Analyse…' : 'Maintiens pour dicter'}
        </p>
      </footer>

      {showSettings && (
        <SettingsModal
          value={settings}
          onChange={setSettings}
          onResetData={() => {
            if (window.confirm('Effacer toutes les commandes de démo ?')) {
              setOrders([])
              setSelected(null)
              clearDraft()
            }
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

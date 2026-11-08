import { webSpeechSupported } from '../lib/stt'
import type { Settings } from '../lib/settings'

interface Props {
  value: Settings
  onChange(s: Settings): void
  onResetData(): void
  onClose(): void
}

export function SettingsModal({ value, onChange, onResetData, onClose }: Props) {
  const set = (p: Partial<Settings>) => onChange({ ...value, ...p })
  return (
    <div className="modal" onClick={onClose}>
      <div className="card" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Réglages</h2>
          <button className="x" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>

        <h3>Reconnaissance vocale</h3>
        <label className="radio">
          <input type="radio" checked={value.engine === 'webspeech'} onChange={() => set({ engine: 'webspeech' })} />
          <span>
            <b>Navigateur</b> · gratuit, sans clé, texte en direct
            {!webSpeechSupported() && <em> — non supporté ici</em>}
          </span>
        </label>
        <label className="radio">
          <input type="radio" checked={value.engine === 'groq'} onChange={() => set({ engine: 'groq' })} />
          <span>
            <b>Whisper (Groq)</b> · plus précis, vocabulaire de la carte, résultat au relâché
          </span>
        </label>

        <h3>Clé API Groq (gratuite)</h3>
        <input
          type="password"
          placeholder="gsk_…"
          value={value.groqKey}
          autoComplete="off"
          onChange={(e) => set({ groqKey: e.target.value.trim() })}
        />
        <p className="small">Stockée uniquement sur cet appareil (localStorage). Crée-la sur console.groq.com → API Keys.</p>
        <label className="check">
          <input type="checkbox" checked={value.llm} onChange={(e) => set({ llm: e.target.checked })} />
          <span>Affiner la compréhension avec un LLM (Llama 3.3 via Groq)</span>
        </label>

        <h3>Transmission au POS (optionnel)</h3>
        <input
          type="url"
          placeholder="https://… (reçoit le JSON en POST)"
          value={value.webhook}
          onChange={(e) => set({ webhook: e.target.value.trim() })}
        />

        <button className="link danger" onClick={onResetData}>
          Réinitialiser les commandes de démo
        </button>
      </div>
    </div>
  )
}

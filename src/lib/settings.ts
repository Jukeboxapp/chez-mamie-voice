export type SttEngineId = 'webspeech' | 'groq'

export interface Settings {
  engine: SttEngineId
  groqKey: string
  llm: boolean // affiner le parsing avec un LLM (nécessite la clé Groq)
  webhook: string // POST du JSON vers un POS / endpoint de test (optionnel)
}

const KEY = 'mamie-settings-v1'

export const DEFAULT_SETTINGS: Settings = { engine: 'webspeech', groqKey: '', llm: true, webhook: '' }

export function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* mode privé : on ignore */
  }
}

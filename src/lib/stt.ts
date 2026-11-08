// Deux moteurs de reconnaissance vocale derrière la même interface "push-to-talk".
//  • webspeech : API du navigateur (Chrome/Safari/Edge). Gratuit, aucune clé, texte en direct.
//                Limites : pas de vocabulaire personnalisé, ne marche pas en PWA installée sur iOS.
//  • groq      : Whisper large-v3-turbo hébergé par Groq (palier gratuit). Beaucoup plus précis,
//                accepte un `prompt` de vocabulaire (noms de la carte). Texte uniquement au relâché.

import { WHISPER_PROMPT } from '../data/menu'
import type { SttEngineId } from './settings'

export interface SttSession {
  /** Termine l'écoute et renvoie le texte final. */
  stop(): Promise<string>
  cancel(): void
}

export interface SttHandlers {
  onInterim(text: string): void
}

export function webSpeechSupported(): boolean {
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}

// ───────────── Web Speech API ─────────────

function startWebSpeech(h: SttHandlers): SttSession {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  const rec = new Ctor()
  rec.lang = 'fr-FR'
  rec.interimResults = true
  rec.continuous = true
  rec.maxAlternatives = 1

  let text = ''
  let ended = false
  let failure: string | null = null
  let resolveEnd: () => void = () => {}
  const endP = new Promise<void>((r) => (resolveEnd = r))

  rec.onresult = (e: any) => {
    // On reconstruit tout depuis l'index 0 (évite les doublons de Chrome Android).
    const parts: string[] = []
    for (let i = 0; i < e.results.length; i++) {
      const t = e.results[i][0].transcript.trim()
      const prev = parts[parts.length - 1]
      if (prev && t.toLowerCase().startsWith(prev.toLowerCase())) parts[parts.length - 1] = t
      else parts.push(t)
    }
    text = parts.join(' ')
    h.onInterim(text)
  }
  rec.onerror = (e: any) => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') failure = e.error
  }
  rec.onend = () => {
    ended = true
    resolveEnd()
  }
  try {
    rec.start()
  } catch (err) {
    failure = String(err)
    ended = true
    resolveEnd()
  }

  return {
    async stop() {
      if (!ended) {
        try {
          rec.stop()
        } catch {
          /* déjà arrêté */
        }
        await Promise.race([endP, new Promise((r) => setTimeout(r, 2500))])
      }
      if (failure && !text) throw new Error(failure === 'not-allowed' ? 'Micro refusé' : `Reconnaissance vocale : ${failure}`)
      return text.trim()
    },
    cancel() {
      try {
        rec.abort()
      } catch {
        /* noop */
      }
    },
  }
}

// ───────────── Groq Whisper ─────────────

let cachedStream: MediaStream | null = null
async function getStream(): Promise<MediaStream> {
  if (cachedStream && cachedStream.getTracks().every((t) => t.readyState === 'live')) return cachedStream
  cachedStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  return cachedStream
}

function startGroq(apiKey: string): SttSession {
  const chunks: Blob[] = []
  let rec: MediaRecorder | null = null
  let cancelled = false
  let stopRequested = false
  let mime = ''

  const ready = (async () => {
    const stream = await getStream()
    if (cancelled) return
    mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    if (!stopRequested) rec.start()
  })()

  return {
    async stop() {
      stopRequested = true
      await ready
      const r = rec
      if (!r || r.state === 'inactive') return ''
      const done = new Promise<void>((res) => (r.onstop = () => res()))
      r.stop()
      await done
      if (cancelled || !chunks.length) return ''
      const type = r.mimeType || mime || 'audio/webm'
      const blob = new Blob(chunks, { type })
      if (blob.size < 2000) return '' // appui trop court
      const ext = type.includes('mp4') ? 'm4a' : 'webm'
      const fd = new FormData()
      fd.append('file', blob, `audio.${ext}`)
      fd.append('model', 'whisper-large-v3-turbo')
      fd.append('language', 'fr')
      fd.append('temperature', '0')
      fd.append('response_format', 'json')
      fd.append('prompt', WHISPER_PROMPT)
      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: fd,
      })
      if (!res.ok) throw new Error(`Groq Whisper ${res.status} : ${(await res.text()).slice(0, 140)}`)
      const j = await res.json()
      return String(j.text ?? '').trim()
    },
    cancel() {
      cancelled = true
      try {
        rec?.state === 'recording' && rec.stop()
      } catch {
        /* noop */
      }
    },
  }
}

export function startListening(engine: SttEngineId, groqKey: string, h: SttHandlers): SttSession {
  if (engine === 'groq') return startGroq(groqKey)
  return startWebSpeech(h)
}

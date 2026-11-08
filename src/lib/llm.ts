// Affinage par LLM (Groq, palier gratuit) : texte dicté → JSON strict restreint aux ids de la carte.
// Le LLM ne peut pas inventer d'article : tout id inconnu est rejeté, et en cas d'échec on garde le parseur local.

import { MENU, MENU_BY_ID } from '../data/menu'
import { makeLine, mergeLines } from './order'
import type { Parsed } from './types'

const MODEL = 'llama-3.3-70b-versatile'

const CATALOG = MENU.map((m) => {
  const sizes = m.sizes ? ` [tailles: ${m.sizes.map((s) => s.label).join('/')}]` : ''
  const al = m.aliases.length ? ` (aussi: ${m.aliases.slice(0, 4).join(', ')})` : ''
  return `${m.id} = ${m.name}${sizes}${m.cuisson ? ' [cuisson]' : ''}${al}`
}).join('\n')

const SYSTEM = `Tu es l'assistant de prise de commande d'un serveur au restaurant "Chez Mamie" (Toulouse).
Tu reçois la transcription brute (souvent imparfaite) de ce que le serveur a dicté et tu renvoies UNIQUEMENT un objet JSON.

Format:
{"table": number|null, "items":[{"id": string, "qty": number, "size": string|null, "cuisson": "bleu"|"saignant"|"à point"|"bien cuit"|null, "dessert": "cornet de glace"|"fromage blanc"|null, "notes": string[]}], "unmatched": string[]}

Règles:
- "id" doit être EXACTEMENT un id du catalogue ci-dessous. N'invente rien: ce qui ne correspond à rien va dans "unmatched".
- Corrige les erreurs de reconnaissance vocale en choisissant l'article le plus plausible de la carte.
- "table": numéro de table si dit ("table 5", "table douze"), sinon null.
- Bières pression: "un demi"/"une blonde" = 25cl (défaut), "une pinte"/"une grande"/"50" = 50cl. Escargots: "une douzaine"/"douze" = x12, "six"/"demi-douzaine" = x6 (qty 1). Si l'article a des tailles et que rien n'est dit, size = la première.
- "cuisson" seulement pour les articles marqués [cuisson]. "dessert" seulement pour le menu enfant.
- "notes": demandes particulières ("sans glace", "sans sel"…), courtes, en français.
- Un même article demandé deux fois avec les mêmes options = une seule ligne avec qty cumulée.

Catalogue:
${CATALOG}`

export async function refineWithLlm(transcript: string, apiKey: string, signal?: AbortSignal): Promise<Parsed> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: transcript },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Groq LLM ${res.status}`)
  const data = await res.json()
  const j = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')

  const unmatched: string[] = Array.isArray(j.unmatched) ? j.unmatched.map(String) : []
  const lines = mergeLines(
    (Array.isArray(j.items) ? j.items : [])
      .filter((it: any) => {
        const ok = typeof it?.id === 'string' && it.id in MENU_BY_ID
        if (!ok && it?.id) unmatched.push(String(it.id))
        return ok
      })
      .map((it: any) => {
        const m = MENU_BY_ID[it.id]
        const size = m.sizes ? (m.sizes.find((s) => s.label === it.size)?.label ?? m.sizes[0].label) : null
        return makeLine({
          menuId: m.id,
          qty: Number(it.qty) || 1,
          size,
          cuisson: m.cuisson && typeof it.cuisson === 'string' ? it.cuisson : null,
          dessert: m.id.startsWith('enfant-') && typeof it.dessert === 'string' ? it.dessert : null,
          notes: Array.isArray(it.notes) ? it.notes.map(String).filter(Boolean) : [],
        })
      }),
  )
  const table = Number.isInteger(j.table) && j.table >= 1 && j.table <= 99 ? j.table : null
  return { table, lines, unmatched, source: 'llm' }
}

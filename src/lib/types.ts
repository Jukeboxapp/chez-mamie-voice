export interface Line {
  key: string
  menuId: string
  qty: number
  size: string | null // "25cl", "x12"…
  cuisson: string | null // bleu | saignant | à point | bien cuit
  dessert: string | null // menu enfant : "cornet de glace" | "fromage blanc"
  notes: string[]
}

export interface Parsed {
  table: number | null
  lines: Line[]
  unmatched: string[]
  source: 'local' | 'llm'
}

export interface SentOrder {
  id: string
  table: number
  createdAt: string
  lines: Line[]
  transcript: string
  stt: string
  parser: string
}

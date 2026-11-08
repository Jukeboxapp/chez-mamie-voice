// Plan de salle fictif (le vrai plan sera à relever sur place). Coordonnées en % du conteneur.
export interface TableDef {
  n: number
  x: number
  y: number
  shape: 'sq' | 'round' | 'wide'
}

export const TABLES: TableDef[] = [
  // Salle
  { n: 1, x: 16, y: 27, shape: 'sq' },
  { n: 2, x: 39, y: 27, shape: 'sq' },
  { n: 3, x: 62, y: 27, shape: 'sq' },
  { n: 4, x: 85, y: 27, shape: 'round' },
  { n: 5, x: 16, y: 49, shape: 'sq' },
  { n: 6, x: 39, y: 49, shape: 'sq' },
  { n: 7, x: 65, y: 49, shape: 'wide' },
  { n: 8, x: 91, y: 49, shape: 'round' },
  // Terrasse
  { n: 9, x: 15, y: 89, shape: 'round' },
  { n: 10, x: 38, y: 89, shape: 'round' },
  { n: 11, x: 62, y: 89, shape: 'round' },
  { n: 12, x: 85, y: 89, shape: 'round' },
]

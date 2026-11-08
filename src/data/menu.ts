// Carte de Chez Mamie, transcrite à partir des photos (ardoise + carte papier).
// Prix en €. `price: null` = prix non lisible / à l'ardoise.
// `aliases` = façons courtes de nommer l'article à l'oral (le nom complet est toujours ajouté).

export type Course = 'drink' | 'starter' | 'main' | 'dessert'

export interface SizeOption {
  label: string // "25cl", "50cl", "x6"…
  cl?: number // pour les contenances (sert au parseur : "demi" → 25)
  price: number | null
}

export interface MenuItem {
  id: string
  name: string
  category: string
  course: Course
  price: number | null // prix de base (ignoré si `sizes`)
  sizes?: SizeOption[] // première = défaut
  aliases: string[]
  cuisson?: boolean // article avec cuisson à demander
  note?: string
}

export const CATEGORIES: Record<string, string> = {
  entrees: 'Entrées',
  plats: 'Plats',
  desserts: 'Desserts',
  enfant: 'Menu enfant',
  aperitifs: 'Apéritifs & digestifs',
  shooters: 'Shooters',
  pression: 'Bières pression',
  bouteille: 'Bières bouteille',
  softs: 'Softs',
  chaud: 'Boissons chaudes',
  gins: 'Gins tonic',
  vodkas: 'Vodkas',
  tequilas: 'Téquilas',
  coquetels: 'Coquetels',
  rhums: 'Rhums',
  whiskies: 'Whiskies',
  vins: 'Vins',
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

function drink(
  category: string,
  name: string,
  price: number | null,
  aliases: string[] = [],
  extra: Partial<MenuItem> = {},
): MenuItem {
  return { id: `${category}-${slug(name)}`, name, category, course: 'drink', price, aliases, ...extra }
}

const food = (
  category: string,
  course: Course,
  name: string,
  price: number | null,
  aliases: string[] = [],
  extra: Partial<MenuItem> = {},
): MenuItem => ({ id: `${category}-${slug(name)}`, name, category, course, price, aliases, ...extra })

const pression = (name: string, p25: number, p50: number, aliases: string[] = []): MenuItem =>
  drink('pression', name, null, aliases, {
    sizes: [
      { label: '25cl', cl: 25, price: p25 },
      { label: '50cl', cl: 50, price: p50 },
    ],
  })

export const MENU: MenuItem[] = [
  // ───────── Entrées ─────────
  food('entrees', 'starter', 'Œufs mimosa grand-mère', 6, ['oeufs mimosa', 'oeuf mimosa', 'mimosa']),
  food('entrees', 'starter', 'Escargots de Bourgogne', null, ['escargots', 'escargot'], {
    sizes: [
      { label: 'x6', cl: undefined, price: 7.5 },
      { label: 'x12', cl: undefined, price: 14 },
    ],
    note: 'beurre maître d’hôtel',
  }),
  food('entrees', 'starter', 'Le potage de Mamie', 5, ['potage', 'soupe']),

  // ───────── Plats ─────────
  food('plats', 'main', 'Bavette d’Aloyau grillée', 17, ['bavette'], {
    cuisson: true,
    note: '220 g, frites maison et salade',
  }),
  food('plats', 'main', 'Confit de canard maison', 16.5, ['confit de canard', 'confit', 'canard'], {
    note: 'IGP Sud-Ouest',
  }),
  food('plats', 'main', 'Viande du jour', null, ['viande du jour', 'viande'], { note: 'voir ardoise' }),
  food('plats', 'main', 'Poisson du jour', null, ['poisson du jour', 'poisson'], { note: 'voir ardoise' }),
  food('plats', 'main', 'Salade César', 16, ['cesar', 'salade cesar', 'salade poulet pane']),
  food('plats', 'main', 'Salade de chèvre chaud', 15, [
    'salade de chevre',
    'salade chevre',
    'chevre chaud',
    'salade de chevre chaud miel',
  ]),

  // ───────── Desserts ─────────
  food('desserts', 'dessert', 'Café gourmand surprise', 7, ['cafe gourmand', 'gourmand']),
  food('desserts', 'dessert', 'Profiteroles', 8, ['profiterole']),
  food('desserts', 'dessert', 'Crème brûlée à la vanille', 5.5, ['creme brulee', 'brulee']),
  food('desserts', 'dessert', 'Crumble pommes & glace vanille', 5.5, ['crumble', 'crumble aux pommes']),
  food('desserts', 'dessert', 'Fromage blanc', 4, [], { note: 'caramel, miel ou coulis de fruits rouges' }),

  // ───────── Menu enfant ─────────
  food('enfant', 'main', 'Menu enfant sage', 10, ['menu enfant', 'enfant sage', 'menu enfant sage', 'menu enfants', 'poulet pane frites'], {
    note: 'poulet pané frites + glace ou fromage blanc',
  }),

  // ───────── Apéritifs & digestifs ─────────
  ...['Suze', 'Lillet', 'Martini'].map((n) => drink('aperitifs', n, 4, [], { note: '6cl' })),
  ...['Campari', 'Porto', 'Muscat'].map((n) => drink('aperitifs', n, 4, [], { note: '6cl' })),
  drink('aperitifs', 'Get 27', 6, ['get 27', 'get vingt sept', 'get'], { note: '6cl' }),
  drink('aperitifs', 'Manzana', 6, [], { note: '6cl' }),
  drink('aperitifs', 'Baileys', 6, ['bailey'], { note: '6cl' }),
  ...['Armagnac', 'Cognac', 'Calva', 'Poire'].map((n) => drink('aperitifs', n, 10, [], { note: '4cl' })),
  drink('aperitifs', 'JägerBomb', 8, ['jagerbomb', 'jager bomb', 'jager'], { note: '2cl' }),
  drink('aperitifs', 'Pastis 51', 2.7, ['pastis', 'cinquante et un', '51'], { note: '2cl' }),
  drink('aperitifs', 'Cristal', 2.7, [], { note: '2cl' }),
  drink('aperitifs', 'Casanis', 2.7, [], { note: '2cl' }),
  drink('shooters', 'Shooter classique', 4, ['shooter', 'shot'], { note: '2cl' }),
  drink('shooters', 'Shooter sup’', 5, ['shooter sup', 'shot sup'], { note: '2cl' }),

  // ───────── Bières pression ─────────
  pression('Blonde de soif', 3.5, 6, ['blonde']),
  pression('Blanche de France', 3.9, 7, ['blanche']),
  pression('Casque d’or', 3.9, 7, ['casque dor', 'casque']),
  pression('Tata IPA', 3.9, 7, ['tata', 'ipa']),
  pression('Bière du moment', 3.9, 7, ['biere du moment', 'pression du moment']),
  pression('Picon bière', 3.9, 7, ['picon']),

  // ───────── Bières bouteille ─────────
  drink('bouteille', 'Bière sans alcool', 5, ['biere sans alcool', 'sans alcool'], { note: '33cl' }),
  drink('bouteille', 'Bière brune', 6, ['brune', 'biere brune'], { note: '33cl' }),
  drink('bouteille', 'Cidre', 6, [], { note: '33cl' }),

  // ───────── Softs ─────────
  drink('softs', 'Jus de fruit Pago', 3.5, ['jus de fruit', 'jus', 'pago']),
  drink('softs', 'Sirop à l’eau', 2.5, ['sirop']),
  drink('softs', 'Soda', 3.5),
  drink('softs', 'Hexis', 4.5),
  drink('softs', 'Ginger beer', 4.5),
  drink('softs', 'Evian 1L', 6.5, ['evian', 'eau plate']),
  drink('softs', 'San Pellegrino 1L', 6.5, ['san pellegrino', 'pellegrino', 'eau gazeuse', 'eau petillante']),

  // ───────── Chaud ─────────
  drink('chaud', 'Café', 1.5, ['cafe', 'expresso', 'espresso', 'allonge']),
  drink('chaud', 'Noisette', 1.5),
  drink('chaud', 'Café au lait', 3.5, ['cafe au lait']),
  drink('chaud', 'Chocolat chaud', 3.5, ['chocolat']),
  drink('chaud', 'Cappuccino', 4.5, ['capuccino', 'cappucino']),
  drink('chaud', 'Viennois', 4.5),
  drink('chaud', 'Café latté', 4.5, ['cafe latte', 'latte']),
  drink('chaud', 'Café frappé', 4.5, ['cafe frappe', 'frappe']),
  drink('chaud', 'Thé Dammann', 3.5, ['the', 'dammann', 'the dammann']),

  // ───────── Gins tonic (4cl, Fever Tree +2€) ─────────
  drink('gins', 'Gin tonic Beefeater', 9, ['beefeater', 'beef eater', 'bifeater', 'gin tonic beefeater'], { note: 'citron vert, baies de genièvre' }),
  drink('gins', 'Gin tonic Tanqueray Ten', 10, ['tanqueray', 'tanqueray ten'], { note: 'menthe, orange' }),
  drink('gins', 'Gin tonic G’Vine', 10, ['g vine', 'gvine', 'gin vine', 'jivine'], { note: 'fruits rouges' }),
  drink('gins', 'Gin tonic Monkey 47', 11, ['monkey', 'monkey 47', 'monkey quarante sept'], { note: 'orange, baies de genièvre' }),
  drink('gins', 'Gin du moment', 10, ['gin du moment', 'gin tonic du moment', 'gin tonic', 'gin'], { note: '10–12€ selon le gin' }),

  // ───────── Vodkas / Téquilas ─────────
  drink('vodkas', 'Vodka Absolut', 9, ['absolut'], { note: '4cl' }),
  drink('vodkas', 'Vodka Belvedere', 11, ['belvedere'], { note: '4cl' }),
  drink('tequilas', 'Téquila Olmeca', 9, ['olmeca', 'tequila olmeca'], { note: '4cl' }),
  drink('tequilas', 'Téquila Patrón', 12, ['patron', 'tequila patron'], { note: '4cl' }),

  // ───────── Coquetels mouillés ─────────
  ...[
    'London Mule',
    'Gin Fizz',
    'Basilic Fizz',
    'Bambino',
    'Mojito',
    'Pina Colada',
    'Daïquiri',
    'Jamaican Mule',
    'Caïpirinha',
    'Bloody Mary',
    'White Russian',
    'Sex on the beach',
    'Espresso Martini',
    'Moscow Mule',
    'Margarita',
    'Mexican Mule',
  ].map((n) => drink('coquetels', n, 10, n === 'Pina Colada' ? ['pina colada', 'pina'] : n === 'Caïpirinha' ? ['caipirinha', 'caipi'] : n === 'Daïquiri' ? ['daiquiri'] : [])),
  drink('coquetels', 'Long Island', 11),
  drink('coquetels', 'Spritz', 9.5),
  drink('coquetels', 'Spritz St Germain', 10, ['spritz saint germain', 'spritz st germain', 'spritz germain']),

  // ───────── Rhums / Whiskies (4cl) ─────────
  drink('rhums', 'Havana 3 ans', 8, ['havana trois ans', 'havana 3', 'havana'], { note: '4cl' }),
  drink('rhums', 'Havana Especial', 9, ['havana especial'], { note: '4cl' }),
  drink('rhums', 'Hechicera (Colombie)', 10, ['hechicera'], { note: '4cl' }),
  drink('rhums', 'Plantation XO (Barbade)', 12, ['plantation', 'plantation xo'], { note: '4cl' }),
  drink('whiskies', 'Ballantine’s', 9, ['ballantines', 'ballantine'], { note: '4cl' }),
  drink('whiskies', 'Ballantine’s 12 ans', 10, ['ballantines 12', 'ballantine 12', 'ballantines douze ans', 'ballantine douze ans'], { note: '4cl' }),
  drink('whiskies', 'Jameson', 9, [], { note: '4cl' }),
  drink('whiskies', 'Four Roses', 10, ['four rose'], { note: '4cl' }),

  // ───────── Vins (carte non fournie → prix à renseigner) ─────────
  ...[
    ['Vin rouge', ['vin rouge', 'rouge']],
    ['Vin blanc', ['vin blanc', 'blanc']],
    ['Vin rosé', ['vin rose', 'rose']],
  ].map(([n, al]) =>
    drink('vins', n as string, null, al as string[], {
      sizes: [
        { label: '12cl', cl: 12, price: null },
        { label: '75cl', cl: 75, price: null },
      ],
      note: 'carte des vins à saisir',
    }),
  ),
]

export const MENU_BY_ID: Record<string, MenuItem> = Object.fromEntries(MENU.map((m) => [m.id, m]))

export function unitPrice(item: MenuItem, size?: string | null): number | null {
  if (item.sizes) {
    const s = item.sizes.find((x) => x.label === size) ?? item.sizes[0]
    return s.price
  }
  return item.price
}

/** Vocabulaire fourni à Whisper (paramètre `prompt`) pour fiabiliser les noms propres. */
export const WHISPER_PROMPT =
  'Commande au restaurant Chez Mamie, table numéro. ' +
  'Blonde de soif, Blanche de France, Casque d’or, Tata IPA, Picon bière, Suze, Lillet, Get 27, Pastis 51, Casanis, ' +
  'JägerBomb, Beefeater, Tanqueray Ten, G’Vine, Monkey 47, Mojito, Spritz St Germain, Moscow Mule, Caïpirinha, ' +
  'bavette saignante, confit de canard, escargots, œufs mimosa, salade César, profiteroles, crème brûlée, crumble, café gourmand.'

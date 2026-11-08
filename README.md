# Chez Mamie · prise de commande vocale (prototype)

Plan de salle + un gros bouton micro. On **maintient** le bouton, on dicte
(« table 7, deux blondes, une bavette saignante, un mojito sans glace »), les articles
s'affichent en direct ; au relâché on valide et on « envoie » une commande **en JSON** (`voice-pos-order/v1`)
prête à être poussée vers un POS. Pas de table dite → l'app demande laquelle.

## Lancer

```bash
npm install
npm run dev      # http://localhost:5173 (et l'URL réseau pour le téléphone)
npm test         # tests du parseur
```

Sur ordinateur : **maintenir la barre espace** = micro. Bouton ⌨ = saisir la phrase au clavier (utile pour tester sans micro).

> Le micro d'un navigateur exige **HTTPS** (sauf `localhost`). Pour tester sur téléphone : pousser sur GitHub
> (le workflow `.github/workflows/deploy.yml` publie sur GitHub Pages) puis ouvrir l'URL dans Safari/Chrome.

## Architecture (tout est côté front)

| Brique | Fichier | Choix MVP gratuit |
|---|---|---|
| Voix → texte | `src/lib/stt.ts` | **Web Speech API** (défaut, gratuit, texte en direct) ou **Whisper large-v3-turbo via Groq** (palier gratuit, plus précis, `prompt` avec les noms de la carte) |
| Texte → commande | `src/lib/parser.ts` | Parseur local déterministe (alias + fuzzy, quantités, tailles, cuisson, « sans X », table) : instantané, hors-ligne |
| Affinage | `src/lib/llm.ts` | Llama 3.3 70B via Groq, JSON contraint aux **ids de la carte** (aucun article inventé), repli sur le parseur local |
| Carte | `src/data/menu.ts` | Transcrite des photos (vins : prix à saisir) |
| Sortie POS | `src/lib/order.ts` → `toPosPayload` | JSON versionné ; webhook optionnel (⚙︎ Réglages) |

La clé Groq se colle dans ⚙︎ Réglages ; elle reste dans le `localStorage` de l'appareil (jamais dans le repo).

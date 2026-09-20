# NO CLIP — Backrooms

Jeu d'exploration mobile en 3D dans le navigateur, ambiance **Kane Pixels** :
found-footage, néons fluorescents qui grésillent, moquette humide, papier peint
jaune décrépit, brouillard qui avale les couloirs. **Aucun monstre** — l'expérience
repose entièrement sur l'ambiance et l'exploration.

Techno : [Three.js](https://threejs.org/) + [Vite](https://vitejs.dev/), 100%
navigateur, jouable au téléphone (et installable en PWA sur l'écran d'accueil).
Toutes les textures et tous les sons sont générés en code (canvas 2D / Web Audio),
il n'y a aucun asset externe à télécharger.

## Lancer en local

```bash
npm install
npm run dev -- --host
```

Ouvre l'URL affichée sur ton téléphone (même réseau Wi-Fi que l'ordinateur), ou
`http://localhost:5173` sur desktop.

## Build de production

```bash
npm run build
npm run preview -- --host
```

Le dossier `dist/` généré est un site statique déployable tel quel (Netlify,
Vercel, GitHub Pages, etc.).

## Contrôles

- **Mobile** : joystick tactile en bas à gauche pour se déplacer, glisser le
  doigt sur la moitié droite de l'écran pour regarder autour de soi.
- **Desktop** (pour tester) : `WASD`/flèches pour se déplacer, cliquer-glisser
  la souris pour regarder.

## Structure du code

```
index.html          point d'entrée, HUD, écran de démarrage
src/main.js          assemblage scène / boucle de rendu
src/maze.js           génération procédurale du plan (labyrinthe + salles ouvertes)
src/world.js           construction 3D (murs, sol, plafond, néons, lumières, fog)
src/materials.js      textures procédurales (canvas) : moquette, papier peint, plafond
src/controls.js        joystick, regard, collisions, head-bob
src/audio.js            ambiance sonore synthétisée (Web Audio API)
src/postfx.js            post-processing found-footage (grain, vignette, VHS, CA)
src/hud.js                incrustation caméscope (REC, timecode, batterie)
```

## Pistes d'évolution

- Génération infinie par chunks (actuellement un plan fixe de 24×24 cellules,
  mais le brouillard cache la limite).
- Éléments d'ambiance narrative (chaise déplacée, flaque, porte entrouverte).
- Vraie capture audio binaurale / reverb selon la taille des pièces.
- Version app native (Capacitor) pour publication sur store, si besoin.

---

*Historique : ce dépôt contenait auparavant `Yaksee.py`, un script CLI de
génération de payloads Metasploit, conservé ci-dessous pour mémoire mais sans
rapport avec le jeu.*

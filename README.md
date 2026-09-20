# NO CLIP — Backrooms

Jeu d'exploration mobile en 3D dans le navigateur, ambiance **Kane Pixels** :
found-footage, néons fluorescents qui grésillent, moquette humide, papier peint
jaune décrépit, brouillard qui avale les couloirs. **Aucun monstre** — l'expérience
repose entièrement sur l'ambiance et l'exploration.

Le labyrinthe classique ("backrooms" jaunes) relie quatre poches thématiques
cachées dans les coins de la carte :

- **Pool rooms** — carrelage blanc/crème humide, joints de mortier, lumière froide.
- **Hôtel** — grande cour intérieure entourée d'une façade à fenêtres (certaines
  allumées), sol pavé, ambiance nocturne bleutée.
- **Quartier pavillonnaire** — petites maisons vertes lisses, réverbères, pelouse
  et allée, le tout enfermé sous un "mur-ciel" peint avec des nuages, façon
  diorama.
- **Niveau Kitty** — corridors roses avec papier peint à motifs doux, moquette
  mauve et miroirs ovals accrochés aux murs.

Chaque zone teinte progressivement le brouillard et la lumière portée par le
joueur en s'en approchant, pour une transition douce entre les ambiances.

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
- **Boutons en haut à droite** : `VHS` bascule le post-processing found-footage
  (grain/vignette/aberration chromatique/VHS), l'icône ampoule bascule la lampe
  portée par le joueur (l'ambiance des néons/façades reste, seule cette source
  personnelle s'éteint).

## Structure du code

```
index.html          point d'entrée, HUD, écran de démarrage
src/main.js          assemblage scène / boucle de rendu, toggles VHS/lampe
src/zones.js           découpage du monde en zones thématiques (rectangles + hauteurs)
src/maze.js            génération procédurale du plan (labyrinthe + poches évidées)
src/world.js             construction 3D multi-thèmes (murs, sol, plafond, néons, décor, fog)
src/materials.js       textures procédurales (canvas) par thème : carrelage, façade, stuc...
src/controls.js         joystick, regard, collisions, head-bob
src/audio.js              ambiance sonore synthétisée (Web Audio API)
src/postfx.js              post-processing found-footage (grain, vignette, VHS, CA)
src/hud.js                  incrustation caméscope (REC, timecode, batterie, toggles)
```

## Pistes d'évolution

- Génération infinie par chunks (actuellement un plan fixe de 50×50 cellules,
  mais le brouillard cache la limite).
- Éléments d'ambiance narrative (chaise déplacée, flaque, porte entrouverte).
- Vraie capture audio binaurale / reverb selon la taille des pièces.
- Version app native (Capacitor) pour publication sur store, si besoin.
- D'autres poches thématiques (il suffit d'ajouter un rectangle dans `zones.js`
  + un thème de matériaux dans `world.js`).

---

*Historique : ce dépôt contenait auparavant `Yaksee.py`, un script CLI de
génération de payloads Metasploit, conservé ci-dessous pour mémoire mais sans
rapport avec le jeu.*

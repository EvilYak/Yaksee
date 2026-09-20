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

Le décor est en vraie géométrie 3D, pas juste des textures plaquées : toits à
deux pans avec pignons, fenêtres à cadre/vitre/appui en relief, portes avec
poignée, miroirs à cadre, plinthes au pied de tous les murs de couloir,
caissons encastrés autour des néons, **grille de plafond suspendu (T-bar) en
relief** et **joints de sol en relief** (moquette/carrelage/pavés) partout où
on marche, bordures de trottoir dans le quartier.

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

## APK Android

Le projet natif Android (Capacitor) est déjà généré dans `android/` — il n'y a
pas besoin de relancer `npx cap add android`. Je n'ai **pas pu compiler le
.apk directement dans cette session** : la sandbox où je tourne bloque l'accès
réseau à `dl.google.com` (le dépôt Maven de Google, nécessaire pour l'Android
Gradle Plugin et le SDK — j'ai vérifié, c'est un 403 explicite de la politique
réseau de l'environnement, pas un bug du projet).

Pour obtenir le `.apk` toi-même, deux options, chez toi où Google n'est pas
bloqué :

1. **Le plus simple** : installe [Android Studio](https://developer.android.com/studio),
   ouvre le dossier `android/`, laisse-le synchroniser Gradle, puis
   `Build > Build Bundle(s) / APK(s) > Build APK(s)`. L'APK signé debug apparaît
   dans `android/app/build/outputs/apk/debug/`.
2. **En ligne de commande** (avec un SDK Android installé et `ANDROID_HOME`
   défini) :
   ```bash
   npm run build
   npx cap sync android
   cd android
   ./gradlew assembleDebug
   ```
   L'APK est généré dans `android/app/build/outputs/apk/debug/app-debug.apk`,
   installable directement sur un téléphone (active "Sources inconnues").

Après toute modification du code web, relance `npm run build && npx cap sync
android` avant de rebuilder l'APK, pour que le natif embarque la dernière
version du site.

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
- Occlusion réelle (murs qui bloquent la vue) en plus du frustum culling par
  chunks déjà en place, pour couper encore plus de géométrie invisible.
- Signature + publication sur le Play Store (icônes adaptatives, splash screen,
  version release signée) une fois l'APK debug validé.
- D'autres poches thématiques (il suffit d'ajouter un rectangle dans `zones.js`
  + un thème de matériaux dans `world.js`).

---

*Historique : ce dépôt contenait auparavant `Yaksee.py`, un script CLI de
génération de payloads Metasploit, conservé ci-dessous pour mémoire mais sans
rapport avec le jeu.*

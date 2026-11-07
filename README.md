# L'Arène des Artefacts

Jeu de combat multijoueur en ligne, jouable sur téléphone (et sur PC).
Jusqu'à 6 joueurs par partie, rejoints par simple lien.

---

## 1. Tester sur ton ordinateur (5 minutes)

1. Installe **Node.js** (version 18 ou plus) : https://nodejs.org → bouton « LTS ».
2. Décompresse le dossier `arene`.
3. Ouvre un terminal dans ce dossier :
   - Windows : clic droit dans le dossier → « Ouvrir dans le terminal »
   - Mac : clic droit sur le dossier → « Nouveau terminal au dossier »
4. Tape :
   ```
   node server.js
   ```
5. Ouvre **http://localhost:3000** dans ton navigateur.

Aucune installation de paquet n'est nécessaire : le jeu n'a aucune dépendance.

**Jouer avec ton téléphone sur le même Wi-Fi** : trouve l'adresse IP de ton ordinateur
(Windows : `ipconfig`, Mac : Réglages → Wi-Fi → Détails), puis ouvre `http://TON-IP:3000`
sur le téléphone. Pour des amis à distance, il faut la mise en ligne ci-dessous.

---

## 2. Mettre le jeu en ligne gratuitement (Render)

Tu obtiendras une adresse du type `https://arene-des-artefacts.onrender.com`.

### Étape A — Mettre le code sur GitHub
1. Crée un compte sur https://github.com.
2. Clique sur **+** (en haut à droite) → **New repository**.
   Nom : `arene-des-artefacts`, laisse « Public », clique **Create repository**.
3. Sur la page suivante, clique **uploading an existing file**.
4. Glisse **le contenu** du dossier `arene` (le fichier `server.js`, `package.json`,
   `README.md` et le dossier `public`), puis clique **Commit changes**.

### Étape B — Créer le serveur sur Render
1. Crée un compte sur https://render.com (« Sign in with GitHub », c'est le plus simple).
2. Clique **New +** → **Web Service**.
3. Choisis ton dépôt `arene-des-artefacts` (autorise Render à y accéder si demandé).
4. Réglages :
   - **Language / Runtime** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `node server.js`
   - **Instance Type** : **Free**
5. Clique **Create Web Service**. Après 1 à 3 minutes, l'adresse du jeu s'affiche en haut.

### Bon à savoir sur l'offre gratuite
- Le serveur **s'endort après 15 minutes sans joueur**. La première visite suivante
  prend environ 50 secondes à charger : c'est normal, il se réveille.
- Pour éviter ça, l'offre payante « Starter » de Render (quelques dollars par mois) reste allumée.

### Mettre à jour le jeu
Remplace les fichiers sur GitHub (même méthode « Add file → Upload files »).
Render redéploie automatiquement.

---

## 3. Jouer

1. Ouvre l'adresse du jeu, entre ton pseudo, choisis ta classe, **Créer une partie**.
2. Dans le salon, appuie sur **Inviter des amis** : le lien se partage (WhatsApp, SMS…).
3. Choisis la carte, la durée, le score à atteindre et le mode (chacun pour soi ou 2 équipes).
4. **Lancer la partie**.

Astuce iPhone/Android : « Ajouter à l'écran d'accueil » depuis le navigateur ouvre le jeu
en plein écran, comme une vraie appli.

### Contrôles
| | Téléphone (paysage) | Ordinateur |
|---|---|---|
| Se déplacer | Joystick (moitié gauche de l'écran) | ZQSD, WASD ou flèches |
| Viser | Automatique (ennemi le plus proche) | Souris |
| Attaque | Bouton rouge | Clic gauche ou Espace |
| Compétence 1 | Bouton bleu | E |
| Compétence 2 | Bouton violet | R |

---

## 4. Modes de jeu

- **Chacun pour soi** et **2 équipes** : la partie se joue au chrono ou au score.
- **🛡️ Survie (coop)** : tous les joueurs sont dans la même équipe contre des vagues d'ennemis
  de plus en plus nombreuses et résistantes. Un **boss** arrive toutes les 5 vagues et lâche 3 artefacts.
  L'hôte choisit le nombre de **vies par joueur** (1, 3, 5 ou 10). Chaque vague repoussée soigne
  les survivants de 25 %. La partie s'arrête quand plus personne n'a de vie : le but est d'aller
  le plus loin possible. Toutes les cartes sont jouables en survie.

## 5. Règles du jeu

- **10 artefacts = évolution** : +50 % de vie, +30 % de dégâts, nouvelles compétences.
- Chaque artefact ramassé **soigne 5 % de la vie maximale**.
- Les artefacts sont rares : quelques-uns apparaissent au hasard sur la carte, et les PNJ vaincus en lâchent un 1 fois sur 3.
- **À la mort, on perd 1 artefact** (il tombe au sol, le tueur peut le ramasser).
  Sous 10 artefacts, l'évolution est perdue.
- Réapparition après 3 secondes, avec 1,5 seconde d'invulnérabilité.
- Seules les éliminations de joueurs comptent pour le score.

### Classes
| Classe | Compétence 1 | Compétence 2 | Évolution | Compétence 1 | Compétence 2 |
|---|---|---|---|---|---|
| 🔮 Mage | Boule de feu (explose en zone) | Téléportation | **Liche** | Nuée d'âmes (7 projectiles) | Invoque 2 squelettes |
| 🪓 Barbare | Charge (renverse et étourdit) | Tourbillon | **Golem** | Séisme (zone, étourdit) | Carapace 6 s (−70 % dégâts, renvoie 30 %, insensible aux étourdissements) |
| 🥷 Ninja | 3 shurikens | Invisibilité 5 s (cassée dès qu'il attaque, attaque surprise +50 %) | **Serpent géant** | Morsure venimeuse | Constriction (immobilise) |

### Cartes et PNJ
- 🏛️ **Colisée romain** : gladiateurs et lions
- 🌴 **Jungle amazonienne** : jaguars et guerriers lanceurs de lances
- 🏙️ **Zone urbaine** : voyous et drones tireurs
- 🏜️ **Désert** : scorpions et nomades archers — les **sables mouvants** ralentissent fortement
- 🪐 **Planète spatiale** : aliens et sentinelles à plasma
- 🧊 **Désert glacé** : loups des glaces et yétis — les **geysers** bouillonnent (cercle rouge) puis jaillissent et blessent
- 🦖 **Monde des dinosaures** : raptors, dilophosaures cracheurs d'acide et T-Rex
- ☣️ **Zone post-apo** : zombies, zombies coureurs et gros zombies

Si ton téléphone coupe la connexion (partage du lien, appel…), le jeu se reconnecte tout seul
et tu gardes ta place (et ton statut d'hôte) pendant 45 secondes.

---

## 6. Modifier l'équilibrage

Tout est dans `server.js` :
- `CLS` : vie et vitesse des classes
- `EVO_HP`, `EVO_DMG`, `EVO_AT` : bonus d'évolution et nombre d'artefacts requis
- fonctions `basic()` et `skill()` : dégâts et temps de recharge de chaque compétence
- `MOBS` : statistiques des PNJ

Options de test (à ne pas utiliser en ligne) : `TEST_ARTS=10 node server.js` fait démarrer
tout le monde évolué ; `TEST_DURATION=30` raccourcit la partie à 30 secondes ; `TEST_WAVE=4` fait commencer la survie à la vague 5.

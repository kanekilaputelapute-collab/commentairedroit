# ⚖️ Générateur de Commentaire d'Arrêt

Application web minimaliste pour générer automatiquement des commentaires d'arrêt en droit civil (droit des obligations) à partir d'un numéro de pourvoi, via l'API Google Gemini.

---

## 🗂️ Arborescence du projet

```
commentaire-arret/
├── public/
│   └── index.html        ← Frontend complet (HTML + CSS + JS)
├── server.js             ← Backend Express + appel Gemini
├── package.json
├── .env.example          ← Template de configuration
├── .env                  ← ⚠️ À créer (non versionné)
├── .gitignore
└── README.md
```

---

## 🚀 Installation & Lancement

### 1. Prérequis

- **Node.js ≥ 18** ([télécharger](https://nodejs.org))
- Une **clé API Google Gemini** ([obtenir gratuitement](https://aistudio.google.com/app/apikey))

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer la clé API

Copiez le fichier `.env.example` en `.env` :

```bash
cp .env.example .env
```

Ouvrez `.env` et remplacez la valeur :

```env
GEMINI_API_KEY=AIzaSy...votre_vraie_clé...
```

### 4. Lancer le serveur

```bash
# Production
npm start

# Développement (rechargement auto)
npm run dev
```

### 5. Ouvrir l'application

Rendez-vous sur → **http://localhost:3000**

---

## 📌 Où mettre la clé API ?

**Uniquement dans le fichier `.env`**, jamais dans le code source.

```
commentaire-arret/
└── .env          ← ici, ligne GEMINI_API_KEY=...
```

Le fichier `.env` est ignoré par Git (via `.gitignore`). Ne le commitez jamais.

---

## 🔧 Personnaliser le prompt

Le prompt est localisé dans `server.js`, dans la fonction `generateCommentary()` :

```js
const prompt = `
Tu es un juriste expert en droit civil français...
`;
```

Modifiez-le librement pour affiner la structure, le ton ou la longueur des commentaires.

---

## 🛠️ Stack technique

| Couche    | Technologie              |
|-----------|--------------------------|
| Frontend  | HTML5 + CSS3 + JS vanilla |
| Backend   | Node.js + Express 4      |
| IA        | Google Gemini 1.5 Pro    |
| Config    | dotenv                   |

---

## ⚠️ Avertissement

Cet outil est à vocation **pédagogique**. Les commentaires générés par intelligence artificielle sont indicatifs et ne constituent pas un avis juridique professionnel.

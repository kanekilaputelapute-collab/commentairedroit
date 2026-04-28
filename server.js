/**
 * server.js — Backend Express · Expert Droit Administratif
 * IA : Claude Sonnet 4.6
 */

require("dotenv").config();
const express = require("express");
const path    = require("path");
const fs      = require("fs");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Chargement de la base de jurisprudence au démarrage
const jurisprudenceData = JSON.parse(fs.readFileSync(path.join(__dirname, "jurisprudence.json"), "utf8"));
const jurisprudenceString = jurisprudenceData.map(a => `- ${a.nom} (${a.juridiction}, ${a.date}) [${a.theme}] : ${a.apport}`).join("\n");

async function generateDissertation(sujet) {
  const MODEL = "claude-sonnet-4-6";
  const URL   = "https://api.anthropic.com/v1/messages";

  const prompt = `Tu es un professeur agrégé de droit public. Sujet : "${sujet}".

BASE JURISPRUDENTIELLE VÉRIFIÉE — Tu dois UNIQUEMENT utiliser les arrêts listés ci-dessous. Ne jamais citer un arrêt qui n'y figure pas.
${jurisprudenceString}

Génère un plan de dissertation en droit administratif français avec ce format EXACT :

INTRODUCTION
Amorce : [3 phrases de contexte]
Problématique : [1 question]

I. [TITRE PARTIE 1]
  A. [Titre sous-partie]
    → Idée : [1 ligne — l'idée à démontrer ET en quoi elle répond à la problématique]
    → Arrêt : [Nom exact, juridiction, date exacte — 1 ligne expliquant comment cet arrêt démontre concrètement l'idée et répond à la problématique]

  B. [Titre sous-partie]
    → Idée : [1 ligne — l'idée à démontrer ET en quoi elle répond à la problématique]
    → Arrêt : [Nom exact, juridiction, date exacte — 1 ligne expliquant comment cet arrêt démontre concrètement l'idée et répond à la problématique]

II. [TITRE PARTIE 2]
  A. [Titre sous-partie]
    → Idée : [1 ligne — l'idée à démontrer ET en quoi elle répond à la problématique]
    → Arrêt : [Nom exact, juridiction, date exacte — 1 ligne expliquant comment cet arrêt démontre concrètement l'idée et répond à la problématique]

  B. [Titre sous-partie]
    → Idée : [1 ligne — l'idée à démontrer ET en quoi elle répond à la problématique]
    → Arrêt : [Nom exact, juridiction, date exacte — 1 ligne expliquant comment cet arrêt démontre concrètement l'idée et répond à la problématique]

RÈGLES ABSOLUES :
- Idée : strictement 1 ligne
- Arrêt : strictement 1 ligne (référence + lien avec l'idée et la problématique)
- N'utiliser QUE les arrêts de la base fournie ci-dessus. Si aucun arrêt ne convient, écrire : Arrêt : [aucun arrêt disponible dans la base]
- Ne jamais inventer un arrêt. Si tu n'es pas certain à 100%, écrire "Arrêt : [à vérifier]"
- Pas de développement rédigé, uniquement les flèches
- Pas d'émojis
- Respecter exactement le format ci-dessus`;

  const response = await fetch(URL, {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("Erreur détaillée:", result);
    throw new Error(result.error?.message || "Erreur Anthropic");
  }

  return result.content[0].text;
}

app.post("/generate", async (req, res) => {
  try {
    const data = await generateDissertation(req.body.sujet);
    res.json({ dissertation: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`🏛️ Serveur Claude : http://localhost:${PORT}`));
/**
 * server.js — Backend Express · Générateur de Commentaire d'Arrêt
 * Stack : Node.js + Express + Judilibre (open data Cour de cassation) + Gemini 3.1 Flash-Lite
 */

require("dotenv").config();
const express = require("express");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Vérification clé Gemini ────────────────────────────────────────────────────
if (!process.env.GEMINI_API_KEY) {
  console.error("❌  GEMINI_API_KEY manquante dans .env");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉTAPE 1 — Recherche de l'arrêt via l'API Judilibre (Cour de cassation)
//
// Judilibre est l'open data officiel gratuit de la Cour de cassation.
// Inscription clé : https://piste.gouv.fr  (chercher "Judilibre")
// Sans clé JUDILIBRE_API_KEY dans .env → on passe directement à Gemini
// avec les seules métadonnées fournies par l'utilisateur.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchArretFromJudilibre(pourvoi, chambre, date) {
  const apiKey = process.env.JUDILIBRE_API_KEY;
  if (!apiKey) {
    console.log("ℹ️   Pas de clé Judilibre — utilisation de la connaissance interne de Gemini.");
    return null;
  }

  const params = new URLSearchParams({ query: pourvoi, page_size: 5 });
  const url = `https://api.piste.gouv.fr/cassation/judilibre/v1.0/search?${params}`;

  try {
    const res = await fetch(url, {
      headers: { "KeyId": apiKey, "accept": "application/json" },
    });

    if (!res.ok) {
      console.warn(`⚠️   Judilibre HTTP ${res.status} — on continue sans le texte.`);
      return null;
    }

    const data  = await res.json();
    const results = data?.results || [];

    if (results.length === 0) {
      console.log("ℹ️   Judilibre : aucun résultat pour ce numéro de pourvoi.");
      return null;
    }

    // Choisir la décision qui correspond le mieux à chambre + date si plusieurs résultats
    let best = results[0];
    if (results.length > 1) {
      const chambreNorm = chambre.toLowerCase();
      const dateNorm    = date ? date.toLowerCase() : "";
      for (const r of results) {
        const rChambre = (r.chamber || "").toLowerCase();
        const rDate    = (r.decision_date || "").toLowerCase();
        if (rChambre.includes(chambreNorm) || chambreNorm.includes(rChambre)) {
          if (!dateNorm || rDate.includes(dateNorm.slice(0, 4))) {
            best = r;
            break;
          }
        }
      }
    }

    // Récupérer le texte complet si un id est disponible
    let texteComplet = best.text || best.summary || null;
    if (best.id && !texteComplet) {
      const detailRes = await fetch(
        `https://api.piste.gouv.fr/cassation/judilibre/v1.0/decision?id=${best.id}`,
        { headers: { "KeyId": apiKey, "accept": "application/json" } }
      );
      if (detailRes.ok) {
        const detail = await detailRes.json();
        texteComplet = detail.text || detail.summary || null;
      }
    }

    return {
      id:       best.id,
      chambre:  best.chamber  || chambre,
      date:     best.decision_date || date,
      solution: best.solution || null,
      texte:    texteComplet,
    };

  } catch (err) {
    console.warn("⚠️   Erreur Judilibre :", err.message, "— on continue sans le texte.");
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉTAPE 2 — Génération du commentaire via Gemini
// ─────────────────────────────────────────────────────────────────────────────
async function generateCommentary(pourvoi, chambre, date, arret) {
  const MODEL = "gemini-3.1-flash-lite-preview";
  const URL   = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  // ── Contexte arrêt ──────────────────────────────────────────────────────
  let contexteArret;
  if (arret && arret.texte) {
    contexteArret = `
L'arrêt a été retrouvé dans la base Judilibre. Voici son texte intégral (source officielle) :

--- DÉBUT DU TEXTE DE L'ARRÊT ---
${arret.texte.slice(0, 12000)}
--- FIN DU TEXTE DE L'ARRÊT ---

Chambre : ${arret.chambre}
Date : ${arret.date}
Solution : ${arret.solution || "non précisée"}
`.trim();
  } else if (arret) {
    contexteArret = `
L'arrêt a été partiellement identifié dans Judilibre mais son texte intégral n'est pas disponible.
Chambre : ${arret.chambre}
Date : ${arret.date}
Solution : ${arret.solution || "non précisée"}
Utilise ces métadonnées et ta connaissance interne pour rédiger le commentaire.
`.trim();
  } else {
    contexteArret = `
Aucun texte d'arrêt n'a pu être récupéré automatiquement.
Éléments fournis par l'utilisateur :
- Numéro de pourvoi : ${pourvoi}
- Chambre : ${chambre}
- Date : ${date || "non renseignée"}

Si ces éléments te permettent d'identifier l'arrêt à partir de ta connaissance interne (cutoff janvier 2025), utilise-la.
Sinon, signale-le clairement à l'utilisateur et rédige un commentaire type sur une problématique plausible du droit des obligations pour cette chambre.
`.trim();
  }

  // ── Prompt complet ──────────────────────────────────────────────────────
  const prompt = `Tu es un professeur agrégé de droit privé français, expert en droit des obligations et correcteur de copies de Master.

TON OBJECTIF : Produire un plan de commentaire d'arrêt d'une rigueur académique absolue.

=== RÈGLES D'OR : VÉRITÉ, RIGUEUR ET CONCENTRATION ===
- L'ARGUMENTATION DOIT ÊTRE CENTRÉE EXCLUSIVEMENT SUR L'ARRÊT À COMMENTER (n° ${pourvoi}).
- MAXIMUM 1 RÉFÉRENCE DOCTRINALE POUR TOUT LE DEVOIR : Elle doit servir d'illustration ponctuelle et ne doit en aucun cas être le pivot de l'argumentation.
- MAXIMUM 1 RÉFÉRENCE JURISPRUDENTIELLE COMPLÉMENTAIRE POUR TOUT LE DEVOIR : L'argumentation ne doit pas tourner autour d'elle.
- NE JAMAIS INVENTER de doctrine, de noms de professeurs ou de jurisprudence.
- Utilise exclusivement des auteurs reconnus (ex: Carbonnier, Terré, Simler, Lequette, Mazeaud, Ghestin, Viney, Jourdain, Malinvaud, Stoffel-Munck, Fabre-Magnan, Aubert, Savatier).
- Si tu cites un arrêt complémentaire, il doit être RÉEL et PRÉCIS (Chambre, date, et si possible numéro de pourvoi).
- Si tu n'es pas certain d'une référence, NE L'UTILISE PAS. L'exactitude est ta priorité absolue.
- NE PAS UTILISER D'EMOJIS dans ta réponse.

=== STRUCTURE ATTENDUE ===

1. PHRASE D'AMORCE ET LIEN AVEC L'ARRÊT
- Une phrase d'accroche percutante liée à la problématique de l'arrêt.
- Un lien direct expliquant comment l'arrêt n° ${pourvoi} s'inscrit précisément dans cette problématique.

2. PLAN ULTRA-DÉTAILLÉ (I. A, B / II. A, B)
Le plan doit être technique, sans verbe conjugué dans les titres. Pour chaque sous-partie (A et B), fournis :

---
**[TITRE TECHNIQUE ET QUALIFIÉ]**

THÈSE CENTRALE : [Une phrase résumant l'idée directrice de la sous-partie.]

COMMENT DÉBUTER : [Une phrase d'attaque rédigée que l'étudiant peut utiliser.]

ARGUMENTATION DÉTAILLÉE :
[L'argumentation doit porter sur l'analyse intrinsèque de la solution de la Cour de cassation]
- [Argument 1 : Analyse technique et textuelle de la solution de la Cour dans cet arrêt.]
- [Argument 2 : Justification de la solution ou critique par rapport aux faits de l'espèce.]
- [Argument 3 : Portée juridique immédiate de la décision pour les parties ou le droit des obligations.]

*Note : La doctrine unique ou la jurisprudence unique autorisée doit être insérée discrètement dans l'une de ces sections uniquement si cela est pertinent.*

EXEMPLES / RÉFÉRENCES : [Uniquement si nécessaire et vérifié.]
---

3. TRANSITIONS
- Une transition rédigée (2-3 phrases) entre le I et le II, faisant le bilan du I pour annoncer la logique du II.

=== INFORMATIONS SUR L'ARRÊT ===
- Pourvoi : ${pourvoi}
- Chambre : ${chambre || "à identifier"}
- Date : ${date || "à identifier"}

${contexteArret}

Produis un contenu directement exploitable, sans préambule inutile.`;

  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 1.0, maxOutputTokens: 4096 },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || `Erreur Gemini HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Réponse vide de l'API Gemini.");
  return text;
}

// ── Route POST /generate ───────────────────────────────────────────────────────
app.post("/generate", async (req, res) => {
  const { pourvoi, chambre, date } = req.body;

  if (!pourvoi || typeof pourvoi !== "string" || pourvoi.trim().length < 3) {
    return res.status(400).json({ error: "Numéro de pourvoi invalide ou manquant." });
  }
  // chambre est optionnelle

  const p = pourvoi.trim();
  const c = chambre.trim();
  const d = (date && typeof date === "string") ? date.trim() : null;

  console.log(`\n📄  Nouveau commentaire — ${c} · ${d || "date N/A"} · n° ${p}`);

  try {
    // Étape 1 : chercher l'arrêt sur Judilibre
    console.log("🔍  Recherche Judilibre…");
    const arret = await fetchArretFromJudilibre(p, c, d);
    if (arret) {
      console.log(`✅  Arrêt trouvé : ${arret.chambre} · ${arret.date} — texte : ${arret.texte ? "oui" : "non"}`);
    }

    // Étape 2 : générer avec Gemini
    console.log("🤖  Envoi à Gemini…");
    const commentary = await generateCommentary(p, c, d, arret);
    console.log(`✅  Commentaire généré (${commentary.length} caractères)`);

    res.json({ commentary });

  } catch (err) {
    console.error("❌  Erreur :", err.message);
    res.status(500).json({ error: `Erreur : ${err.message}` });
  }
});

// ── Fallback ───────────────────────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Démarrage ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n⚖️   Serveur : http://localhost:${PORT}`);
  console.log(`🔑  Gemini   : ${process.env.GEMINI_API_KEY  ? "✅" : "❌ MANQUANTE"}`);
  console.log(`🔑  Judilibre: ${process.env.JUDILIBRE_API_KEY ? "✅" : "⚠️  non configurée (arrêts < jan 2025 uniquement)"}\n`);
});

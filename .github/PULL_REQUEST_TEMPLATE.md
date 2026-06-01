## Validation post-déploiement

> Automatique : lancer `npm run build && npm run validate:pwa` avant de cocher la section 0.
> Manuel : les sections 1 à 6 se testent sur la Deploy Preview Netlify de cette PR.

### 0. Build & vérif automatique
- [ ] Build Netlify vert
- [ ] `npm run validate:pwa` : tous les contrôles au vert
- [ ] Aucune erreur console à l'ouverture

### 1. Installabilité PWA — Android (Chrome)
- [ ] Menu « Installer l'application » proposé
- [ ] Icône nette sur l'écran d'accueil, lancement en mode standalone

### 2. Installabilité PWA — iPhone (Safari uniquement)
- [ ] Partager → « Sur l'écran d'accueil », icône correcte
- [ ] Lancement plein écran sans chrome Safari, pas d'écran blanc

### 3. Offline
- [ ] Après une visite en ligne, rechargement hors-ligne : le shell se charge
- [ ] Session restaurée (fichier, personne, onglet) ; tuiles carte déjà vues présentes

### 4. Appel IA par fournisseur
- [ ] Claude (Anthropic) : réponse OK, appel api.anthropic.com en 200
- [ ] ChatGPT (OpenAI) : réponse OK, appel api.openai.com en 200
- [ ] OpenRouter : réponse OK, appel openrouter.ai en 200
- [ ] Ollama sur HTTPS : avertissement mixed-content affiché, appel bloqué (ATTENDU)
- [ ] Ollama en local (npm run dev) : réponse OK

### 5. Sécurité des clés
- [ ] Champ clé masqué + note « stockée uniquement dans le navigateur »
- [ ] Clé envoyée uniquement à l'API du fournisseur choisi (rien vers Netlify/autre)
- [ ] Config conservée après rechargement (localStorage)

### 6. Non-régression
- [ ] Import GEDCOM + CSV OK
- [ ] Les 13 vues s'affichent sans erreur
- [ ] Bascule entre fournisseurs sans casse, aucune erreur console

### 7. Feu vert merge
- [ ] Tout coché sauf la limitation Ollama-sur-HTTPS (documentée)
- [ ] CHANGELOG.md et CONTEXT.md à jour

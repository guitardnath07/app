# CityPulse — PRD

## Original problem statement
App mobile "CityPulse" : assistant intelligent de sorties, bons plans et organisation de journées sous contrainte de budget (ville : Tours). 4 onglets : Découvrir, Bons Plans & Promos, Organisateur IA, Budget & Profil. Design moderne (Citymapper x Airbnb), sombre par défaut, animations fluides, sobriété.

## User choices
- Ville : Tours · Moteur : algorithme local + Claude Sonnet (titres/conseils) · Auth : Google (Emergent) · Carte stylisée intégrée (SVG) · Thème sombre par défaut (toggle clair)

## Architecture
- Backend FastAPI (/app/backend): server.py (routes /api), planner.py (algorithme), data.py (16 lieux + 12 bons plans/braderies mock). MongoDB: users, user_sessions, favorites, claims, itineraries.
- Frontend Expo Router: (tabs) index/deals/planner/profile, place/[id], itinerary/[id], journal, favorites. src/: auth, api, theme, components (ui, sheet, toast, place-card, city-map, deal-sheet, timeline, login-screen).
- Mocks : météo, temps de trajet (haversine + vitesses par mode, tickets Fil Bleu), données lieux.

## Implemented (2026-06)
- Google login, session Bearer, logout
- Découvrir: recherche, filtres catégories/prix/ouvert/bons plans, liste + carte stylisée, fiche lieu (photos, avis, horaires semaine, transports, bons plans + QR)
- Bons plans: ventes flash (<24h, compte à rebours), filtres, QR code promo individuel, braderies
- Organisateur: formulaire complet, timeline heure par heure avec trajets, coût ≤ budget, prix plein vs bons plans, modifier une étape, régénérer, enregistrer; titre/résumé/conseils IA (Claude)
- Profil: total économisé, graphique mensuel, stats, carnet de voyage, favoris, thème clair/sombre
- Tests: backend 21/21, frontend flows OK (iteration_1)

## Backlog
- P1: partage d'itinéraire, réservation, date future de sortie dans le planner
- P1: vraie carte (react-native-maps en build natif), géolocalisation
- P2: espace commerçant pour publier des bons plans, abonnement premium

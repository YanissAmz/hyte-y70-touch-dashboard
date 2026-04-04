# Étude de marché — Dashboard écran PC case tactile

## Ce qui existe

### HYTE Nexus (officiel)
- v2.14.3 (mars 2026), Windows only, aucun support Linux
- Widgets drag-and-drop, monitoring, RGB via OpenRGB SDK
- https://hyte.com/nexus

### AIDA64 SensorPanel
- Windows only, très populaire mais UX datée (2010-era)
- **Marché de skins payants** sur aidaskins.com : **$29/skin**
- Couvre plusieurs résolutions dont HYTE Touch
- https://www.aida64.com/sensorpanels

### NZXT CAM + Web Integrations
- Windows only, pour Kraken LCD
- API Web Integration ouverte → petits projets open source (nzxt-esc)
- https://developer.nzxt.com/

### Projets open source
- **HyteTouch** (GitHub: kassimir/HyteTouch) — Electron, 0 stars, abandonné, Windows
- **KrakenZPlayground** — NZXT Kraken Z, communication USB
- **liquidctl** — contrôle coolers Linux, pas de support HYTE
- **Monitrix** — dashboard FastAPI basique, pas tactile

## Ce qui manque

- **ZERO solution Linux** pour écrans PC case tactiles
- Pas de dashboard tout-en-un (monitoring + LED + browser + lanceur + clavier virtuel)
- Pas de solution web-based cross-platform
- Pas de touch navigation moderne avec glassmorphism

## Opportunité commerciale

### Positionnement
**Premier dashboard open-source, cross-platform, web-based pour écrans PC case tactiles**

### Monétisation
1. **Thèmes/skins premium** — $15-30/skin (modèle prouvé par aidaskins.com)
2. **Vente appli complète** — $20-50 sur Gumroad/itch.io
3. **Freemium** — core open source + thèmes premium
4. **GitHub Sponsors / Patreon** — communauté Linux gaming en demande

### Avantages concurrentiels
- Seule solution Linux
- Web-based = cross-platform par nature
- Touch natif + glassmorphism moderne
- Intégration LED serial + monitoring + browser + lanceur
- Stack légère (FastAPI + vanilla JS, pas d'Electron)

## Sources
- https://hyte.com/nexus
- https://hyte.com/nexus/releases
- https://aidaskins.com/
- https://github.com/kassimir/HyteTouch
- https://github.com/mrgogo7/nzxt-esc/
- https://developer.nzxt.com/
- https://www.facebook.com/groups/hytebuilds/posts/1139417087330146/

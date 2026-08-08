# jaivienkendrick.com

This repository contains Jaivien Kendrick's personal portfolio and interactive résumé website. It was built to present Jaivien's work in AI automation, operations strategy, consulting, and technical leadership through a distinctive, cinematic web experience.

The main portfolio is a handcrafted static page. Its résumé button launches a React-powered “Mission Dossier” overlay that turns the résumé into a scroll-driven 3D scene with section highlights and motion effects.

## Features

- Personal portfolio, experience, projects, skills, and contact information
- Interactive résumé experience
- Scroll-driven 3D document scene
- WebGL fallback for unsupported devices
- Motion and responsive design
- Downloadable résumé assets
- Vercel-friendly single-page deployment

## Tech stack

- React 19 and TypeScript
- Vite
- Three.js with React Three Fiber and Drei
- Framer Motion
- HTML and CSS

## Local development

Requirements:

- Node.js
- npm

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production

Build and preview the optimized site:

```bash
npm run build
npm run preview
```

The production output is written to `dist/`. The included `vercel.json` supports deployment on Vercel.

## Project structure

- `index.html` — main portfolio page and styling
- `src/main.tsx` — mounts the résumé viewer
- `src/ResumeViewer.tsx` — interactive 3D résumé experience
- `public/` — profile image, résumé preview, favicon, and public résumé
- `resume.pdf` — downloadable résumé source

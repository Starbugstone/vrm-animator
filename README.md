# VRM Animator

Local React/Vite dev shell for the `waifu_hologram_webpage.jsx` VRM hologram viewer.

## Requirements

- Node.js 18 or newer
- npm
- Internet access for the embedded viewer imports (`three` and `@pixiv/three-vrm` are loaded from jsDelivr inside the iframe)

## Local development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Vite will print a local URL, usually `http://localhost:5173/`.

## Production build

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Project structure

- `waifu_hologram_webpage.jsx`: main hologram UI and embedded Three.js/VRM viewer
- `src/main.jsx`: React entry point
- `src/App.jsx`: mounts the existing hologram page component
- `src/index.css`: Tailwind entry CSS

## Using the app

1. Run `npm run dev`.
2. Open the local Vite URL in your browser.
3. Upload a `.vrm` or `.glb` avatar with the left-side upload panel.
4. Use the on-screen test actions, or call the tool API from the browser console:

```js
window.hologramTool.execute('dance')
window.dispatchEvent(new CustomEvent('hologram-command', { detail: { command: 'jump' } }))
```

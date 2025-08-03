# CodeMirror 6 — RTL & Hebrew Ready Editor

English UI web app built with Vite + TypeScript. The editor supports RTL and Hebrew. Includes toolbar for LTR/RTL/Auto direction, Light/Dark theme toggle, and a button to insert Hebrew sample content.

## Scripts

- `npm run dev` — Start Vite dev server
- `npm run build` — Type-check and build for production
- `npm run preview` — Preview built app

## Run locally

1. Install dependencies
   ```
   npm install
   ```
2. Start dev server
   ```
   npm run dev
   ```
   Open the printed Local URL in your browser (typically http://localhost:5173/).

## Features

- English UI, stylized layout
- CodeMirror 6 with minimal curated extensions
- Direction options:
  - LTR — forces left-to-right
  - RTL — forces right-to-left
  - Auto — detects from first non-empty line (Hebrew/Arabic triggers RTL)
- Light/Dark theme toggle (One Dark)
- Insert Hebrew sample text for quick verification
- Font stack includes Inter and Noto Sans Hebrew

## Notes

- Mixed-direction text is supported; for consistent behavior in Hebrew paragraphs, prefer RTL or Auto mode.
- Accessibility: keyboard focus styles, status bar announcements, and ARIA labels included.
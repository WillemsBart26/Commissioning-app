# EDP Reports v4.0

Installable, offline-first web app (PWA) for field reports, in **English, Nederlands and Français**:

- **Commissioning Report** – Pass / Fail / N/A checklist, measurements, photos and sign-off
- **Site Safety Inspection** – OK / NOK / N/A per question, actions and photos
- **SPAQUE Inspection Report** – reference photos with parts, checklist, photo overview

All three create a PDF on the phone (in the selected language) that can be downloaded or shared to Outlook, Mail or Teams.

## Language
The app opens in the phone's language (NL / FR / EN, otherwise English). Switch at any time with the NL · FR · EN buttons in the header; the choice is remembered. Standard checklist questions follow the language; questions you renamed or added yourself keep your own text.

## Files
| File | Purpose |
|---|---|
| `index.html`, `app.js` | Home screen, Commissioning and Site Safety |
| `spaque.html`, `spaque.js` | SPAQUE inspection |
| `i18n.js` | All texts in EN / NL / FR |
| `common.js` | Shared helpers: photo compression, saving, PDF header/footer, sharing |
| `pdf-engine.js` | Offline PDF writer |
| `styles.css` | EDP styling for all modules |
| `sw.js` | Offline cache |
| `assets/` | EDP logo, app icons, SPAQUE reference photos |

## Publish
Upload the complete folder (keep `assets/` with it) to an HTTPS host, e.g. GitHub Pages. Open the link once while online, then install via the browser menu ("Install app" / "Add to Home Screen").

## Releasing an update
Change `CACHE` in `sw.js` (e.g. `edp-reports-v4-1`) every time you publish, so installed phones download the new files.

## Data
Drafts and photos are stored only on the device (browser storage, about 5 MB). Photos are reduced to max. 1280 px JPEG. If storage is full the app shows a clear warning instead of silently losing data.

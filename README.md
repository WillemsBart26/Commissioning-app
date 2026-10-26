# EDP Reports v4.5

Installable, offline-first web app (PWA) for field reports, in **English, Nederlands and Français**:

- **Commissioning Report** – Pass / Fail / N/A checklist, measurements, photos and sign-off
- **Site Safety Inspection** – OK / NOK / N/A per question, actions and photos
- **SPAQUE Inspection Report** – reference photos with parts, checklist, photo overview

All three create a PDF on the phone (in the selected language) that can be downloaded or shared to Outlook, Mail or Teams.

## Language
The app opens in the phone's language (NL / FR / EN, otherwise English). Switch at any time with the NL · FR · EN buttons in the header; the choice is remembered. Standard checklist questions follow the language; questions you renamed or added yourself keep your own text.

## Login and VCA overview
- Everyone signs in with their **@edp.com** work e-mail (create account → confirm via e-mail → sign in). Other domains are refused by the database.
- **Project is mandatory** in all three reports before a PDF can be made.
- Every **Site Safety Inspection** PDF is registered (who, project, location, date, OK/NOK/N/A counts – no photos). Re-sending the same report does not count twice. Offline, it is queued and sent automatically when back online.
- Inspections done **outside the app** (e.g. on paper, before the app existed) can be entered per person and per year by the administrator in the VCA overview (column "Outside app"); they count towards the 12.
- Home screen shows each person's own progress towards **12 inspections per year (VCA)**.
- `dashboard.html` (VCA overview) is only visible to **supervisors** and the **administrator**: per person (on track / behind / reached), per project, all inspections, CSV export. Roles are managed by the administrator in `settings.html` (Settings), incl. giving rights in advance to people without an account.
- Backend: Supabase project "EDP Reports" (EU). The publishable key in `auth.js` is meant to be public; access is enforced by row-level security.

## Files
| File | Purpose |
|---|---|
| `index.html`, `app.js` | Home screen, Commissioning and Site Safety |
| `spaque.html`, `spaque.js` | SPAQUE inspection |
| `i18n.js` | All texts in EN / NL / FR |
| `auth.js` | Login, roles, report registration with offline queue |
| `dashboard.html`, `dashboard.js` | VCA overview for supervisors |
| `settings.html`, `settings.js` | Roles and rights (administrator) |
| `common.js` | Shared helpers: photo compression, saving, PDF header/footer, sharing |
| `pdf-engine.js` | Offline PDF writer |
| `styles.css` | EDP styling for all modules |
| `sw.js` | Offline cache |
| `assets/` | EDP logo, app icons, SPAQUE reference photos |

## Publish
Upload the complete folder (keep `assets/` with it) to an HTTPS host, e.g. GitHub Pages. Open the link once while online, then install via the browser menu ("Install app" / "Add to Home Screen").

## Releasing an update
Raise the version number in **three places** (same number everywhere), then publish:
1. `common.js` – `const VERSION = '4.6';`
2. `sw.js` – `const VERSION = '4.6';`
3. `version.json` – `"version": "4.6"` plus a few short lines per language under `notes` (what's new).

Everyone who opens the app (or brings it back to the front) gets a banner *"New version 4.6 available – Update now"*. After updating they see once *"Updated to version 4.6 – what's new"* with your notes. The app fetches pages and code network-first, so page and code always match; offline it uses the last saved copy.

## Data
Drafts and photos are stored only on the device (browser storage, about 5 MB). Photos are reduced to max. 1280 px JPEG. If storage is full the app shows a clear warning instead of silently losing data.

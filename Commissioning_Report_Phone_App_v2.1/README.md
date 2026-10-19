# Commissioning Report Phone App v2.1

This is the tested phone rebuild of the working **Commissioning Report v2.0 / v1.3 editable-row Windows version**. It is an installable, offline-first Progressive Web App (PWA) for Android and iPhone.

## Included functions

- Complete commissioning reports on a phone or tablet.
- Add, rename, or delete report rows and checklist items.
- Record measurements and functional tests.
- Take or select up to 12 photos; photos are compressed on the device.
- Preview and download a professional PDF.
- Share the PDF through the phone share sheet to Outlook, Mail, Teams, or another compatible app.
- Save the current draft and custom row layout locally on the device.
- Start a new report without losing the customised row template.
- Continue using the installed app offline after the first successful load.

The app itself uploads no report data or photos.

## Publish before installing

A phone requires the app files to be published together on an **HTTPS website**. OneDrive file preview or opening `index.html` directly is not a web deployment and will not provide reliable camera, offline, installation, or PDF-sharing behavior.

Upload this complete folder without renaming or separating its contents:

- `index.html`
- `styles.css`
- `app.js`
- `pdf-engine.js`
- `manifest.webmanifest`
- `sw.js`
- `assets/`

Suitable destinations include an approved internal HTTPS web server, SharePoint Framework/static hosting approved by IT, Azure Static Web Apps, GitHub Pages for non-confidential use, or another company-approved HTTPS host.

## Install on Android

1. Open the published HTTPS address in Chrome or Edge.
2. Tap the download arrow in the app header, or open the browser menu.
3. Choose **Install app** or **Add to Home screen**.
4. Confirm the installation.

## Install on iPhone

1. Open the published HTTPS address in Safari.
2. Tap the Safari **Share** button.
3. Choose **Add to Home Screen**.
4. Tap **Add**.

## First-use check

1. Open the installed app while online.
2. Enter a short test report.
3. Add one photo.
4. Tap **Preview PDF** and check the PDF.
5. Tap **Send PDF** and choose Outlook or Mail.
6. Close and reopen the app, then briefly test it with airplane mode enabled.

## Storage and privacy

- Draft data, custom rows, and compressed photos are stored only in that browser/app profile.
- Clearing website data or uninstalling the PWA deletes the saved draft.
- Browser storage is limited; remove photos if the app reports that storage is full.
- Final PDF files are shared only when the user taps **Send PDF** or **Download**.

## Recommended browsers

- Android: current Chrome or Edge.
- iPhone/iPad: current Safari.
- PDF file sharing support depends on the phone, browser, operating system, and target email app.

## Files for maintenance

- `index.html`: screen structure and install dialog.
- `styles.css`: visual design and phone layout.
- `app.js`: report behavior, editable fields, photo handling, PDF composition, and sharing.
- `pdf-engine.js`: offline PDF writer.
- `manifest.webmanifest`: installation metadata.
- `sw.js`: offline cache.

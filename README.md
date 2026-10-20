# Enerdeal Reports v3.0

Installable offline-first PWA with two report modules:
- Commissioning Report
- Site Safety Inspection

Both modules support local drafts, PDF download/sharing, editable checklist rows, optional photos per checklist question and general photos. Safety uses OK/NOK/N/A; Commissioning uses Pass/Fail/N/A.

## Publish
Upload the complete folder to the same HTTPS host. Keep all files and the assets folder together. Open the HTTPS link once while online, then install through the phone browser.

## Update note
The service worker cache name is `enerdeal-reports-v3-0`, so replacing the published files triggers a cache refresh. If an installed phone still shows the old app, close and reopen it while online or refresh the page once.

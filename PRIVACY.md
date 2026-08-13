# Privacy Policy — JUFO Scholar

Last updated: 2026-08-13

JUFO Scholar is a browser extension that shows JUFO (Julkaisufoorumi /
Finnish Publication Forum) and Norwegian publication-ranking badges on
Google Scholar profile and search pages.

## What the extension does with data

- **Venue names and paper titles** shown on the Google Scholar page you are
  viewing are read locally by the extension in order to look up a
  publication's ranking. When a venue can't be resolved from the extension's
  local database, the venue name / paper title (and, if available, an ISSN)
  is sent to one or both of these third-party APIs to complete the lookup:
  - `api.crossref.org` (Crossref) — venue-name/ISSN resolution
  - `jufo-rest.csc.fi` (CSC — IT Center for Science, on behalf of
    Julkaisufoorumi) — the source of the ranking data itself
- **Custom venue-name mappings** you define in the extension's popup are
  stored only in your browser's local extension storage
  (`storage`/`unlimitedStorage`). They are never transmitted anywhere.
- The bundled JUFO ranking dataset is refreshed automatically in the
  background (via the `alarms` permission) by fetching JUFO's own public
  data export. This is a one-way download; it does not transmit anything
  about you.

## What the extension does NOT do

- It does not collect, transmit, sell, or store any personally identifying
  information (name, email, address, government ID, etc.).
- It does not collect health, financial, authentication, or location data.
- It does not track your browsing history or activity outside the Google
  Scholar pages the extension is active on.
- It has no server or analytics of its own — there is nothing collected by
  the developer to disclose, because nothing is collected. The only data
  leaving your browser is the venue-name/title/ISSN lookups described above,
  sent directly from your browser to the two third-party APIs listed, for
  the sole purpose of retrieving ranking information.

## Third-party services

Requests to `api.crossref.org` and `jufo-rest.csc.fi` are subject to those
services' own terms and any data-handling practices they apply to incoming
API requests (e.g. standard server logs); this extension does not control
those services and sends them only the minimum needed for a lookup (a venue
name, paper title, or ISSN — never any identifying information about you).

## Source code

This extension's full source is public:
https://github.com/Trinli/jufo-scholar

## Changes to this policy

If this extension's data practices change, this document will be updated.

## Contact

Questions about this policy can be filed as an issue on the GitHub
repository linked above.

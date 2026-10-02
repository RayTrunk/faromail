# FARO Mail 0.4.10

FARO Mail 0.4.10 is a corrective release.

## Fixes

- Printing a multi-page PDF attachment only printed its first page. The
  underlying page/app containers were never reset for print, clipping the
  PDF viewer's content to one screen's height before pagination could lay it
  out across pages. Printing a message was unaffected.

## Downloads

- Windows x86_64 installer (Setup.exe)
- Windows x86_64 portable package
- SHA-256 checksums

Public packages contain no account, password or message data.

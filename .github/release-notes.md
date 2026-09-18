# FARO Mail 0.4.9

FARO Mail 0.4.9 packages a Windows installer alongside the portable build, fixes a security issue in the sender-icon fetcher, and finishes translating the interface.

## Security

- Fixed an SSRF issue in the sender-icon fetcher: a sender's mail server could redirect the outgoing favicon request to an internal address. Redirects are now re-validated at every hop.

## Fixes

- The bundled Windows engine could occasionally fail to start on the very first launch after installation; the connection-wait timeout was increased and startup diagnostics now survive an app restart.
- Printing a message with a PDF attachment open printed both the PDF and the underlying message.
- Several backend error messages were sent to the interface as raw French text instead of being translated.
- A handful of remaining hardcoded French strings in the interface are now translated.

## Changed

- New application icon and in-app logo.
- The window title and topbar no longer show the version number next to "FARO Mail".
- Account setup shows a hint with a direct link when the email domain is Gmail or iCloud (app-specific password required).
- Windows package now also ships as an installer (Inno Setup), in addition to the portable ZIP.

## Downloads

- Windows x86_64 installer (Setup.exe)
- Windows x86_64 portable package
- SHA-256 checksums

Public packages contain no account, password or message data.

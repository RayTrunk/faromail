# FARO Mail

<p align="center"><img src="resources/assets/faromail-logo.svg" alt="FARO Mail" width="220"></p>

[![Version](https://img.shields.io/badge/version-0.4.3-4f8bd8)](https://github.com/RayTrunk/faromail/releases)
[![Verification](https://github.com/RayTrunk/faromail/actions/workflows/verify.yml/badge.svg)](https://github.com/RayTrunk/faromail/actions/workflows/verify.yml)
[![Builds](https://github.com/RayTrunk/faromail/actions/workflows/build.yml/badge.svg)](https://github.com/RayTrunk/faromail/actions/workflows/build.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)

FARO Mail is a lightweight, local-first desktop email client built with
Neutralinojs and a self-contained Node.js engine. It manages several IMAP/SMTP
accounts without requiring Node.js to be installed on the target computer.

Currently released for **Windows only**.

![FARO Mail main window](docs/screenshots/faromail-main.png)

## Highlights

- Multiple IMAP and SMTP accounts with a unified inbox
- Incremental synchronisation, automatic startup check and cancellable activity
- Conversations, full-text search, date groups and unread/total counters
- Sent, spam and trash folders
- Labels directly from the message list
- Contacts, groups, avatars, trusted senders and address autocompletion
- Calendar with month, week, work-week and year views, ICS/ICAL/VCS/CSV import, read-only Internet ICS subscriptions and a collapsible main-window agenda pane
- Provider logos or custom account icons
- Compose, reply, reply all, forward, Cc, Bcc and attachments
- Per-account signatures, read receipt and delivery status requests
- winmail.dat (TNEF) decoding for messages sent from Outlook rich text
- Remote-content blocking and confirmation before opening external links
- Light and dark themes, German, French and English interfaces
- Complete ZIP backup and restore of settings, accounts, contacts, calendar and local mail
- Portable ZIP package and Windows installer, both with an embedded Node.js runtime

## Privacy

FARO Mail stores accounts, settings, the SQLite index and downloaded messages
locally in the `data/` directory. Public GitHub builds are always generated
without personal data. There is no FARO Mail cloud account and no telemetry.

**Never commit or publish the `data/` directory or a private build produced with
`--with-data`.** It may contain account credentials and complete messages.

## Download

A portable ZIP build and a Windows installer are attached to each
[GitHub Release](https://github.com/RayTrunk/faromail/releases).

### Windows

Two ways to install:

- **Installer**: run `FaroMail-<version>-Setup.exe`. No administrator rights
  required; installs to the current user's profile with a Start Menu shortcut.
- **Portable**: extract the ZIP archive, run `check_portable.cmd`, then launch
  `FaroMail.exe` directly. The folder is self-contained and can be moved or
  run from a USB drive.

Microsoft Edge WebView2 is required by the Neutralino window (already present
on current Windows 10/11 installations).

## Build from source

```bash
# Windows public package, from Windows PowerShell
.\build_windows.ps1 --fresh-npm
```

Personal local packages may be built with `--with-data`, but must never be
uploaded to GitHub.

## Automated GitHub publication

This repository includes one command centre:

```bash
./github.sh check
./github.sh init
./github.sh build
./github.sh release 0.3.3
```

- `init` creates/configures the GitHub repository and pushes the source
- `build` asks GitHub Actions to build Windows, then downloads it
- `release` updates the version, pushes a tag and publishes the Windows packages
- `check` verifies versions and prevents personal data from being tracked

Detailed instructions are available in [docs/PUBLISHING.md](docs/PUBLISHING.md).

## Project structure

```text
resources/             Neutralino HTML/CSS/JavaScript interface
engine/                Node.js IMAP/SMTP/SQLite engine
packaging/windows/     Inno Setup installer script
data/                  local private data, ignored by Git
build_linux.sh         self-contained Linux packaging
build_windows.ps1      self-contained Windows packaging
.github/workflows/     verification, builds and releases
```

## License

FARO Mail is distributed under the [Apache License 2.0](LICENSE).

_Last documentation update: 19 September 2026._

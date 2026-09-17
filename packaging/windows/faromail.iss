; FARO Mail — Installer Windows (Inno Setup)
; Empaquette le build portable déjà généré par build_windows.ps1
; (dossier build\windows\FaroMail-{#AppVersion}-windows-x86_64).
; Compilation : ISCC.exe packaging\windows\faromail.iss

#define AppVersion "0.4.3"
#define SourceDir "..\..\build\windows\FaroMail-" + AppVersion + "-windows-x86_64"

[Setup]
AppId={{9F2C7B6E-7B1E-4E3B-9E2A-3F6C1D8E2A4C}
AppName=FARO Mail
AppVersion={#AppVersion}
AppPublisher=R.Trunk / FARO Solutions
AppPublisherURL=https://github.com/RayTrunk/faromail
DefaultDirName={localappdata}\Programs\FARO Mail
DefaultGroupName=FARO Mail
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\..\build\windows
OutputBaseFilename=FaroMail-{#AppVersion}-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\FaroMail.exe
LicenseFile=..\..\LICENSE
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Dirs]
Name: "{app}\data"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Excludes: "data\*"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{group}\FARO Mail"; Filename: "{app}\FaroMail.exe"
Name: "{group}\{cm:UninstallProgram,FARO Mail}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\FARO Mail"; Filename: "{app}\FaroMail.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\FaroMail.exe"; Description: "{cm:LaunchProgram,FARO Mail}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Les données locales (comptes, index chiffré) ne sont supprimées que si
; l'utilisateur le confirme explicitement — jamais automatiquement.

; Inno Setup Script for NexusAI Studio with Complete Branding
; Designed & Crafted by Protik

#define MyAppName "NexusAI Studio"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Protik"
#define MyAppURL "https://github.com/Protik1810/NexusAI-Studio"
#define MyAppExeName "NexusAI Studio.exe"

[Setup]
AppId={{C8E28B93-9F7C-4C75-8D4F-1B2F7E4193A1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DisableProgramGroupPage=yes
DefaultGroupName={#MyAppName}
OutputDir=d:\genimg_comic\installer-output
OutputBaseFilename=NexusAI-Studio-Setup-1.0.0
SetupIconFile=d:\genimg_comic\electron\icon.ico
WizardImageFile=d:\genimg_comic\public\wizard-large.bmp
WizardSmallImageFile=d:\genimg_comic\public\wizard-small.bmp
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "d:\genimg_comic\release-pkg\NexusAI Studio-win32-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\electron\icon.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\electron\icon.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
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
OutputDir={#SourcePath}installer-output
OutputBaseFilename=NexusAI-Studio-Setup-1.0.0-Lightweight
SetupIconFile={#SourcePath}electron\icon.ico
WizardImageFile={#SourcePath}public\wizard-large.bmp
WizardSmallImageFile={#SourcePath}public\wizard-small.bmp
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
Source: "{#SourcePath}release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*\backend\win\cuda\*,*\backend\win\vulkan\*,*\backend\win\cpu\*,*\backend\win\llama\*,*\models\*,*\llm-models\*,*.safetensors,*.gguf,*.ckpt,*.bin,*.pt"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
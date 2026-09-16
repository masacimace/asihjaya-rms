#define MyAppName "ASIHJAYA Hardware Hub"
#ifndef AppVersion
  #define AppVersion "0.9.0"
#endif
#ifndef AppApiUrl
  #define AppApiUrl "https://ajsystem.id"
#endif
#ifndef PayloadRoot
  #define PayloadRoot "payload"
#endif

[Setup]
AppId={{D1020E37-36C2-4F07-A8D5-8837C932E9B4}
AppName={#MyAppName}
AppVersion={#AppVersion}
AppVerName={#MyAppName} {#AppVersion}
AppPublisher=ASIHJAYA
DefaultDirName={autopf}\ASIHJAYA\Hardware Hub
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=admin
SetupArchitecture=x64
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=output
OutputBaseFilename=ASIHJAYA-Hardware-Hub-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes
CloseApplications=yes
RestartApplications=no
UninstallDisplayName={#MyAppName}
VersionInfoVersion={#AppVersion}
VersionInfoProductName={#MyAppName}
VersionInfoCompany=ASIHJAYA

[Files]
Source: "{#PayloadRoot}\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PayloadRoot}\runtime\node.exe"; DestDir: "{app}\runtime"; Flags: ignoreversion
Source: "{#PayloadRoot}\tools\SumatraPDF.exe"; DestDir: "{app}\tools"; Flags: ignoreversion
Source: "THIRD_PARTY_NOTICES.txt"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{commonappdata}\ASIHJAYA\Hardware Hub"; Permissions: users-modify
Name: "{commonappdata}\ASIHJAYA\Hardware Hub\data"; Permissions: users-modify
Name: "{commonappdata}\ASIHJAYA\Hardware Hub\logs"; Permissions: users-modify
Name: "{commonappdata}\ASIHJAYA\Hardware Hub\support-bundles"; Permissions: users-modify
Name: "{commonappdata}\ASIHJAYA\Hardware Hub\uat-reports"; Permissions: users-modify

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""{app}\app\scripts\uninstall-startup-task.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "HardwareHubTask"

[Code]
const
  TaskName = 'Asihjaya Hardware Hub Agent';
  InstallerVersion = 'stage6-{#AppVersion}';

var
  InstallationPage: TInputQueryWizardPage;
  PrinterPage: TWizardPage;
  LabelPrinterCombo: TNewComboBox;
  DocumentPrinterCombo: TNewComboBox;
  RefreshPrintersButton: TNewButton;
  PrinterStatusLabel: TNewStaticText;
  RepairStatusLabel: TNewStaticText;
  TestLabelButton: TNewButton;
  TestDocumentButton: TNewButton;
  FinishDetailLabel: TNewStaticText;
  PrintersLoaded: Boolean;
  InstallSucceeded: Boolean;
  ExistingInstallation: Boolean;
  ExistingLabelPrinter: String;
  ExistingDocumentPrinter: String;

function Q(const Value: String): String;
begin
  Result := '"' + Value + '"';
end;

function AppRoot: String;
begin
  Result := ExpandConstant('{app}\app');
end;

function PrivateNode: String;
begin
  Result := ExpandConstant('{app}\runtime\node.exe');
end;

function StateDir: String;
begin
  Result := ExpandConstant('{commonappdata}\ASIHJAYA\Hardware Hub\data');
end;

function LogDir: String;
begin
  Result := ExpandConstant('{commonappdata}\ASIHJAYA\Hardware Hub\logs');
end;

function SupportDir: String;
begin
  Result := ExpandConstant('{commonappdata}\ASIHJAYA\Hardware Hub\support-bundles');
end;

function CredentialPath: String;
begin
  Result := StateDir + '\agent-credential.json';
end;

function EnvPath: String;
begin
  Result := AppRoot + '\.env';
end;

function PdfExecutable: String;
begin
  Result := ExpandConstant('{app}\tools\SumatraPDF.exe');
end;

function PowerShellExecutable: String;
begin
  Result := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
end;

function ReadExistingEnvValue(const Key: String): String;
var
  Lines: TArrayOfString;
  I: Integer;
  LineValue: String;
  Prefix: String;
begin
  Result := '';
  if not FileExists(EnvPath) then
    Exit;
  if not LoadStringsFromFile(EnvPath, Lines) then
    Exit;

  Prefix := Key + '=';
  for I := 0 to GetArrayLength(Lines) - 1 do
  begin
    LineValue := Trim(Lines[I]);
    if Pos(Prefix, LineValue) = 1 then
    begin
      Result := Trim(Copy(LineValue, Length(Prefix) + 1, Length(LineValue)));
      Exit;
    end;
  end;
end;

function SelectedLabelPrinter: String;
begin
  if LabelPrinterCombo.ItemIndex >= 0 then
    Result := LabelPrinterCombo.Items[LabelPrinterCombo.ItemIndex]
  else
    Result := '';
end;

function SelectedDocumentPrinter: String;
begin
  if DocumentPrinterCombo.ItemIndex >= 0 then
    Result := DocumentPrinterCombo.Items[DocumentPrinterCombo.ItemIndex]
  else
    Result := '';
end;

function PrinterLooksLikeLabel(const Value: String): Boolean;
var
  UpperValue: String;
begin
  UpperValue := Uppercase(Value);
  Result := (Pos('SATO', UpperValue) > 0) and (Pos('CG408', UpperValue) > 0);
end;

function PrinterLooksLikeDocument(const Value: String): Boolean;
var
  UpperValue: String;
begin
  UpperValue := Uppercase(Value);
  Result := (Pos('EPSON', UpperValue) > 0) and
    ((Pos('L3250', UpperValue) > 0) or (Pos('L3251', UpperValue) > 0) or
     (Pos('ECOTANK', UpperValue) > 0));
end;

procedure SelectPrinterByExactName(Combo: TNewComboBox; const PrinterName: String);
var
  I: Integer;
begin
  if PrinterName = '' then
    Exit;
  for I := 0 to Combo.Items.Count - 1 do
  begin
    if CompareText(Combo.Items[I], PrinterName) = 0 then
    begin
      Combo.ItemIndex := I;
      Exit;
    end;
  end;
end;

procedure SelectRecommendedPrinters;
var
  I: Integer;
begin
  LabelPrinterCombo.ItemIndex := -1;
  DocumentPrinterCombo.ItemIndex := -1;

  for I := 0 to LabelPrinterCombo.Items.Count - 1 do
  begin
    if PrinterLooksLikeLabel(LabelPrinterCombo.Items[I]) then
    begin
      LabelPrinterCombo.ItemIndex := I;
      Break;
    end;
  end;

  if LabelPrinterCombo.ItemIndex < 0 then
  begin
    for I := 0 to LabelPrinterCombo.Items.Count - 1 do
    begin
      if Pos('SATO', Uppercase(LabelPrinterCombo.Items[I])) > 0 then
      begin
        LabelPrinterCombo.ItemIndex := I;
        Break;
      end;
    end;
  end;

  for I := 0 to DocumentPrinterCombo.Items.Count - 1 do
  begin
    if PrinterLooksLikeDocument(DocumentPrinterCombo.Items[I]) then
    begin
      DocumentPrinterCombo.ItemIndex := I;
      Break;
    end;
  end;

  if DocumentPrinterCombo.ItemIndex < 0 then
  begin
    for I := 0 to DocumentPrinterCombo.Items.Count - 1 do
    begin
      if Pos('EPSON', Uppercase(DocumentPrinterCombo.Items[I])) > 0 then
      begin
        DocumentPrinterCombo.ItemIndex := I;
        Break;
      end;
    end;
  end;

  if ExistingInstallation then
  begin
    SelectPrinterByExactName(LabelPrinterCombo, ExistingLabelPrinter);
    SelectPrinterByExactName(DocumentPrinterCombo, ExistingDocumentPrinter);
  end;
end;

procedure LoadPrinters;
var
  ResultCode: Integer;
  Params: String;
  I: Integer;
  PrinterName: String;
  PrinterListPath: String;
  PrinterLines: TArrayOfString;
begin
  LabelPrinterCombo.Items.Clear;
  DocumentPrinterCombo.Items.Clear;
  PrinterStatusLabel.Caption := 'Mendeteksi printer Windows...';

  PrinterListPath := ExpandConstant('{commondocs}\ASIHJAYA-Hardware-Hub-printers.txt');
  DeleteFile(PrinterListPath);
  Params := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ' +
    Q('$ErrorActionPreference=''Stop''; Get-Printer | Sort-Object Name | ForEach-Object { $_.Name } | Set-Content -LiteralPath ''' + PrinterListPath + ''' -Encoding UTF8');

  try
    if not ExecAsOriginalUser(PowerShellExecutable, Params, '', SW_SHOWNORMAL,
      ewWaitUntilTerminated, ResultCode) then
      RaiseException('PowerShell printer detection tidak dapat dijalankan pada user Windows outlet.');
  except
    PrinterStatusLabel.Caption := 'Printer Windows gagal dideteksi.';
    MsgBox('Printer Windows tidak dapat dideteksi: ' + GetExceptionMessage,
      mbError, MB_OK);
    DeleteFile(PrinterListPath);
    Exit;
  end;

  if (ResultCode <> 0) or (not FileExists(PrinterListPath)) then
  begin
    PrinterStatusLabel.Caption := 'Printer Windows gagal dideteksi.';
    MsgBox('Get-Printer gagal pada user Windows outlet. Pastikan driver SATO dan EPSON sudah terpasang.',
      mbError, MB_OK);
    DeleteFile(PrinterListPath);
    Exit;
  end;

  if not LoadStringsFromFile(PrinterListPath, PrinterLines) then
  begin
    PrinterStatusLabel.Caption := 'Daftar printer tidak dapat dibaca.';
    MsgBox('Hasil deteksi printer tidak dapat dibaca.', mbError, MB_OK);
    DeleteFile(PrinterListPath);
    Exit;
  end;
  DeleteFile(PrinterListPath);

  for I := 0 to GetArrayLength(PrinterLines) - 1 do
  begin
    PrinterName := Trim(PrinterLines[I]);
    if PrinterName <> '' then
    begin
      LabelPrinterCombo.Items.Add(PrinterName);
      DocumentPrinterCombo.Items.Add(PrinterName);
    end;
  end;

  SelectRecommendedPrinters;
  PrintersLoaded := True;
  if LabelPrinterCombo.Items.Count = 0 then
    PrinterStatusLabel.Caption := 'Tidak ada printer Windows yang ditemukan.'
  else if ExistingInstallation then
    PrinterStatusLabel.Caption := Format('%d printer ditemukan. Pilihan instalasi sebelumnya dipertahankan bila masih tersedia.', [LabelPrinterCombo.Items.Count])
  else
    PrinterStatusLabel.Caption := Format('%d printer ditemukan dari user Windows outlet. SATO/EPSON dipilih otomatis bila tersedia.', [LabelPrinterCombo.Items.Count]);
end;

procedure RefreshPrintersClick(Sender: TObject);
begin
  LoadPrinters;
end;

function RunElevatedNode(const ScriptName, Params: String): Boolean;
var
  ResultCode: Integer;
  FullParams: String;
begin
  FullParams := Q(AppRoot + '\scripts\' + ScriptName);
  if Params <> '' then
    FullParams := FullParams + ' ' + Params;
  Result := Exec(PrivateNode, FullParams, AppRoot, SW_SHOWNORMAL,
    ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function RunOriginalNode(const ScriptName, Params: String; var ResultCode: Integer): Boolean;
var
  FullParams: String;
begin
  FullParams := Q(AppRoot + '\scripts\' + ScriptName);
  if Params <> '' then
    FullParams := FullParams + ' ' + Params;
  Result := ExecAsOriginalUser(PrivateNode, FullParams, AppRoot, SW_SHOWNORMAL,
    ewWaitUntilTerminated, ResultCode);
end;

procedure ConfigureInstalledHub;
var
  Params: String;
begin
  Params :=
    '--app-root ' + Q(AppRoot) +
    ' --state-dir ' + Q(StateDir) +
    ' --log-dir ' + Q(LogDir) +
    ' --support-dir ' + Q(SupportDir) +
    ' --api-url ' + Q('{#AppApiUrl}') +
    ' --label-printer ' + Q(SelectedLabelPrinter) +
    ' --document-printer ' + Q(SelectedDocumentPrinter) +
    ' --pdf-executable ' + Q(PdfExecutable) +
    ' --powershell-executable ' + Q(PowerShellExecutable);

  if not RunElevatedNode('installer-configure.js', Params) then
    RaiseException('Konfigurasi Hardware Hub gagal ditulis.');
end;

procedure EnrollInstalledHub;
var
  ResultCode: Integer;
  Params: String;
begin
  Params :=
    '--api-url ' + Q('{#AppApiUrl}') +
    ' --installation-code ' + Q(Trim(InstallationPage.Values[0])) +
    ' --state-dir ' + Q(StateDir) +
    ' --machine-name ' + Q(GetEnv('COMPUTERNAME')) +
    ' --installer-version ' + Q(InstallerVersion);

  if not RunOriginalNode('enroll-installer.js', Params, ResultCode) then
    RaiseException('Enrollment Hardware Hub tidak dapat dijalankan pada user Windows outlet.');

  if ResultCode = 75 then
  begin
    Params := '--resume --state-dir ' + Q(StateDir) +
      ' --installer-version ' + Q(InstallerVersion);
    if not RunOriginalNode('enroll-installer.js', Params, ResultCode) then
      RaiseException('Resume enrollment Hardware Hub tidak dapat dijalankan.');
  end;

  if ResultCode <> 0 then
    RaiseException(Format('Enrollment Hardware Hub gagal (exit code %d).', [ResultCode]));
end;

procedure ResumeExistingHub;
var
  ResultCode: Integer;
  Params: String;
begin
  Params := '--resume --state-dir ' + Q(StateDir) +
    ' --installer-version ' + Q(InstallerVersion);
  if not RunOriginalNode('enroll-installer.js', Params, ResultCode) then
    RaiseException('Credential Hardware Hub lama tidak dapat dibaca pada user Windows ini.');
  if ResultCode <> 0 then
    RaiseException(Format('Repair/upgrade gagal memverifikasi credential lama (exit code %d). Gunakan user Windows yang sama seperti instalasi awal atau jalankan alur Ganti Mini PC dari RMS.', [ResultCode]));
end;

procedure ValidateInstalledHub;
var
  ResultCode: Integer;
begin
  if not RunOriginalNode('check-config.js', '', ResultCode) then
    RaiseException('Hardware Hub config check tidak dapat dijalankan.');
  if ResultCode <> 0 then
    RaiseException('Hardware Hub config check gagal.');
end;

procedure InstallAndStartScheduledTask;
var
  ResultCode: Integer;
  Params: String;
begin
  Params := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File ' +
    Q(AppRoot + '\scripts\install-startup-task.ps1') +
    ' -TaskName ' + Q(TaskName) +
    ' -NodeExecutable ' + Q(PrivateNode) +
    ' -RunNow';

  if not ExecAsOriginalUser(PowerShellExecutable, Params, AppRoot, SW_SHOWNORMAL,
    ewWaitUntilTerminated, ResultCode) then
    RaiseException('Scheduled Task Hardware Hub tidak dapat dibuat pada user Windows outlet.');
  if ResultCode <> 0 then
    RaiseException(Format('Scheduled Task Hardware Hub gagal dibuat (exit code %d).', [ResultCode]));
end;

procedure WaitForReadiness;
var
  Params: String;
begin
  Params := '--state-dir ' + Q(StateDir) + ' --timeout-ms 30000';
  if not RunElevatedNode('installer-readiness.js', Params) then
    RaiseException('Hardware Hub belum mencapai status ready. Periksa koneksi RMS dan driver printer.');
end;

function StopExistingTask: Boolean;
var
  ResultCode: Integer;
  Params: String;
begin
  Params := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ' +
    Q('$ErrorActionPreference=''Stop''; $task=Get-ScheduledTask -TaskName ''' + TaskName + ''' -ErrorAction SilentlyContinue; if($task){ Stop-ScheduledTask -TaskName ''' + TaskName + ''' -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2 }');
  Result := ExecAsOriginalUser(PowerShellExecutable, Params, '', SW_HIDE,
    ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

procedure RunPhysicalTest(const DeviceName, PrinterName: String);
var
  ResultCode: Integer;
  Params: String;
begin
  Params := '--device ' + Q(DeviceName) +
    ' --printer ' + Q(PrinterName) +
    ' --state-dir ' + Q(StateDir);
  if DeviceName = 'document' then
    Params := Params + ' --pdf-executable ' + Q(PdfExecutable);

  if not RunOriginalNode('installer-test-print.js', Params, ResultCode) then
  begin
    MsgBox('Test print tidak dapat dijalankan pada user Windows outlet.', mbError, MB_OK);
    Exit;
  end;

  if ResultCode = 0 then
    MsgBox('Test print berhasil dikirim ke ' + PrinterName + '.', mbInformation, MB_OK)
  else
    MsgBox(Format('Test print gagal (exit code %d). Periksa printer dan driver Windows.', [ResultCode]), mbError, MB_OK);
end;

procedure TestLabelClick(Sender: TObject);
begin
  RunPhysicalTest('label', SelectedLabelPrinter);
end;

procedure TestDocumentClick(Sender: TObject);
begin
  RunPhysicalTest('document', SelectedDocumentPrinter);
end;

procedure InitializeWizard;
var
  CaptionLabel: TNewStaticText;
begin
  ExistingInstallation := FileExists(CredentialPath);
  ExistingLabelPrinter := ReadExistingEnvValue('LABEL_PRINTER_NAME');
  ExistingDocumentPrinter := ReadExistingEnvValue('DOCUMENT_PRINTER_NAME');

  InstallationPage := CreateInputQueryPage(wpWelcome,
    'Hubungkan Hardware Hub',
    'Masukkan Installation Code dari halaman Hardware Hub RMS.',
    'Kode hanya digunakan untuk mendaftarkan Mini PC ini dan tidak disimpan sebagai credential.');
  InstallationPage.Add('Installation Code:', False);

  PrinterPage := CreateCustomPage(InstallationPage.ID,
    'Pilih Printer',
    'Pilih printer label SATO dan printer nota EPSON yang terpasang di Windows.');

  RepairStatusLabel := TNewStaticText.Create(PrinterPage);
  RepairStatusLabel.Parent := PrinterPage.Surface;
  RepairStatusLabel.Left := 0;
  RepairStatusLabel.Top := ScaleY(0);
  RepairStatusLabel.Width := ScaleX(450);
  RepairStatusLabel.AutoSize := False;
  RepairStatusLabel.WordWrap := True;
  if ExistingInstallation then
    RepairStatusLabel.Caption := 'Mode Perbaiki / Upgrade: credential aman dan data ProgramData akan dipertahankan.'
  else
    RepairStatusLabel.Caption := 'Mode Instalasi Baru: Setup akan mendaftarkan Mini PC menggunakan Installation Code.';

  CaptionLabel := TNewStaticText.Create(PrinterPage);
  CaptionLabel.Parent := PrinterPage.Surface;
  CaptionLabel.Left := 0;
  CaptionLabel.Top := ScaleY(40);
  CaptionLabel.Caption := 'Printer Label';

  LabelPrinterCombo := TNewComboBox.Create(PrinterPage);
  LabelPrinterCombo.Parent := PrinterPage.Surface;
  LabelPrinterCombo.Left := 0;
  LabelPrinterCombo.Top := ScaleY(60);
  LabelPrinterCombo.Width := ScaleX(410);
  LabelPrinterCombo.Style := csDropDownList;

  CaptionLabel := TNewStaticText.Create(PrinterPage);
  CaptionLabel.Parent := PrinterPage.Surface;
  CaptionLabel.Left := 0;
  CaptionLabel.Top := ScaleY(100);
  CaptionLabel.Caption := 'Printer Nota';

  DocumentPrinterCombo := TNewComboBox.Create(PrinterPage);
  DocumentPrinterCombo.Parent := PrinterPage.Surface;
  DocumentPrinterCombo.Left := 0;
  DocumentPrinterCombo.Top := ScaleY(120);
  DocumentPrinterCombo.Width := ScaleX(410);
  DocumentPrinterCombo.Style := csDropDownList;

  RefreshPrintersButton := TNewButton.Create(PrinterPage);
  RefreshPrintersButton.Parent := PrinterPage.Surface;
  RefreshPrintersButton.Left := 0;
  RefreshPrintersButton.Top := ScaleY(162);
  RefreshPrintersButton.Width := ScaleX(120);
  RefreshPrintersButton.Caption := 'Deteksi Ulang';
  RefreshPrintersButton.OnClick := @RefreshPrintersClick;

  PrinterStatusLabel := TNewStaticText.Create(PrinterPage);
  PrinterStatusLabel.Parent := PrinterPage.Surface;
  PrinterStatusLabel.Left := ScaleX(132);
  PrinterStatusLabel.Top := ScaleY(168);
  PrinterStatusLabel.Width := ScaleX(320);
  PrinterStatusLabel.AutoSize := False;
  PrinterStatusLabel.WordWrap := True;
  PrinterStatusLabel.Caption := 'Printer belum dideteksi.';

  FinishDetailLabel := TNewStaticText.Create(WizardForm.FinishedPage);
  FinishDetailLabel.Parent := WizardForm.FinishedPage;
  FinishDetailLabel.Left := WizardForm.FinishedLabel.Left;
  FinishDetailLabel.Top := WizardForm.FinishedLabel.Top + ScaleY(60);
  FinishDetailLabel.Width := WizardForm.FinishedLabel.Width;
  FinishDetailLabel.Height := ScaleY(80);
  FinishDetailLabel.AutoSize := False;
  FinishDetailLabel.WordWrap := True;
  FinishDetailLabel.Visible := False;

  TestLabelButton := TNewButton.Create(WizardForm.FinishedPage);
  TestLabelButton.Parent := WizardForm.FinishedPage;
  TestLabelButton.Left := WizardForm.FinishedLabel.Left;
  TestLabelButton.Top := FinishDetailLabel.Top + ScaleY(84);
  TestLabelButton.Width := ScaleX(140);
  TestLabelButton.Caption := 'Test Print Label';
  TestLabelButton.OnClick := @TestLabelClick;
  TestLabelButton.Visible := False;

  TestDocumentButton := TNewButton.Create(WizardForm.FinishedPage);
  TestDocumentButton.Parent := WizardForm.FinishedPage;
  TestDocumentButton.Left := TestLabelButton.Left + TestLabelButton.Width + ScaleX(12);
  TestDocumentButton.Top := TestLabelButton.Top;
  TestDocumentButton.Width := ScaleX(140);
  TestDocumentButton.Caption := 'Test Print Nota';
  TestDocumentButton.OnClick := @TestDocumentClick;
  TestDocumentButton.Visible := False;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := ExistingInstallation and (PageID = InstallationPage.ID);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  CodeValue: String;
begin
  Result := True;
  if (CurPageID = InstallationPage.ID) and (not ExistingInstallation) then
  begin
    CodeValue := Trim(InstallationPage.Values[0]);
    if (Length(CodeValue) < 10) or (Pos('AJ-', Uppercase(CodeValue)) <> 1) then
    begin
      MsgBox('Installation Code tidak valid. Salin kode AJ-... dari RMS.', mbError, MB_OK);
      Result := False;
    end;
  end
  else if CurPageID = PrinterPage.ID then
  begin
    if SelectedLabelPrinter = '' then
    begin
      MsgBox('Pilih printer label SATO.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    if SelectedDocumentPrinter = '' then
    begin
      MsgBox('Pilih printer nota EPSON.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if ExistingInstallation and (not StopExistingTask) then
    Result := 'Hardware Hub lama tidak dapat dihentikan. Tutup proses Hardware Hub lalu jalankan Setup lagi.';
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = PrinterPage.ID) and (not PrintersLoaded) then
    LoadPrinters;

  if CurPageID = wpFinished then
  begin
    if InstallSucceeded then
    begin
      if ExistingInstallation then
        WizardForm.FinishedLabel.Caption := 'Hardware Hub berhasil diperbaiki / diperbarui.'
      else
        WizardForm.FinishedLabel.Caption := 'Hardware Hub berhasil terhubung ke RMS.';
      FinishDetailLabel.Caption :=
        'Mini PC: ' + GetEnv('COMPUTERNAME') + #13#10 +
        'Printer Label: ' + SelectedLabelPrinter + #13#10 +
        'Printer Nota: ' + SelectedDocumentPrinter + #13#10 +
        'Status: ONLINE / READY';
      FinishDetailLabel.Visible := True;
      TestLabelButton.Visible := True;
      TestDocumentButton.Visible := True;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    ConfigureInstalledHub;
    if ExistingInstallation then
      ResumeExistingHub
    else
      EnrollInstalledHub;
    ValidateInstalledHub;
    InstallAndStartScheduledTask;
    WaitForReadiness;
    InstallSucceeded := True;
  end;
end;

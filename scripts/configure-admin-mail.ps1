# Run interactively. Never paste the entered values or generated files into chat.
# Local files are git-ignored and restricted to the current Windows account.
$ErrorActionPreference = 'Stop'
$mailRepo = Split-Path -Parent $PSScriptRoot
$mailWorker = Join-Path $mailRepo 'infra/cloudflare/admin-mail-worker'
$mailSupabaseFile = Join-Path $mailRepo '.env.admin-mail.local'
$mailWorkerFile = Join-Path $mailWorker '.dev.vars'
$mailProject = 'vimksjrhaxdpnkvgsavz'

function New-MailSecret {
  $mailBytes = New-Object byte[] 32
  $mailRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $mailRng.GetBytes($mailBytes) } finally { $mailRng.Dispose() }
  return ([BitConverter]::ToString($mailBytes)).Replace('-', '').ToLowerInvariant()
}

function Write-MailPrivateFile([string]$Path, [string[]]$Lines) {
  # Restrict the empty file before writing values, so values are never saved
  # into a newly inherited, broadly readable file.
  if (!(Test-Path -LiteralPath $Path)) { New-Item -ItemType File -Path $Path | Out-Null }
  $mailIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls.exe $Path /inheritance:r /grant:r "$($mailIdentity):(F)" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not restrict the private configuration file.' }
  [System.IO.File]::WriteAllLines($Path, $Lines, (New-Object System.Text.UTF8Encoding($false)))
}

$mailExisting = @{}
if (Test-Path -LiteralPath $mailSupabaseFile) {
  foreach ($mailLine in [System.IO.File]::ReadAllLines($mailSupabaseFile)) {
    $mailPair = $mailLine.Split(@('='), 2)
    if ($mailPair.Count -eq 2) { $mailExisting[$mailPair[0]] = $mailPair[1] }
  }
}

Write-Host 'EconMind mail setup: values remain on this computer and in provider secret stores.'
Write-Host 'Use a Brevo API key (not an SMTP password). Do not send it through chat.'
$mailSecureKey = Read-Host 'Brevo API key (hidden input)' -AsSecureString
$mailPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mailSecureKey)
try { $mailBrevoKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($mailPointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($mailPointer) }
if (!$mailBrevoKey -or $mailBrevoKey -match '\s') { throw 'A single non-empty API key is required.' }

Write-Host 'Enter the EXACT existing verified management destination(s), separated by commas.'
$mailDestinations = @((Read-Host 'Management destinations').Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique)
if (!$mailDestinations.Count) { throw 'At least one existing verified management destination is required.' }
foreach ($mailDestination in $mailDestinations) {
  if ($mailDestination -notmatch '^[^\s<>,;]+@[^\s<>,;]+\.[^\s<>,;]+$' -or $mailDestination -ieq 'admin@econmind.group') {
    throw 'Invalid destination. Do not enter the official address itself.'
  }
}

$mailHmac = $mailExisting['INBOUND_MAIL_WEBHOOK_SECRET']
$mailWebhook = $mailExisting['BREVO_WEBHOOK_TOKEN']
if (!$mailHmac) { $mailHmac = New-MailSecret }
if (!$mailWebhook) { $mailWebhook = New-MailSecret }
Write-MailPrivateFile $mailSupabaseFile @(
  "BREVO_API_KEY=$mailBrevoKey",
  "INBOUND_MAIL_WEBHOOK_SECRET=$mailHmac",
  "BREVO_WEBHOOK_TOKEN=$mailWebhook"
)
$mailDestinationsJson = ConvertTo-Json -InputObject $mailDestinations -Compress
Write-MailPrivateFile $mailWorkerFile @(
  "INBOUND_MAIL_WEBHOOK_SECRET=$mailHmac",
  "MANAGEMENT_FORWARD_TO_JSON=$mailDestinationsJson",
  "INBOUND_MAIL_INGEST_URL=https://$mailProject.supabase.co/functions/v1/ingest-admin-email"
)

Push-Location $mailRepo
try {
  & pnpm exec supabase secrets set --project-ref $mailProject --env-file $mailSupabaseFile
  if ($LASTEXITCODE -ne 0) { throw 'Supabase secret upload failed; rerun this helper after resolving login. Existing signing values will be reused.' }
} finally { Pop-Location }
Write-Host 'Supabase secrets configured. Cloudflare private deployment file prepared.'
Write-Host 'Reply in chat: Mail configuration completed. Do not paste any values.'
Write-Host "For the later Brevo webhook Bearer field, privately copy BREVO_WEBHOOK_TOKEN from: $mailSupabaseFile"
Write-Host 'Do not change Email Routing until original management forwarding has been verified.'

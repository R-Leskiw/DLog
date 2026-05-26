# Push BuildTrack to GitHub (run after creating an empty repo on github.com/new)
param(
  [Parameter(Mandatory = $true)]
  [string]$RepoUrl  # e.g. https://github.com/YOUR_USERNAME/buildtrack.git
)

$git = "C:\Program Files\Git\cmd\git.exe"
if (-not (Test-Path $git)) {
  Write-Error "Git not found. Install from https://git-scm.com/download/win"
  exit 1
}

Set-Location (Split-Path $PSScriptRoot -Parent)

& $git remote remove origin 2>$null
& $git remote add origin $RepoUrl
& $git push -u origin main

Write-Host "Done. Next: import this repo on Vercel and add Supabase env vars (see SETUP.md)."

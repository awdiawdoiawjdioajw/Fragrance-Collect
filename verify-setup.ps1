# Fragrance Collect - Setup Verification Script
# This script checks if your GitHub Pages setup is working correctly

Write-Host "🔍 Fragrance Collect - Setup Verification" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Check if we're in a git repository
if (!(Test-Path ".git")) {
    Write-Host "❌ Not in a git repository. Run deploy.ps1 first." -ForegroundColor Red
    exit 1
}

# Get remote URL
try {
    $remoteUrl = git remote get-url origin
    Write-Host "✅ Git repository found" -ForegroundColor Green
    Write-Host "   Remote: $remoteUrl" -ForegroundColor Gray
} catch {
    Write-Host "❌ No remote origin found. Run deploy.ps1 first." -ForegroundColor Red
    exit 1
}

# Extract GitHub username and repo name from URL
if ($remoteUrl -match "github\.com/([^/]+)/([^/]+)\.git") {
    $githubUsername = $matches[1]
    $repoName = $matches[2]
    Write-Host "✅ GitHub repository: $githubUsername/$repoName" -ForegroundColor Green
} else {
    Write-Host "❌ Could not parse GitHub URL" -ForegroundColor Red
    exit 1
}

# Check if main.html exists
if (Test-Path "main.html") {
    Write-Host "✅ main.html found" -ForegroundColor Green
} else {
    Write-Host "⚠️  main.html not found" -ForegroundColor Yellow
}

# Check if index.html exists
if (Test-Path "index.html") {
    Write-Host "✅ index.html found" -ForegroundColor Green
} else {
    Write-Host "ℹ️  index.html not found (optional)" -ForegroundColor Gray
}

# Check for essential files
$essentialFiles = @("styles.css", "script.js", "contact.html", "auth.html")
foreach ($file in $essentialFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file found" -ForegroundColor Green
    } else {
        Write-Host "⚠️  $file not found" -ForegroundColor Yellow
    }
}

# Check current branch
$currentBranch = git branch --show-current
Write-Host "✅ Current branch: $currentBranch" -ForegroundColor Green

# Check if there are uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Host "⚠️  You have uncommitted changes:" -ForegroundColor Yellow
    Write-Host $status -ForegroundColor Gray
} else {
    Write-Host "✅ No uncommitted changes" -ForegroundColor Green
}

Write-Host "`n🌐 Your website should be available at:" -ForegroundColor Cyan
Write-Host "   https://$githubUsername.github.io/$repoName" -ForegroundColor Yellow

Write-Host "`n📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Go to: https://github.com/$githubUsername/$repoName/settings/pages" -ForegroundColor White
Write-Host "2. Verify GitHub Pages is enabled" -ForegroundColor White
Write-Host "3. Check deployment status" -ForegroundColor White

Write-Host "`n🔗 Quick links:" -ForegroundColor Cyan
Write-Host "   Repository: https://github.com/$githubUsername/$repoName" -ForegroundColor Blue
Write-Host "   Pages Settings: https://github.com/$githubUsername/$repoName/settings/pages" -ForegroundColor Blue
Write-Host "   Actions: https://github.com/$githubUsername/$repoName/actions" -ForegroundColor Blue

Write-Host "`n✅ Verification complete!" -ForegroundColor Green 
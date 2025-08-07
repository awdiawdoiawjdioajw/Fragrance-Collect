# Fragrance Collect - Fix GitHub Pages Setup
# This script helps fix common GitHub Pages issues

Write-Host "🔧 Fragrance Collect - Fix GitHub Pages Setup" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow

# Check if we're in a git repository
if (!(Test-Path ".git")) {
    Write-Host "❌ Not in a git repository. Run deploy.ps1 first." -ForegroundColor Red
    exit 1
}

Write-Host "📋 Checking current setup..." -ForegroundColor Cyan

# Check for essential files
$essentialFiles = @("main.html", "index.html", "styles.css", "script.js")
foreach ($file in $essentialFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file found" -ForegroundColor Green
    } else {
        Write-Host "❌ $file missing" -ForegroundColor Red
    }
}

# Check if there are uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Host "`n📝 Found uncommitted changes:" -ForegroundColor Yellow
    Write-Host $status -ForegroundColor Gray
    
    $commit = Read-Host "`nDo you want to commit these changes? (y/n)"
    if ($commit -eq "y" -or $commit -eq "Y") {
        Write-Host "`n💾 Committing changes..." -ForegroundColor Yellow
        git add .
        git commit -m "Fix GitHub Pages setup - add index.html and configuration"
        Write-Host "✅ Changes committed" -ForegroundColor Green
        
        Write-Host "`n🚀 Pushing to GitHub..." -ForegroundColor Yellow
        git push
        Write-Host "✅ Changes pushed to GitHub" -ForegroundColor Green
    }
} else {
    Write-Host "✅ No uncommitted changes" -ForegroundColor Green
}

Write-Host "`n🔍 GitHub Pages Configuration Check:" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Get remote URL
try {
    $remoteUrl = git remote get-url origin
    if ($remoteUrl -match "github\.com/([^/]+)/([^/]+)\.git") {
        $githubUsername = $matches[1]
        $repoName = $matches[2]
        
        Write-Host "`n📋 Manual Steps Required:" -ForegroundColor Yellow
        Write-Host "1. Go to: https://github.com/$githubUsername/$repoName/settings/pages" -ForegroundColor White
        Write-Host "2. Under 'Source', select 'Deploy from a branch'" -ForegroundColor White
        Write-Host "3. Choose 'main' branch" -ForegroundColor White
        Write-Host "4. Select root folder" -ForegroundColor White
        Write-Host "5. Click Save" -ForegroundColor White
        
        Write-Host "`n🌐 Your website will be available at:" -ForegroundColor Cyan
        Write-Host "   https://$githubUsername.github.io/$repoName" -ForegroundColor Yellow
        
        Write-Host "`n⏱️  Deployment usually takes 2-5 minutes" -ForegroundColor Magenta
        Write-Host "📊 Check deployment status in the Actions tab" -ForegroundColor Cyan
        
    } else {
        Write-Host "❌ Could not parse GitHub URL" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ No remote origin found" -ForegroundColor Red
}

Write-Host "`n🎯 Setup complete! Your website should now display properly." -ForegroundColor Green 
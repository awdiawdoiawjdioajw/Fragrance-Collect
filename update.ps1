# Fragrance Collect - Update Script
# This script helps you update your GitHub Pages website

Write-Host "🔄 Fragrance Collect - Website Update" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Check if we're in a git repository
if (!(Test-Path ".git")) {
    Write-Host "❌ Not in a git repository. Run deploy.ps1 first." -ForegroundColor Red
    exit 1
}

# Check current status
Write-Host "📊 Checking current status..." -ForegroundColor Cyan
$status = git status --porcelain

if ($status) {
    Write-Host "📝 Changes detected:" -ForegroundColor Yellow
    Write-Host $status -ForegroundColor Gray
    
    # Get commit message
    $commitMessage = Read-Host "Enter commit message (or press Enter for default)"
    if ([string]::IsNullOrWhiteSpace($commitMessage)) {
        $commitMessage = "Update website content - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    }
    
    # Add and commit changes
    Write-Host "`n💾 Committing changes..." -ForegroundColor Yellow
    git add .
    git commit -m $commitMessage
    Write-Host "✅ Changes committed" -ForegroundColor Green
    
    # Push to GitHub
    Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Yellow
    git push
    Write-Host "✅ Changes pushed to GitHub" -ForegroundColor Green
    
    Write-Host "`n⏱️  Your website will update in 2-5 minutes" -ForegroundColor Magenta
    Write-Host "📊 Check deployment status in GitHub Actions" -ForegroundColor Cyan
    
} else {
    Write-Host "✅ No changes to commit" -ForegroundColor Green
    Write-Host "ℹ️  Your website is up to date" -ForegroundColor Gray
}

Write-Host "`n🎯 Update complete!" -ForegroundColor Green 
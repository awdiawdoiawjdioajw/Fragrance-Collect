# Fragrance Collect - GitHub Pages Deployment Script
# This script will help you deploy your website to GitHub Pages

Write-Host "🚀 Fragrance Collect - GitHub Pages Deployment" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

# Check if Git is installed
try {
    git --version | Out-Null
    Write-Host "✅ Git is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Git is not installed. Please install Git first:" -ForegroundColor Red
    Write-Host "   https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# Get GitHub username
$githubUsername = Read-Host "Enter your GitHub username"
$repoName = Read-Host "Enter repository name (default: fragrance-collect)" 
if ([string]::IsNullOrWhiteSpace($repoName)) {
    $repoName = "fragrance-collect"
}

Write-Host "`n📁 Setting up repository..." -ForegroundColor Cyan

# Initialize git repository
if (!(Test-Path ".git")) {
    Write-Host "Initializing git repository..." -ForegroundColor Yellow
    git init
    Write-Host "✅ Git repository initialized" -ForegroundColor Green
}

# Add all files
Write-Host "Adding files to git..." -ForegroundColor Yellow
git add .
Write-Host "✅ Files added" -ForegroundColor Green

# Create initial commit
Write-Host "Creating initial commit..." -ForegroundColor Yellow
git commit -m "Initial commit: Fragrance Collect website"
Write-Host "✅ Initial commit created" -ForegroundColor Green

# Rename branch to main
Write-Host "Setting up main branch..." -ForegroundColor Yellow
git branch -M main
Write-Host "✅ Main branch set" -ForegroundColor Green

# Add remote origin
Write-Host "Adding remote origin..." -ForegroundColor Yellow
git remote add origin "https://github.com/$githubUsername/$repoName.git"
Write-Host "✅ Remote origin added" -ForegroundColor Green

# Push to GitHub
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push -u origin main
Write-Host "✅ Code pushed to GitHub" -ForegroundColor Green

Write-Host "`n🎉 Deployment Setup Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Go to: https://github.com/$githubUsername/$repoName" -ForegroundColor White
Write-Host "2. Click 'Settings' tab" -ForegroundColor White
Write-Host "3. Scroll down to 'Pages' section" -ForegroundColor White
Write-Host "4. Select 'Deploy from a branch'" -ForegroundColor White
Write-Host "5. Choose 'main' branch and '/ (root)' folder" -ForegroundColor White
Write-Host "6. Click 'Save'" -ForegroundColor White
Write-Host "`nYour website will be available at:" -ForegroundColor Cyan
Write-Host "https://$githubUsername.github.io/$repoName" -ForegroundColor Yellow
Write-Host "`n⏱️  Deployment usually takes 2-5 minutes" -ForegroundColor Magenta

# Optional: Rename main.html to index.html
$renameToIndex = Read-Host "`nDo you want to rename main.html to index.html for better compatibility? (y/n)"
if ($renameToIndex -eq "y" -or $renameToIndex -eq "Y") {
    Write-Host "Renaming main.html to index.html..." -ForegroundColor Yellow
    git mv main.html index.html
    git commit -m "Rename main.html to index.html for better GitHub Pages compatibility"
    git push
    Write-Host "✅ main.html renamed to index.html" -ForegroundColor Green
}

Write-Host "`n🎯 Setup complete! Check your GitHub repository for deployment status." -ForegroundColor Green 
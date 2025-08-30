# Deploy Integrated Worker Script
# This script deploys the integrated worker that combines API and authentication

Write-Host "🚀 Deploying Integrated Worker..." -ForegroundColor Green

# Navigate to the integrated worker directory
Set-Location "weathered-mud-6ed5"

Write-Host "📁 Current directory: $(Get-Location)" -ForegroundColor Yellow

# Check if wrangler is installed
try {
    $wranglerVersion = wrangler --version
    Write-Host "✅ Wrangler found: $wranglerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Wrangler not found. Please install Wrangler first:" -ForegroundColor Red
    Write-Host "npm install -g wrangler" -ForegroundColor Yellow
    exit 1
}

# Deploy the integrated worker
Write-Host "🔄 Deploying integrated worker..." -ForegroundColor Yellow
try {
    wrangler deploy
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Integrated worker deployed successfully!" -ForegroundColor Green
        Write-Host "🌐 Worker URL: https://weathered-mud-6ed5.joshuablaszczyk.workers.dev" -ForegroundColor Cyan
        Write-Host "📋 Available endpoints:" -ForegroundColor Cyan
        Write-Host "   - /health (health check)" -ForegroundColor White
        Write-Host "   - /products (product search)" -ForegroundColor White
        Write-Host "   - /feeds (product feeds)" -ForegroundColor White
        Write-Host "   - /login (Google authentication)" -ForegroundColor White
        Write-Host "   - /logout (logout)" -ForegroundColor White
        Write-Host "   - /status (user status)" -ForegroundColor White
        Write-Host "   - /token (session token)" -ForegroundColor White
        Write-Host "   - /signup/email (email signup)" -ForegroundColor White
        Write-Host "   - /login/email (email login)" -ForegroundColor White
        Write-Host "   - /api/user/preferences (user preferences)" -ForegroundColor White
        Write-Host "   - /api/user/favorites (user favorites)" -ForegroundColor White
    } else {
        Write-Host "❌ Deployment failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Return to original directory
Set-Location ".."

Write-Host "🎉 Integrated worker deployment complete!" -ForegroundColor Green
Write-Host "💡 Cross-origin authentication issues should now be resolved!" -ForegroundColor Cyan

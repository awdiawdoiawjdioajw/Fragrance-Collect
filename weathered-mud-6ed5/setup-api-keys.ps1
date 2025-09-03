# Setup API Keys for Cloudflare Worker
# This script helps you set up the required API keys as secrets

Write-Host "🔑 Setting up API Keys for Cloudflare Worker" -ForegroundColor Green
Write-Host ""

# CJ API Key
Write-Host "📋 CJ (Commission Junction) API Key Setup:" -ForegroundColor Yellow
Write-Host "1. Go to https://developers.cj.com/"
Write-Host "2. Create an account and get your API key"
Write-Host "3. Run: npx wrangler secret put CJ_API_KEY"
Write-Host ""

# TikTok API Keys
Write-Host "📱 TikTok Shop API Setup:" -ForegroundColor Yellow
Write-Host "1. Go to https://developers.tiktok.com/"
Write-Host "2. Create a TikTok for Developers account"
Write-Host "3. Create an app and get your credentials"
Write-Host "4. Run these commands:"
Write-Host "   npx wrangler secret put TIKTOK_APP_SECRET"
Write-Host "   npx wrangler secret put TIKTOK_ACCESS_TOKEN"
Write-Host ""

# Google OAuth (if needed)
Write-Host "🔐 Google OAuth Setup (if using Google login):" -ForegroundColor Yellow
Write-Host "1. Go to https://console.cloud.google.com/"
Write-Host "2. Create a project and enable OAuth 2.0"
Write-Host "3. Get your Client ID and Client Secret"
Write-Host "4. Run: npx wrangler secret put GOOGLE_CLIENT_SECRET"
Write-Host ""

Write-Host "✅ After setting up all secrets, deploy with: npx wrangler deploy" -ForegroundColor Green
Write-Host ""

# Check if secrets are already set
Write-Host "🔍 Checking current secrets..." -ForegroundColor Cyan
try {
    $secrets = npx wrangler secret list 2>$null
    if ($secrets) {
        Write-Host "Current secrets:" -ForegroundColor Green
        $secrets | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Host "No secrets found. Please set them up using the commands above." -ForegroundColor Red
    }
} catch {
    Write-Host "Could not check secrets. Make sure you're logged in to Cloudflare." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📝 Note: If you don't have API keys yet, the worker will use mock data as fallback." -ForegroundColor Blue

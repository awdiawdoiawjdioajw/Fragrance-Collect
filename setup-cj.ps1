# CJ Setup Script for Fragrance Collect
# This script helps you configure and test your Commission Junction API integration

Write-Host "🔧 CJ (Commission Junction) Setup for Fragrance Collect" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (Test-Path ".env") {
    Write-Host "✅ .env file found" -ForegroundColor Green
} else {
    Write-Host "❌ .env file not found. Creating one..." -ForegroundColor Yellow
    
    # Create .env file with template
    @"
# Commission Junction (CJ) API Credentials
# Get these from your CJ.com publisher dashboard
CJ_DEV_KEY=your_cj_developer_key_here
CJ_WEBSITE_ID=your_cj_website_id_here

# API Configuration
NODE_ENV=development
PORT=3000
"@ | Out-File -FilePath ".env" -Encoding UTF8
    
    Write-Host "✅ .env file created. Please edit it with your actual CJ credentials." -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Get your CJ credentials from https://publisher.cj.com" -ForegroundColor White
Write-Host "2. Edit the .env file with your actual CJ_DEV_KEY and CJ_WEBSITE_ID" -ForegroundColor White
Write-Host "3. Run the API server to test the connection" -ForegroundColor White
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Node.js not found. Please install Node.js 18+ first." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Check if npm is available
try {
    $npmVersion = npm --version 2>$null
    if ($npmVersion) {
        Write-Host "✅ npm found: $npmVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ npm not found. Please install Node.js with npm." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ npm not found. Please install Node.js with npm." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔧 Installing API dependencies..." -ForegroundColor Yellow
Set-Location "api"
npm install
Set-Location ".."

Write-Host ""
Write-Host "🚀 Ready to test! You can now:" -ForegroundColor Green
Write-Host "1. Start the API: cd api && npm start" -ForegroundColor White
Write-Host "2. Test health: http://localhost:3000/health" -ForegroundColor White
Write-Host "3. Test products: http://localhost:3000/products" -ForegroundColor White
Write-Host "4. Check config: http://localhost:3000/config" -ForegroundColor White
Write-Host ""

Write-Host "💡 Tip: Use 'npm run dev' in the api folder for development with auto-reload" -ForegroundColor Cyan
Write-Host ""

# Ask if user wants to start the API now
$startNow = Read-Host "Would you like to start the API server now? (y/n)"
if ($startNow -eq "y" -or $startNow -eq "Y") {
    Write-Host "🚀 Starting API server..." -ForegroundColor Green
    Set-Location "api"
    npm start
} else {
    Write-Host "👋 Setup complete! Start the API when you're ready." -ForegroundColor Green
}


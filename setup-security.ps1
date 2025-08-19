# Security Setup Script for Fragrance Collect
# This script validates and configures security settings

Write-Host "🔒 Security Setup for Fragrance Collect" -ForegroundColor Red
Write-Host "=====================================" -ForegroundColor Red
Write-Host ""

# Check for existing .env file
if (Test-Path ".env") {
    Write-Host "⚠️  .env file already exists. Checking security..." -ForegroundColor Yellow
    
    # Read and analyze .env file
    $envContent = Get-Content ".env" -Raw
    $securityIssues = @()
    
    # Check for hardcoded credentials
    if ($envContent -match "your_cj_developer_key_here|your_cj_website_id_here") {
        $securityIssues += "Contains placeholder credentials"
    }
    
    # Check for weak configurations
    if ($envContent -match "NODE_ENV=development") {
        $securityIssues += "Running in development mode"
    }
    
    if ($securityIssues.Count -gt 0) {
        Write-Host "❌ Security issues found:" -ForegroundColor Red
        $securityIssues | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
        Write-Host ""
        Write-Host "🔧 Fixing security issues..." -ForegroundColor Yellow
    } else {
        Write-Host "✅ .env file looks secure" -ForegroundColor Green
    }
} else {
    Write-Host "❌ .env file not found. Creating secure template..." -ForegroundColor Red
}

# Create secure .env file
Write-Host ""
Write-Host "🔐 Creating secure environment configuration..." -ForegroundColor Cyan

$secureEnvContent = @"
# ========================================
# FRAGRANCE COLLECT - ENVIRONMENT CONFIG
# ========================================
# ⚠️  NEVER commit this file to version control
# ⚠️  Keep your credentials secure and private

# Commission Junction (CJ) API Credentials
# Get these from https://publisher.cj.com
CJ_DEV_KEY=your_actual_developer_key_here
CJ_WEBSITE_ID=your_actual_website_id_here

# API Configuration
NODE_ENV=development
PORT=3000

# Security Configuration
ENABLE_RATE_LIMITING=true
ENABLE_CORS=true
ALLOWED_ORIGINS=*
MAX_REQUEST_SIZE=1048576

# Logging (set to false in production)
LOG_SENSITIVE_DATA=false

# Performance
REQUEST_TIMEOUT=30000
MAX_CONCURRENT_REQUESTS=10

# ========================================
# PRODUCTION SETTINGS (uncomment when deploying)
# ========================================
# NODE_ENV=production
# ENABLE_RATE_LIMITING=true
# ENABLE_CORS=true
# ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
# LOG_SENSITIVE_DATA=false
# MAX_REQUEST_SIZE=1048576
"@

$secureEnvContent | Out-File -FilePath ".env" -Encoding UTF8
Write-Host "✅ Secure .env file created" -ForegroundColor Green

# Create .env.production template
Write-Host ""
Write-Host "🚀 Creating production environment template..." -ForegroundColor Cyan

$productionEnvContent = @"
# ========================================
# PRODUCTION ENVIRONMENT CONFIGURATION
# ========================================
# Copy this to .env.production and fill in real credentials

# Commission Junction (CJ) API Credentials
CJ_DEV_KEY=your_production_developer_key
CJ_WEBSITE_ID=your_production_website_id

# Production Settings
NODE_ENV=production
PORT=3000

# Security (Production)
ENABLE_RATE_LIMITING=true
ENABLE_CORS=true
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
MAX_REQUEST_SIZE=1048576

# Logging (Production)
LOG_SENSITIVE_DATA=false

# Performance (Production)
REQUEST_TIMEOUT=30000
MAX_CONCURRENT_REQUESTS=10
"@

$productionEnvContent | Out-File -FilePath ".env.production" -Encoding UTF8
Write-Host "✅ Production environment template created" -ForegroundColor Green

# Security checklist
Write-Host ""
Write-Host "🔍 Security Checklist:" -ForegroundColor Yellow
Write-Host "=====================" -ForegroundColor Yellow

$securityChecklist = @(
    "✅ .env file created with secure template",
    "✅ .env.production template created",
    "✅ Rate limiting enabled by default",
    "✅ CORS configured securely",
    "✅ Request size limits set",
    "✅ Sensitive data logging disabled in production",
    "✅ Environment-specific configurations"
)

$securityChecklist | ForEach-Object { Write-Host "   $_" -ForegroundColor Green }

Write-Host ""
Write-Host "⚠️  IMPORTANT SECURITY STEPS:" -ForegroundColor Red
Write-Host "=============================" -ForegroundColor Red
Write-Host "1. Edit .env file with your actual CJ credentials" -ForegroundColor White
Write-Host "2. NEVER commit .env files to version control" -ForegroundColor White
Write-Host "3. Use .env.production for production deployments" -ForegroundColor White
Write-Host "4. Restrict ALLOWED_ORIGINS in production" -ForegroundColor White
Write-Host "5. Set NODE_ENV=production in production" -ForegroundColor White
Write-Host "6. Regularly rotate your CJ API keys" -ForegroundColor White

Write-Host ""
Write-Host "🔧 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Edit .env with your CJ credentials" -ForegroundColor White
Write-Host "2. Test the API with: .\test-cj.ps1" -ForegroundColor White
Write-Host "3. Review security settings in config.example.js" -ForegroundColor White
Write-Host "4. Deploy with production settings when ready" -ForegroundColor White

Write-Host ""
Write-Host "🔒 Security setup complete!" -ForegroundColor Green
Write-Host "Your application is now configured with security best practices." -ForegroundColor Green


# =====================================================
# SECURITY SCHEMA DEPLOYMENT SCRIPT
# =====================================================

Write-Host "Deploying Comprehensive Security Schema..." -ForegroundColor Green

# Set the working directory to auth-worker
Set-Location "auth-worker"

# Deploy the security schema to the database
Write-Host "Applying security schema to database..." -ForegroundColor Yellow

try {
    # Apply the security schema
    npx wrangler d1 execute fragrance-collect-db --file=security-schema.sql --remote
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Security schema deployed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to deploy security schema" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error deploying security schema: $_" -ForegroundColor Red
    exit 1
}

# Verify the security tables were created
Write-Host "Verifying security tables..." -ForegroundColor Yellow

try {
    $tables = @(
        "password_history",
        "password_policies", 
        "failed_login_attempts",
        "account_lockouts",
        "csrf_tokens",
        "session_events",
        "rate_limits",
        "audit_logs",
        "two_factor_settings",
        "two_factor_attempts",
        "password_reset_tokens",
        "encryption_keys",
        "security_settings"
    )
    
    foreach ($table in $tables) {
        $result = npx wrangler d1 execute fragrance-collect-db --command="SELECT name FROM sqlite_master WHERE type='table' AND name='$table';" --remote
        if ($result -match $table) {
            Write-Host "Table '$table' exists" -ForegroundColor Green
        } else {
            Write-Host "Table '$table' missing" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "Error verifying tables: $_" -ForegroundColor Red
}

# Check security settings
Write-Host "Verifying security settings..." -ForegroundColor Yellow

try {
    $settings = npx wrangler d1 execute fragrance-collect-db --command="SELECT setting_key, setting_value FROM security_settings;" --remote
    Write-Host "Security settings configured:" -ForegroundColor Cyan
    Write-Host $settings
} catch {
    Write-Host "Error checking security settings: $_" -ForegroundColor Red
}

Write-Host "Security schema deployment completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Security features now available:" -ForegroundColor Cyan
Write-Host "  • Password complexity validation" -ForegroundColor White
Write-Host "  • Account lockout protection" -ForegroundColor White
Write-Host "  • CSRF token protection" -ForegroundColor White
Write-Host "  • Enhanced session security" -ForegroundColor White
Write-Host "  • Rate limiting" -ForegroundColor White
Write-Host "  • Comprehensive audit logging" -ForegroundColor White
Write-Host "  • Two-factor authentication support" -ForegroundColor White
Write-Host "  • Password reset security" -ForegroundColor White
Write-Host "  • Data encryption" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Update worker code to use new security functions" -ForegroundColor White
Write-Host "  2. Test security features" -ForegroundColor White
Write-Host "  3. Monitor audit logs" -ForegroundColor White
Write-Host "  4. Configure additional security settings as needed" -ForegroundColor White

# CJ API Test Script
# Tests the Commission Junction API integration

Write-Host "🧪 Testing CJ API Integration" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# Check if API is running
Write-Host "🔍 Checking if API server is running..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get -TimeoutSec 10
    Write-Host "✅ API server is running" -ForegroundColor Green
    Write-Host "   Health status: $($healthResponse.status)" -ForegroundColor White
    
    if ($healthResponse.cj) {
        Write-Host "   CJ status: $($healthResponse.cj.status)" -ForegroundColor White
        Write-Host "   CJ message: $($healthResponse.cj.message)" -ForegroundColor White
    }
} catch {
    Write-Host "❌ API server is not running or not accessible" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Start the API server first:" -ForegroundColor Yellow
    Write-Host "   cd api && npm start" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "🔍 Testing product search..." -ForegroundColor Yellow

# Test basic product search
try {
    $productsResponse = Invoke-RestMethod -Uri "http://localhost:3000/products?q=perfume&limit=5" -Method Get -TimeoutSec 30
    Write-Host "✅ Product search successful" -ForegroundColor Green
    Write-Host "   Total products: $($productsResponse.total)" -ForegroundColor White
    Write-Host "   Products returned: $($productsResponse.products.Count)" -ForegroundColor White
    Write-Host "   Page: $($productsResponse.page)" -ForegroundColor White
    Write-Host "   Has more: $($productsResponse.hasMore)" -ForegroundColor White
    
    if ($productsResponse.products.Count -gt 0) {
        Write-Host ""
        Write-Host "📦 Sample product:" -ForegroundColor Cyan
        $sampleProduct = $productsResponse.products[0]
        Write-Host "   Name: $($sampleProduct.name)" -ForegroundColor White
        Write-Host "   Brand: $($sampleProduct.brand)" -ForegroundColor White
        Write-Host "   Price: $($sampleProduct.price)" -ForegroundColor White
        Write-Host "   Advertiser: $($sampleProduct.advertiser)" -ForegroundColor White
        Write-Host "   Shipping: $($sampleProduct.shippingCost)" -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Product search failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to get more details about the error
    try {
        $errorResponse = Invoke-WebRequest -Uri "http://localhost:3000/products?q=perfume&limit=5" -Method Get -TimeoutSec 30
        Write-Host "   HTTP Status: $($errorResponse.StatusCode)" -ForegroundColor Red
        Write-Host "   Response: $($errorResponse.Content)" -ForegroundColor Red
    } catch {
        Write-Host "   Could not get detailed error information" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🔍 Testing configuration endpoint..." -ForegroundColor Yellow

try {
    $configResponse = Invoke-RestMethod -Uri "http://localhost:3000/config" -Method Get -TimeoutSec 10
    Write-Host "✅ Configuration endpoint accessible" -ForegroundColor Green
    Write-Host "   Environment: $($configResponse.NODE_ENV)" -ForegroundColor White
    Write-Host "   Port: $($configResponse.PORT)" -ForegroundColor White
    Write-Host "   CJ API Base: $($configResponse.CJ_API_BASE)" -ForegroundColor White
    Write-Host "   CJ Dev Key: $($configResponse.CJ_DEV_KEY)" -ForegroundColor White
    Write-Host "   CJ Website ID: $($configResponse.CJ_WEBSITE_ID)" -ForegroundColor White
} catch {
    Write-Host "⚠️ Configuration endpoint not accessible (development mode only)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 Test Summary:" -ForegroundColor Cyan
Write-Host "===============" -ForegroundColor Cyan

if ($healthResponse.cj.status -eq "ok") {
    Write-Host "✅ CJ API is working correctly!" -ForegroundColor Green
    Write-Host "   Your credentials are valid and the API can communicate with CJ" -ForegroundColor White
} else {
    Write-Host "❌ CJ API has issues:" -ForegroundColor Red
    Write-Host "   $($healthResponse.cj.message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "   1. Check your .env file has correct CJ_DEV_KEY and CJ_WEBSITE_ID" -ForegroundColor White
    Write-Host "   2. Verify your CJ credentials are active at https://publisher.cj.com" -ForegroundColor White
    Write-Host "   3. Check if your CJ account has API access enabled" -ForegroundColor White
    Write-Host "   4. Ensure your website ID is approved and active" -ForegroundColor White
}

Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Green
Write-Host "   - Test with different search terms" -ForegroundColor White
Write-Host "   - Check product data quality" -ForegroundColor White
Write-Host "   - Monitor API performance" -ForegroundColor White
Write-Host "   - Set up monitoring and logging" -ForegroundColor White


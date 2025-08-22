// Test script for Revenue Optimization Implementation
// Run this in the browser console to test the new features

console.log('🧪 Testing Revenue Optimization Implementation...');

// Test 1: Check if new endpoints are available
async function testEndpoints() {
    try {
        const response = await fetch('https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/');
        const data = await response.json();
        console.log('✅ Endpoints test:', data);
        
        if (data.features && data.features.includes('multi-store-search')) {
            console.log('✅ Multi-store search feature detected');
        } else {
            console.log('❌ Multi-store search feature not found');
        }
    } catch (error) {
        console.error('❌ Endpoints test failed:', error);
    }
}

// Test 2: Test revenue-optimized search
async function testRevenueSearch() {
    try {
        const response = await fetch('https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/products?q=perfume&limit=10&sortBy=revenue');
        const data = await response.json();
        console.log('✅ Revenue search test:', {
            total: data.total,
            products: data.products?.length || 0,
            revenue: data.revenue,
            sources: data.sources,
            optimization: data.optimization
        });
        
        if (data.revenue && data.sources) {
            console.log('✅ Revenue optimization working correctly');
        } else {
            console.log('❌ Revenue optimization not working');
        }
    } catch (error) {
        console.error('❌ Revenue search test failed:', error);
    }
}

// Test 3: Test TikTok Shop integration
async function testTikTokIntegration() {
    try {
        const response = await fetch('https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/products?q=fragrance&includeTikTok=true&limit=5');
        const data = await response.json();
        console.log('✅ TikTok integration test:', {
            total: data.total,
            cjProducts: data.sources?.cj || 0,
            tiktokProducts: data.sources?.tiktok || 0
        });
        
        if (data.sources && data.sources.tiktok > 0) {
            console.log('✅ TikTok Shop integration working');
        } else {
            console.log('⚠️ TikTok Shop integration may need configuration');
        }
    } catch (error) {
        console.error('❌ TikTok integration test failed:', error);
    }
}

// Test 4: Test smart caching
async function testSmartCaching() {
    try {
        const startTime = Date.now();
        const response1 = await fetch('https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/products?q=luxury&limit=5');
        const time1 = Date.now() - startTime;
        
        const startTime2 = Date.now();
        const response2 = await fetch('https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/products?q=luxury&limit=5');
        const time2 = Date.now() - startTime2;
        
        console.log('✅ Smart caching test:', {
            firstRequest: time1 + 'ms',
            secondRequest: time2 + 'ms',
            cacheImprovement: time1 > time2 ? `${((time1 - time2) / time1 * 100).toFixed(1)}%` : 'No improvement'
        });
        
        if (time2 < time1) {
            console.log('✅ Caching working correctly');
        } else {
            console.log('⚠️ Caching may not be working');
        }
    } catch (error) {
        console.error('❌ Smart caching test failed:', error);
    }
}

// Test 5: Test commission calculation
function testCommissionCalculation() {
    console.log('🧮 Testing commission calculation...');
    
    // Mock product data
    const mockProduct = {
        title: 'Luxury Designer Perfume',
        brand: 'Luxury Brand',
        price: { amount: 150 }
    };
    
    // Test brand category detection
    const brandCategory = getBrandCategory(mockProduct);
    console.log('✅ Brand category detection:', brandCategory);
    
    // Test commission rate
    const commissionRate = getCommissionRate(mockProduct);
    console.log('✅ Commission rate calculation:', (commissionRate * 100).toFixed(1) + '%');
    
    // Test revenue score
    const revenueScore = calculateRevenueScore(mockProduct, 'luxury');
    console.log('✅ Revenue score calculation:', revenueScore.toFixed(2));
}

// Helper functions for testing (these should match your worker implementation)
function getBrandCategory(product) {
    const brand = product.brand?.toLowerCase() || '';
    const title = product.title?.toLowerCase() || '';
    
    if (brand.includes('luxury') || title.includes('luxury')) return 'luxury';
    if (brand.includes('designer') || title.includes('designer')) return 'designer';
    if (brand.includes('niche') || title.includes('niche')) return 'niche';
    if (brand.includes('celebrity') || title.includes('celebrity')) return 'celebrity';
    if (title.includes('limited') || title.includes('seasonal')) return 'seasonal';
    
    return 'default';
}

function getCommissionRate(product) {
    const COMMISSION_RATES = {
        'luxury': { rate: 0.12, weight: 1.0 },
        'designer': { rate: 0.10, weight: 0.9 },
        'niche': { rate: 0.08, weight: 0.8 },
        'celebrity': { rate: 0.09, weight: 0.85 },
        'seasonal': { rate: 0.07, weight: 0.75 },
        'default': { rate: 0.06, weight: 0.7 }
    };
    
    const brandCategory = getBrandCategory(product);
    return COMMISSION_RATES[brandCategory]?.rate || COMMISSION_RATES.default.rate;
}

function calculateRevenueScore(product, query) {
    let score = 0;
    
    // Base commission rate
    const commissionRate = getCommissionRate(product);
    score += commissionRate * 100;
    
    // Price optimization (prefer $50-$300 range)
    const price = parseFloat(product.price?.amount || 0);
    if (price >= 50 && price <= 300) {
        score += 50;
    }
    
    // Brand category weighting
    const brandCategory = getBrandCategory(product);
    const COMMISSION_RATES = {
        'luxury': { rate: 0.12, weight: 1.0 },
        'designer': { rate: 0.10, weight: 0.9 },
        'niche': { rate: 0.08, weight: 0.8 },
        'celebrity': { rate: 0.09, weight: 0.85 },
        'seasonal': { rate: 0.07, weight: 0.75 },
        'default': { rate: 0.06, weight: 0.7 }
    };
    const categoryWeight = COMMISSION_RATES[brandCategory]?.weight || COMMISSION_RATES.default.weight;
    score *= categoryWeight;
    
    // Query relevance
    if (query) {
        const queryLower = query.toLowerCase();
        const titleLower = product.title?.toLowerCase() || '';
        if (titleLower.includes(queryLower)) score += 30;
    }
    
    return score;
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting Revenue Optimization Tests...\n');
    
    await testEndpoints();
    console.log('');
    
    await testRevenueSearch();
    console.log('');
    
    await testTikTokIntegration();
    console.log('');
    
    await testSmartCaching();
    console.log('');
    
    testCommissionCalculation();
    console.log('');
    
    console.log('🎉 All tests completed!');
}

// Export for use in browser console
window.testRevenueOptimization = {
    runAllTests,
    testEndpoints,
    testRevenueSearch,
    testTikTokIntegration,
    testSmartCaching,
    testCommissionCalculation
};

console.log('🧪 Revenue Optimization test script loaded!');
console.log('Run window.testRevenueOptimization.runAllTests() to test all features');
console.log('Or run individual tests like window.testRevenueOptimization.testRevenueSearch()');

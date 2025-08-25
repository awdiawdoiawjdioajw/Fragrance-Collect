// Test script for the Cloudflare D1 database endpoints
const WORKER_URL = 'https://auth-worker.joshuablaszczyk.workers.dev';

async function testDatabase() {
  console.log('🧪 Testing Cloudflare D1 Database Endpoints...\n');

  // Test 1: Create/Login User
  console.log('1. Testing user creation/login...');
  try {
    const loginResponse = await fetch(`${WORKER_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful:', loginData.success);
    
    if (loginData.session?.token) {
      const token = loginData.session.token;
      
      // Test 2: Get Session
      console.log('\n2. Testing session validation...');
      const sessionResponse = await fetch(`${WORKER_URL}/session?token=${token}`);
      const sessionData = await sessionResponse.json();
      console.log('✅ Session valid:', sessionData.success);
      
      // Test 3: Get User
      console.log('\n3. Testing user retrieval...');
      const userResponse = await fetch(`${WORKER_URL}/user?id=test-user-123`);
      const userData = await userResponse.json();
      console.log('✅ User retrieved:', userData.success);
      
      // Test 4: Logout
      console.log('\n4. Testing logout...');
      const logoutResponse = await fetch(`${WORKER_URL}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const logoutData = await logoutResponse.json();
      console.log('✅ Logout successful:', logoutData.success);
      
      // Test 5: Verify session is invalidated
      console.log('\n5. Testing session invalidation...');
      const invalidSessionResponse = await fetch(`${WORKER_URL}/session?token=${token}`);
      const invalidSessionData = await invalidSessionResponse.json();
      console.log('✅ Session invalidated:', !invalidSessionData.success);
      
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  console.log('\n🎉 Database tests completed!');
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  testDatabase();
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testDatabase };
}

require('dotenv').config();
const fetch = require('node-fetch');

const API_BASE_URL = 'https://quickbill-production.up.railway.app/api';

async function testAdminEndpoints() {
  console.log('🔍 Testing Admin API Endpoints...\n');
  
  // First, we need to login as admin
  console.log('1️⃣ Testing Admin Login...');
  try {
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'deepanshuverma966@gmail.com',
        password: 'YOUR_ADMIN_PASSWORD' // Replace with actual password
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData.success ? '✅ Success' : '❌ Failed');
    
    if (!loginData.success) {
      console.log('Cannot proceed without valid login. Please check credentials.');
      return;
    }
    
    const authToken = loginData.data.token;
    console.log('Auth token received:', authToken ? '✅' : '❌');
    
    // Test each endpoint
    const endpoints = [
      { 
        name: 'Pending Payments', 
        url: '/subscriptions-simple/pending-payments',
        method: 'GET'
      },
      { 
        name: 'Active Subscriptions', 
        url: '/subscriptions-simple/active-subscriptions',
        method: 'GET'
      },
      { 
        name: 'Admin Users List', 
        url: '/admin/users',
        method: 'GET'
      }
    ];
    
    console.log('\n2️⃣ Testing API Endpoints...\n');
    
    for (const endpoint of endpoints) {
      console.log(`Testing ${endpoint.name}...`);
      try {
        const response = await fetch(`${API_BASE_URL}${endpoint.url}`, {
          method: endpoint.method,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`  Status: ${response.status} ${response.status === 200 ? '✅' : '❌'}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`  Success: ${data.success ? '✅' : '❌'}`);
          console.log(`  Data count: ${data.data ? data.data.length : 0}`);
        } else {
          const errorText = await response.text();
          console.log(`  Error: ${errorText.substring(0, 100)}...`);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

console.log('⚠️  Note: Replace YOUR_ADMIN_PASSWORD with your actual admin password in the script\n');
testAdminEndpoints();
// Configuration
const API_BASE_URL = 'https://quickbill-production.up.railway.app/api';
let authToken = localStorage.getItem('adminToken');
let currentUser = null;

// Check authentication on load
window.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        showDashboard();
    } else {
        showLogin();
    }
    
    // Setup event listeners
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });
});

// Login handler
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Login response:', result);
            
            // Handle the response structure from your API
            // Your API returns: { success: true, data: { user: {...}, token: "..." } }
            if (result.success && result.data) {
                const user = result.data.user;
                const token = result.data.token;
                
                console.log('User:', user);
                console.log('Token:', token ? 'Present' : 'Missing');
                
                // Check if user is admin
                if (user && (user.email === 'deepanshuverma966@gmail.com' || CONFIG.ADMIN_EMAILS.includes(user.email))) {
                    authToken = token;
                    currentUser = user;
                    localStorage.setItem('adminToken', authToken);
                    showDashboard();
                } else {
                    showError('Access denied. Admin privileges required.');
                }
            } else {
                showError('Invalid response format from server');
                console.error('Unexpected response format:', result);
            }
        } else {
            showError('Invalid email or password');
        }
    } catch (error) {
        showError('Connection error. Please try again.');
        console.error('Login error:', error);
    }
}

// Show login screen
function showLogin() {
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
}

// Show dashboard
function showDashboard() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('adminDashboard').classList.remove('hidden');
    loadDashboardData();
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // For now, use mock data if API calls fail
        if (CONFIG.DEMO_MODE) {
            displayPendingPayments(CONFIG.MOCK_DATA.pendingPayments);
            document.getElementById('pendingCount').textContent = CONFIG.MOCK_DATA.pendingPayments.length;
            displayActiveSubscriptions(CONFIG.MOCK_DATA.activeSubscriptions);
            document.getElementById('activeCount').textContent = CONFIG.MOCK_DATA.activeSubscriptions.length;
            document.getElementById('userCount').textContent = CONFIG.MOCK_DATA.users.length;
            document.getElementById('revenueCount').textContent = '₹15,996';
            return;
        }
        
        // Load pending payments
        const pendingResponse = await authenticatedFetch('/subscriptions/pending-payments');
        const pendingData = await pendingResponse.json();
        displayPendingPayments(pendingData.data || []);
        document.getElementById('pendingCount').textContent = pendingData.data?.length || 0;
        
        // Load active subscriptions
        const activeResponse = await authenticatedFetch('/subscriptions/active');
        const activeData = await activeResponse.json();
        displayActiveSubscriptions(activeData.data || []);
        document.getElementById('activeCount').textContent = activeData.data?.length || 0;
        
        // Load user stats
        const usersResponse = await authenticatedFetch('/admin/users');
        const usersData = await usersResponse.json();
        document.getElementById('userCount').textContent = usersData.data?.length || 0;
        
        // Calculate monthly revenue
        const revenue = calculateMonthlyRevenue(activeData.data || []);
        document.getElementById('revenueCount').textContent = `₹${revenue}`;
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Display pending payments
function displayPendingPayments(payments) {
    const container = document.getElementById('pendingList');
    
    if (payments.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No pending payments</p>';
        return;
    }
    
    container.innerHTML = payments.map(payment => `
        <div class="border rounded-lg p-4 hover:shadow-md transition">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-semibold">${payment.userName || 'Unknown User'}</h4>
                    <p class="text-sm text-gray-600">${payment.userEmail}</p>
                    <p class="text-sm text-gray-600">Phone: ${payment.userPhone}</p>
                    <div class="mt-2">
                        <span class="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                            ${payment.planName} - ₹${payment.amount}
                        </span>
                        <span class="inline-block bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm ml-2">
                            Ref: ${payment.transactionRef}
                        </span>
                    </div>
                    <p class="text-xs text-gray-500 mt-2">
                        Submitted: ${new Date(payment.submittedAt).toLocaleString()}
                    </p>
                </div>
                <div class="flex flex-col gap-2">
                    ${payment.proofImageUrl ? `
                        <button onclick="viewProof('${payment.id}')" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                            View Proof
                        </button>
                    ` : ''}
                    <button onclick="approvePayment('${payment.id}')" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                        Approve
                    </button>
                    <button onclick="rejectPayment('${payment.id}')" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
                        Reject
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Approve payment
async function approvePayment(paymentId) {
    if (!confirm('Approve this payment and activate subscription?')) return;
    
    try {
        const response = await authenticatedFetch(`/subscriptions/verify-payment/${paymentId}`, {
            method: 'POST',
            body: JSON.stringify({ status: 'approved' })
        });
        
        if (response.ok) {
            alert('Payment approved successfully!');
            loadDashboardData();
        } else {
            alert('Error approving payment');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error approving payment');
    }
}

// Reject payment
async function rejectPayment(paymentId) {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    
    try {
        const response = await authenticatedFetch(`/subscriptions/verify-payment/${paymentId}`, {
            method: 'POST',
            body: JSON.stringify({ status: 'rejected', reason })
        });
        
        if (response.ok) {
            alert('Payment rejected');
            loadDashboardData();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error rejecting payment');
    }
}

// Display active subscriptions
function displayActiveSubscriptions(subscriptions) {
    const container = document.getElementById('activeList');
    
    if (subscriptions.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No active subscriptions</p>';
        return;
    }
    
    container.innerHTML = subscriptions.map(sub => `
        <div class="border rounded-lg p-4">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-semibold">${sub.userName || 'Unknown User'}</h4>
                    <p class="text-sm text-gray-600">${sub.userEmail}</p>
                    <div class="mt-2">
                        <span class="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                            ${sub.planName} Plan
                        </span>
                        <span class="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm ml-2">
                            ${sub.daysRemaining || 0} days remaining
                        </span>
                    </div>
                    <p class="text-xs text-gray-500 mt-2">
                        Expires: ${new Date(sub.expiresAt).toLocaleDateString()}
                    </p>
                </div>
            </div>
        </div>
    `).join('');
}

// View payment proof
async function viewProof(paymentId) {
    const modal = document.getElementById('proofModal');
    const content = document.getElementById('modalContent');
    
    try {
        const response = await authenticatedFetch(`/subscriptions/payment/${paymentId}`);
        const payment = await response.json();
        
        content.innerHTML = `
            <div class="space-y-4">
                <div>
                    <p class="font-semibold">User: ${payment.userName}</p>
                    <p>Email: ${payment.userEmail}</p>
                    <p>Phone: ${payment.userPhone}</p>
                </div>
                <div>
                    <p class="font-semibold">Plan: ${payment.planName}</p>
                    <p>Amount: ₹${payment.amount}</p>
                    <p>Reference: ${payment.transactionRef}</p>
                </div>
                ${payment.proofImageUrl ? `
                    <div>
                        <p class="font-semibold mb-2">Payment Screenshot:</p>
                        <img src="${payment.proofImageUrl}" alt="Payment Proof" class="max-w-full">
                    </div>
                ` : '<p class="text-gray-500">No payment proof uploaded</p>'}
                <button onclick="closeModal()" class="bg-gray-500 text-white px-4 py-2 rounded">
                    Close
                </button>
            </div>
        `;
        
        modal.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading proof:', error);
    }
}

// Helper functions
function authenticatedFetch(endpoint, options = {}) {
    return fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
}

function showError(message) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function handleLogout() {
    localStorage.removeItem('adminToken');
    authToken = null;
    showLogin();
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('[id$="Tab"]').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
        btn.classList.add('text-gray-600');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}Tab`).classList.remove('hidden');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
}

function closeModal() {
    document.getElementById('proofModal').classList.add('hidden');
}

function calculateMonthlyRevenue(subscriptions) {
    const now = new Date();
    const thisMonth = subscriptions.filter(sub => {
        const createdAt = new Date(sub.createdAt);
        return createdAt.getMonth() === now.getMonth() && 
               createdAt.getFullYear() === now.getFullYear();
    });
    
    return thisMonth.reduce((total, sub) => total + (sub.amount || 0), 0);
}
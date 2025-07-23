// Configuration for QuickBill Admin Panel
const CONFIG = {
    // API Configuration
    API_BASE_URL: 'https://quickbill-production.up.railway.app/api',
    
    // Admin emails (add more if needed)
    ADMIN_EMAILS: [
        'deepanshuverma966@gmail.com'
    ],
    
    // Plan details for reference
    PLANS: {
        silver: {
            name: 'Silver',
            price: 1999,
            duration: 30,
            color: 'gray'
        },
        gold: {
            name: 'Gold', 
            price: 3999,
            duration: 30,
            color: 'yellow'
        },
        platinum: {
            name: 'Platinum',
            price: 9999,
            duration: 30,
            color: 'purple'
        }
    },
    
    // Demo mode - set to true to use mock data
    DEMO_MODE: false,
    
    // Mock data for testing when API is not available
    MOCK_DATA: {
        pendingPayments: [
            {
                id: '1',
                userId: 'user1',
                userName: 'John Doe',
                userEmail: 'john@example.com',
                userPhone: '9876543210',
                planId: 2,
                planName: 'Gold',
                amount: 3999,
                transactionRef: 'UPI123456789',
                submittedAt: new Date().toISOString(),
                status: 'pending',
                proofImageUrl: null
            },
            {
                id: '2',
                userId: 'user2',
                userName: 'Jane Smith',
                userEmail: 'jane@example.com',
                userPhone: '9876543211',
                planId: 3,
                planName: 'Platinum',
                amount: 9999,
                transactionRef: 'UPI987654321',
                submittedAt: new Date(Date.now() - 3600000).toISOString(),
                status: 'pending',
                proofImageUrl: null
            }
        ],
        activeSubscriptions: [
            {
                id: '1',
                userId: 'user3',
                userName: 'Bob Wilson',
                userEmail: 'bob@example.com',
                planName: 'Silver',
                amount: 1999,
                activatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
                expiresAt: new Date(Date.now() + 86400000 * 20).toISOString(),
                daysRemaining: 20
            }
        ],
        users: [
            {
                id: 'user1',
                name: 'John Doe',
                email: 'john@example.com',
                phone: '9876543210',
                createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
                subscription: null
            },
            {
                id: 'user2',
                name: 'Jane Smith',
                email: 'jane@example.com',
                phone: '9876543211',
                createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
                subscription: null
            },
            {
                id: 'user3',
                name: 'Bob Wilson',
                email: 'bob@example.com',
                phone: '9876543212',
                createdAt: new Date(Date.now() - 86400000 * 45).toISOString(),
                subscription: {
                    plan: 'Silver',
                    expiresAt: new Date(Date.now() + 86400000 * 20).toISOString()
                }
            }
        ]
    }
};
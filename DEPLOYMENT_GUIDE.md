# QuickBill Admin Panel - GitHub Pages Deployment Guide

## 🚀 Quick Start

### Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com)
2. Click the "+" icon → "New repository"
3. Repository name: `quickbill-admin`
4. Set as Public (required for free GitHub Pages)
5. Don't initialize with README
6. Click "Create repository"

### Step 2: Upload Admin Panel

Open Terminal and run these commands:

```bash
cd /Users/mac/Desktop/quickbill/github-admin-panel

# Initialize git
git init

# Add all files
git add .

# First commit
git commit -m "Initial QuickBill Admin Panel"

# Add your repository (replace USERNAME with your GitHub username)
git remote add origin https://github.com/deepanshuverma966/quickbill-admin.git

# Push to GitHub
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. Go to your repository: `https://github.com/deepanshuverma966/quickbill-admin`
2. Click "Settings" tab
3. Scroll down to "Pages" section (in left sidebar)
4. Under "Source", select:
   - Deploy from: "Deploy from a branch"
   - Branch: "main"
   - Folder: "/ (root)"
5. Click "Save"

### Step 4: Access Your Admin Panel

After 2-5 minutes, your admin panel will be live at:
```
https://deepanshuverma966.github.io/quickbill-admin/
```

## 📝 Login Credentials

- Email: `deepanshuverma966@gmail.com`
- Password: Your QuickBill account password

## 🛠️ Customization

### Change Admin Emails
Edit `config.js`:
```javascript
ADMIN_EMAILS: [
    'deepanshuverma966@gmail.com',
    'another-admin@example.com'  // Add more admins
]
```

### Enable Demo Mode
To test without API connection, edit `config.js`:
```javascript
DEMO_MODE: true  // Uses mock data
```

## 🔄 Updating the Panel

To push updates:
```bash
git add .
git commit -m "Update description"
git push
```

Changes will reflect in 1-2 minutes.

## 🔒 Security Notes

1. Only users with emails in `ADMIN_EMAILS` can access
2. All data fetches from your Railway backend
3. Served over HTTPS automatically
4. No sensitive data stored in GitHub

## 📱 Mobile App Integration

Update your app's subscription screen to submit payments:
```javascript
const submitPayment = async () => {
  await authenticatedApiCall(
    API_ENDPOINTS.SUBSCRIPTIONS.SUBMIT_PAYMENT,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        planId: selectedPlan.id,
        amount: selectedPlan.price,
        transactionRef: transactionRef,
        proofImageBase64: paymentProof.base64
      })
    }
  );
};
```

## 🐛 Troubleshooting

### Panel not loading?
1. Check if GitHub Pages is enabled
2. Wait 5-10 minutes after first deployment
3. Check browser console for errors

### Can't login?
1. Verify your email is in `ADMIN_EMAILS`
2. Check if Railway backend is running
3. Try Demo Mode to test UI

### API errors?
1. Check Railway backend logs
2. Verify API endpoints in config.js
3. Test with Demo Mode first

## 📞 Support

- GitHub Issues: Create issue in your repo
- Railway Status: Check Railway dashboard
- API Health: Visit `https://quickbill-production.up.railway.app/health`
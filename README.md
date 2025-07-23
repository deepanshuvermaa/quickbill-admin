# QuickBill Admin Panel

A web-based admin panel for QuickBill POS to manage payment verifications and subscriptions.

## Setup

1. **Deploy to GitHub Pages:**
   ```bash
   # Create a new repository on GitHub called 'quickbill-admin'
   git init
   git add .
   git commit -m "Initial admin panel"
   git remote add origin https://github.com/yourusername/quickbill-admin.git
   git push -u origin main
   
   # Enable GitHub Pages in repository settings
   # Select 'main' branch and '/ (root)' folder
   ```

2. **Access your admin panel:**
   ```
   https://yourusername.github.io/quickbill-admin/
   ```

3. **Login with your admin credentials:**
   - Email: deepanshuverma966@gmail.com
   - Password: Your QuickBill password

## Features

- View pending payment verifications
- Approve/Reject payments with proof
- View active subscriptions
- User management
- Revenue analytics

## How It Works

1. **User submits payment in app** → Saves to Railway PostgreSQL
2. **Admin opens web panel** → Fetches data from Railway API
3. **Admin approves payment** → Updates PostgreSQL via API
4. **User's app gets updated** → Subscription activated

## Security

- Only admin emails can access
- All API calls are authenticated
- Hosted on HTTPS via GitHub Pages

## Customization

Edit `index.html` for UI changes and `app.js` for functionality.
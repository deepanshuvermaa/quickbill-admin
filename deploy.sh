#!/bin/bash

echo "🚀 Deploying QuickBill Admin Panel to GitHub Pages..."

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📦 Initializing git repository..."
    git init
fi

# Add all files
echo "📝 Adding files..."
git add .

# Commit
echo "💾 Committing changes..."
git commit -m "Update admin panel $(date +%Y-%m-%d)"

# Check if remote exists
if ! git remote | grep -q origin; then
    echo "🔗 Adding remote origin..."
    echo "Please enter your GitHub repository URL:"
    read -p "URL (e.g., https://github.com/username/quickbill-admin.git): " repo_url
    git remote add origin "$repo_url"
fi

# Push to main branch
echo "📤 Pushing to GitHub..."
git push -u origin main

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Go to your GitHub repository settings"
echo "2. Navigate to Pages section"
echo "3. Set Source to 'Deploy from a branch'"
echo "4. Select 'main' branch and '/ (root)' folder"
echo "5. Save and wait a few minutes"
echo ""
echo "🌐 Your admin panel will be available at:"
echo "https://[your-username].github.io/quickbill-admin/"
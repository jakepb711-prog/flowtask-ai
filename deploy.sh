#!/bin/bash

# FlowTask AI - Vercel Deployment Script
# This script automates the GitHub push and Vercel deployment process

set -e

echo "🚀 FlowTask AI - Vercel Deployment"
echo "=================================="
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git not initialized"
    exit 1
fi

# Check git status
echo "📍 Current git status:"
git status --short
echo ""

# Get GitHub username
read -p "Enter your GitHub username: " GITHUB_USER
if [ -z "$GITHUB_USER" ]; then
    echo "❌ GitHub username required"
    exit 1
fi

# Get repository name
read -p "Enter repository name (default: flowtask-ai): " REPO_NAME
REPO_NAME=${REPO_NAME:-flowtask-ai}

GITHUB_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo ""
echo "📦 Repository details:"
echo "  GitHub URL: $GITHUB_URL"
echo "  Branch: main"
echo ""

# Check if remote already exists
if git remote | grep -q "^origin$"; then
    echo "⚠️  Remote 'origin' already exists"
    read -p "Override existing remote? (y/n): " OVERRIDE
    if [ "$OVERRIDE" = "y" ]; then
        git remote remove origin
    else
        echo "❌ Aborted"
        exit 1
    fi
fi

# Add remote
echo "🔗 Adding remote..."
git remote add origin "$GITHUB_URL"

# Rename branch to main if on master
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" = "master" ]; then
    echo "📝 Renaming branch to 'main'..."
    git branch -M main
fi

echo ""
echo "📤 Ready to push to GitHub"
echo "  Command: git push -u origin main"
echo ""
echo "To complete deployment:"
echo "  1. Make sure you're logged in to GitHub"
echo "  2. Create the repository at: https://github.com/new"
echo "  3. Name it: $REPO_NAME"
echo "  4. Make it PUBLIC"
echo "  5. Come back here and press Enter to continue"
echo ""

read -p "Press Enter after creating the GitHub repo..."

echo ""
echo "🔐 Pushing code to GitHub..."
echo "  (You may be prompted for authentication)"
echo ""

git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "🎉 Next steps:"
    echo ""
    echo "  1. Go to Vercel: https://vercel.com/new"
    echo "  2. Click 'Import Git Repository'"
    echo "  3. Enter: $GITHUB_URL"
    echo "  4. Click 'Import'"
    echo "  5. In Environment Variables, add:"
    echo "     ANTHROPIC_API_KEY = sk_your_actual_key_here"
    echo "  6. Click 'Deploy'"
    echo ""
    echo "📝 Note: Get your Anthropic API key from:"
    echo "   https://console.anthropic.com/api_keys"
    echo ""
    echo "⏱️  Deployment will take 2-5 minutes"
    echo "✨ Your app will be live at:"
    echo "   https://$REPO_NAME.vercel.app"
    echo ""
else
    echo "❌ Failed to push to GitHub"
    echo "   Make sure you have permission to push"
    exit 1
fi

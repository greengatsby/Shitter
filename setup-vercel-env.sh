#!/bin/bash

# Set up Vercel environment variables
echo "Setting up Vercel environment variables..."

# Read from .env.local and set them in Vercel
ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env.local | cut -d '=' -f2)
V0_API_KEY=$(grep V0_API_KEY .env.local | cut -d '=' -f2)
GITHUB_PERSONAL_ACCESS_TOKEN=$(grep GITHUB_PERSONAL_ACCESS_TOKEN .env.local | cut -d '=' -f2)

echo "Setting ANTHROPIC_API_KEY..."
echo "$ANTHROPIC_API_KEY" | vercel env add ANTHROPIC_API_KEY production

echo "Setting V0_API_KEY..."
echo "$V0_API_KEY" | vercel env add V0_API_KEY production

echo "Setting GITHUB_PERSONAL_ACCESS_TOKEN..."
echo "$GITHUB_PERSONAL_ACCESS_TOKEN" | vercel env add GITHUB_PERSONAL_ACCESS_TOKEN production

echo "Environment variables set up successfully!"
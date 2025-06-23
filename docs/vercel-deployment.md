# Vercel Deployment Guide

## 🚀 **Deployment Status**

✅ **Successfully Deployed!**

- **Production URL:** https://shitter-iz9flym3d-dane-myers-projects.vercel.app
- **Project Dashboard:** https://vercel.com/dane-myers-projects/shitter
- **GitHub Repository:** https://github.com/greengatsby/Shitter

## 📋 **Deployment Configuration**

### vercel.json Configuration
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev", 
  "installCommand": "npm install",
  "framework": "nextjs",
  "functions": {
    "src/app/api/*/route.ts": {
      "maxDuration": 60
    }
  },
  "regions": ["iad1"]
}
```

## 🔧 **Environment Variables Setup**

The following environment variables need to be configured in Vercel:

### Required Variables:
- `ANTHROPIC_API_KEY` - Claude API key for the Claude Code SDK
- `V0_API_KEY` - v0.dev API key for component generation
- `GITHUB_PERSONAL_ACCESS_TOKEN` - GitHub token for MCP server

### Setting Environment Variables:

#### Method 1: Vercel Dashboard
1. Go to https://vercel.com/dane-myers-projects/shitter
2. Navigate to Settings > Environment Variables
3. Add each variable with the appropriate value

#### Method 2: Vercel CLI
```bash
# Set environment variables via CLI
vercel env add ANTHROPIC_API_KEY production
vercel env add V0_API_KEY production
vercel env add GITHUB_PERSONAL_ACCESS_TOKEN production
```

#### Method 3: Automated Script
Use the provided setup script:
```bash
chmod +x setup-vercel-env.sh
./setup-vercel-env.sh
```

## 🔄 **Automatic Deployments**

✅ **GitHub Integration Connected**

- **Repository:** greengatsby/Shitter
- **Branch:** main
- **Auto-deploy:** Enabled

### How it works:
1. Push to `main` branch → Automatic production deployment
2. Push to other branches → Preview deployments
3. Pull requests → Preview deployments with unique URLs

## 🌐 **Available Pages**

Once deployed, the following pages are available:

- **Home:** `/` - Main landing page
- **SocialBloom:** `/socialbloom` - Premium marketing agency page
- **Elena Garidis:** `/elena-garidis` - Stanford contact page
- **Experts Helping Businesses:** `/experts-helping-businesses` - Business consulting page
- **v0 Demo:** `/v0-demo` - v0-generated hero component
- **v0 Test:** `/v0-test` - v0 API testing interface

### API Endpoints:
- **Claude API:** `/api/claude` - Claude Code SDK integration
- **v0 API:** `/api/v0` - v0.dev component generation

## 📊 **Build Information**

```
Route (app)                              Size     First Load JS
┌ ○ /                                    5.33 kB        92.5 kB
├ ○ /_not-found                          875 B            88 kB
├ ƒ /api/claude                          0 B                0 B
├ ƒ /api/v0                              0 B                0 B
├ ○ /elena-garidis                       784 B          95.7 kB
├ ○ /experts-helping-businesses          784 B          95.7 kB
├ ○ /socialbloom                         7.31 kB         109 kB
├ ○ /v0-demo                             176 B          94.1 kB
└ ○ /v0-test                             3.34 kB        98.3 kB
```

## 🚀 **Deployment Commands**

### Manual Deployment
```bash
# Deploy to production
vercel --prod

# Deploy preview
vercel

# Deploy with specific name
vercel --prod --name shitter
```

### Domain Management
```bash
# Add custom domain
vercel domains add your-domain.com

# List domains
vercel domains list

# Remove domain
vercel domains rm your-domain.com
```

## 🔍 **Monitoring & Logs**

### View Logs
```bash
# View latest deployment logs
vercel logs

# View specific deployment logs
vercel logs [deployment-url]

# Stream logs in real-time
vercel logs --follow
```

### Analytics
- Access analytics at: https://vercel.com/dane-myers-projects/shitter/analytics
- View performance metrics, visitor data, and function usage

## 🛠️ **Troubleshooting**

### Common Issues:

#### Build Failures
- Check TypeScript errors: `npm run build`
- Verify environment variables are set
- Check import/export statements

#### API Route Issues
- Ensure environment variables are set in Vercel
- Check function timeout limits (60s max)
- Verify API keys are valid

#### Environment Variables Not Working
- Ensure variables are set in Vercel dashboard
- Check spelling and case sensitivity
- Redeploy after adding new variables

### Debug Commands
```bash
# Check deployment status
vercel list

# Inspect specific deployment
vercel inspect [deployment-url]

# Check project settings
vercel project list
```

## 🔐 **Security Notes**

- Environment variables are encrypted and secure in Vercel
- API keys are not exposed in client-side code
- All API routes use server-side rendering
- GitHub integration uses secure webhook authentication

## 🔄 **CI/CD Workflow**

1. **Development** → Local development with `npm run dev`
2. **Commit** → Push changes to GitHub
3. **Build** → Vercel automatically builds on push
4. **Deploy** → Production deployment to custom URL
5. **Monitor** → Check logs and analytics

## 📞 **Support**

- **Vercel Documentation:** https://vercel.com/docs
- **GitHub Repository:** https://github.com/greengatsby/Shitter
- **Project Dashboard:** https://vercel.com/dane-myers-projects/shitter
# Railway Deployment Guide

Your Unity in Diversity platform is now ready for Railway deployment! 🚀

## ✅ What's Been Prepared

1. **Express Server** (`server.js`)
   - Serves your HTML application
   - Includes security middleware (Helmet)
   - Compression for faster loading
   - API endpoint for form submissions (`/api/intake`)
   - Health check endpoint (`/health`)

2. **Configuration Files**
   - `package.json` - Node.js dependencies
   - `railway.json` - Railway deployment settings
   - `.gitignore` - Excludes unnecessary files
   - `README.md` - Complete documentation

3. **Git Repository**
   - ✅ Initialized
   - ✅ All files committed
   - ✅ Pushed to: https://github.com/Charlescifix/uid.git

## 🚀 Deploy to Railway (3 Simple Steps)

### Step 1: Sign Up for Railway

1. Go to [railway.app](https://railway.app)
2. Click "Login" and sign in with GitHub
3. Authorize Railway to access your repositories

### Step 2: Create New Project

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose `Charlescifix/uid` from the list
4. Railway will automatically:
   - Detect it's a Node.js project
   - Install dependencies
   - Build and deploy

### Step 3: Get Your Live URL

1. Wait 2-3 minutes for deployment
2. Click on your project
3. Go to "Settings" → "Domains"
4. You'll see your live URL like: `https://uid-production.up.railway.app`

## 🎯 Next Steps After Deployment

### 1. Test Your Deployment

Visit your Railway URL and test:
- ✅ Homepage loads correctly
- ✅ Form works through all 5 steps
- ✅ Images display properly
- ✅ Buttons and interactions work

### 2. Set Up Custom Domain (Optional)

In Railway dashboard:
1. Go to Settings → Domains
2. Click "Add Custom Domain"
3. Enter your domain (e.g., `www.theuid.uk`)
4. Update your DNS settings as shown

### 3. Configure Environment Variables (If Needed)

If you need to add API keys or configuration:
1. Go to Variables tab
2. Click "New Variable"
3. Add your variables:
   - `NODE_ENV=production` (recommended)
   - Any API keys for email/database services

### 4. Set Up Form Backend (Future)

Currently, form data is logged to console. To save data:

1. Add a database (Railway supports PostgreSQL):
   - Click "New" → "Database" → "PostgreSQL"
   - Connect to your project

2. Update `server.js` line 35-42 to save to database

3. Consider adding email notifications

## 📊 Monitoring & Maintenance

### View Logs
- Railway Dashboard → Your Project → "Deployments"
- Click on latest deployment → "View Logs"

### Check Health
- Visit: `https://your-url.railway.app/health`
- Should return: `{"status":"healthy","timestamp":"..."}`

### Redeploy
Railway auto-deploys on every push to `main` branch:
```bash
git add .
git commit -m "Update message"
git push origin main
```

## 🔒 Security Checklist

- ✅ Helmet.js configured for security headers
- ✅ HTTPS enforced by Railway
- ✅ Environment variables for secrets (not in code)
- ⚠️ Add rate limiting for production (recommended)
- ⚠️ Set up CORS if needed for API calls

## 💡 Common Issues & Solutions

### Issue: Deployment Failed
**Solution**: Check logs in Railway dashboard for errors

### Issue: Images Not Loading
**Solution**: Ensure `men.png` and `uid_logo.png` are in repository

### Issue: Form Not Submitting
**Solution**: Check browser console for errors, verify `/api/intake` endpoint

### Issue: Port Error
**Solution**: Railway automatically sets PORT, no action needed

## 📞 Support

- **Railway Docs**: https://docs.railway.app
- **GitHub Issues**: https://github.com/Charlescifix/uid/issues
- **Email**: info@theuid.uk

## 🎉 You're All Set!

Your platform is production-ready. Simply deploy to Railway and share the URL with your team!

---

**Powered by Gen3block AI**

# Unity in Diversity - Assistance Request Platform

A modern, accessible web platform for Unity in Diversity CIC to help men access support services across employment, relationships, emotional wellbeing, housing, and more.

## Features

- **Multi-step Form**: Easy-to-use 5-step intake form
- **Smart Triage**: Automated risk assessment and priority classification
- **Responsive Design**: Works beautifully on all devices
- **Accessible**: Built with accessibility best practices
- **Secure**: Form validation and data protection

## Tech Stack

- **Frontend**: React (CDN), TailwindCSS
- **Backend**: Node.js, Express
- **Deployment**: Railway.app

## Local Development

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone https://github.com/Charlescifix/uid.git
cd uid
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open your browser and visit:
```
http://localhost:3000
```

## Deployment to Railway

### Option 1: Deploy from GitHub (Recommended)

1. **Push your code to GitHub** (if not already done):
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/Charlescifix/uid.git
git push -u origin main
```

2. **Connect to Railway**:
   - Go to [railway.app](https://railway.app)
   - Sign in with GitHub
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository: `Charlescifix/uid`
   - Railway will automatically detect the configuration

3. **Configure Environment** (if needed):
   - Go to your project settings
   - Add any environment variables under "Variables"
   - Railway will automatically assign a PORT

4. **Deploy**:
   - Railway will automatically build and deploy
   - You'll get a public URL like: `https://uid-production.up.railway.app`

### Option 2: Deploy with Railway CLI

1. **Install Railway CLI**:
```bash
npm install -g @railway/cli
```

2. **Login to Railway**:
```bash
railway login
```

3. **Initialize project**:
```bash
railway init
```

4. **Deploy**:
```bash
railway up
```

### Post-Deployment

1. **Custom Domain** (optional):
   - In Railway dashboard, go to Settings
   - Click "Domains"
   - Add your custom domain
   - Update DNS records as instructed

2. **Environment Variables**:
   - Set `NODE_ENV=production`
   - Add any API keys or secrets needed

3. **Monitor**:
   - Check logs in Railway dashboard
   - Use the `/health` endpoint to verify deployment

## Project Structure

```
uid/
├── index.html          # Main application file
├── server.js           # Express server
├── package.json        # Dependencies and scripts
├── railway.json        # Railway configuration
├── .gitignore         # Git ignore rules
├── men.png            # Hero image
├── uid_logo.png       # Organization logo
└── README.md          # This file
```

## API Endpoints

- `GET /` - Main application
- `POST /api/intake` - Form submission endpoint
- `GET /health` - Health check endpoint

## Environment Variables

- `PORT` - Server port (automatically set by Railway)
- `NODE_ENV` - Environment (development/production)

## Support

For issues or questions:
- Email: info@theuid.uk
- GitHub Issues: https://github.com/Charlescifix/uid/issues

## License

© 2025 Unity in Diversity CIC. All rights reserved.
Company number: 15515502
Registered in England & Wales

---

Powered by [Gen3block AI](https://www.gen3block.com)

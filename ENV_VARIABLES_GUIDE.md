# Environment Variables Guide for Production

## Overview
This document lists all required environment variables that must be configured in your Vercel deployment for the application to function properly.

## Required Environment Variables

### Authentication (NextAuth)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID from Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret from Google Cloud Console
- `NEXTAUTH_URL` - Base URL of your application (e.g., https://yourdomain.com)
- `NEXTAUTH_SECRET` - Secret key for NextAuth sessions (generate with: `openssl rand -base64 32`)

### Backend (Convex)
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL (public - can be exposed)
- `CONVEX_DEPLOYMENT` - Internal Convex deployment identifier

### Sentry Error Tracking
- `NEXT_PUBLIC_SENTRY_DSN` - Public Sentry DSN for client-side error reporting
- `SENTRY_AUTH_TOKEN` - Sentry auth token (for source maps upload in CI/CD)

### External APIs
- `NEXT_PUBLIC_GROQ_API_KEY` - Groq API key for AI features
- `STRIPE_SECRET_KEY` - Stripe secret key for payment processing
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `CLOUDINARY_API_URL` - Cloudinary API URL for image uploads
- `OPENAI_API_KEY` - OpenAI API key for AI features

### Analytics & Monitoring
- `NEXT_PUBLIC_GA_ID` - Google Analytics ID (if using)
- `NEXT_PUBLIC_APP_VERSION` - Application version for Sentry release tracking

## Content Security Policy (CSP)

The CSP is configured in `next.config.js` and allows connections to:
- ✅ `https://*.convex.cloud` - Convex backend
- ✅ `https://*.googleapis.com` - Google services (OAuth, Fonts)
- ✅ `https://api.groq.com` - Groq AI API
- ✅ `https://api.openai.com` - OpenAI API
- ✅ `https://api.stripe.com` - Stripe API
- ✅ `https://sentry.io` - Sentry error tracking
- ✅ `https://*.sentry.io` - Sentry subdomains
- ✅ `https://*.ingest.sentry.io` - Sentry ingest endpoints
- ✅ `https://fonts.googleapis.com` - Google Fonts
- ✅ `https://cdn.jsdelivr.net` - CDN for scripts
- ✅ `https://challenges.cloudflare.com` - Cloudflare challenges

## Vercel Configuration Steps

1. Go to your Vercel project dashboard
2. Click "Settings" → "Environment Variables"
3. Add each variable with its value
4. Make sure to distinguish between:
   - **Production** - Variables used in live deployment
   - **Preview** - Variables used in preview deployments
   - **Development** - Variables used in local development

## Local Development Setup

Create a `.env.local` file in your project root:

```env
# NextAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_generated_secret

# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=your_deployment_id

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id
SENTRY_AUTH_TOKEN=your_sentry_token

# APIs
NEXT_PUBLIC_GROQ_API_KEY=your_groq_key
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=your_webhook_secret
CLOUDINARY_API_URL=your_cloudinary_url
OPENAI_API_KEY=your_openai_key

# Version
NEXT_PUBLIC_APP_VERSION=1.0.0
```

**⚠️ Security Note:** Never commit `.env.local` to version control. Add it to `.gitignore`.

## Troubleshooting Common Issues

### CSP Violations Blocking Sentry
- **Error**: "Refused to connect ... violates Content Security Policy"
- **Solution**: Check that environment is production and CSP headers are correctly applied
- The `next.config.js` now includes proper CSP rules for Sentry

### 500 Errors on `/api/auth/session`
- **Cause**: Missing or invalid `GOOGLE_CLIENT_SECRET` or `NEXTAUTH_SECRET`
- **Solution**: Verify env variables are set in Vercel dashboard

### 500 Errors on `/api/stripe/run-script`
- **Cause**: Usually missing environment variables or npm scripts not available
- **Solution**: Ensure all required API keys are configured

### Stripe Scripts Not Working in Production
- **Cause**: `.env.local` file doesn't exist in production environment
- **Solution**: All Stripe scripts now check for existing env vars before attempting to load `.env.local`

## Recent Changes (Session: loader-fixes)

### Fixed Issues
1. ✅ Removed duplicate `headers()` function in `next.config.js` that was overwriting CSP rules
2. ✅ Enhanced CSP to explicitly allow Sentry ingest endpoints (`https://*.ingest.sentry.io`)
3. ✅ All Stripe scripts updated to handle missing `.env.local` gracefully in production

### Modified Files
- `next.config.js` - Fixed CSP configuration and removed duplicates
- Stripe scripts in `/scripts` - Updated to check for existing env vars first

## Verification Checklist

- [ ] All environment variables set in Vercel dashboard
- [ ] Sentry getting error reports (check Sentry.io Issues page)
- [ ] Google OAuth login working
- [ ] Stripe endpoints accessible and functional
- [ ] No CSP violations in browser console
- [ ] `/api/auth/session` endpoint returning 200 (not 500)
- [ ] `/api/stripe/run-script` endpoint responding correctly


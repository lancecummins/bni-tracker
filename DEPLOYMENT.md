# BNI Tracker - Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Firebase Project**: Ensure you have a Firebase project with Firestore and Authentication enabled
3. **GitHub Repository**: Your code should be in a GitHub repository (recommended)

## Deployment Steps

### 1. Connect to Vercel

**Option A: GitHub Integration (Recommended)**
1. Connect your GitHub repository to Vercel
2. Import the project from GitHub
3. Vercel will automatically detect it as a Next.js project

**Option B: Vercel CLI**
```bash
npm i -g vercel
vercel login
vercel --prod
```

### 2. Configure Environment Variables

In the Vercel Dashboard, go to your project → Settings → Environment Variables and add the following:

#### Firebase Client Configuration (Required)
- `NEXT_PUBLIC_FIREBASE_API_KEY`: Your Firebase API key
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: Your Firebase auth domain (e.g., `your-project.firebaseapp.com`)
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: Your Firebase project ID
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: Your Firebase storage bucket (e.g., `your-project.firebasestorage.app`)
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: Your Firebase messaging sender ID
- `NEXT_PUBLIC_FIREBASE_APP_ID`: Your Firebase app ID

#### Firebase Admin SDK Configuration (Required for API routes)
- `FIREBASE_ADMIN_PROJECT_ID`: Your Firebase project ID (same as above)
- `FIREBASE_ADMIN_CLIENT_EMAIL`: Service account email (from Firebase console)
- `FIREBASE_ADMIN_PRIVATE_KEY`: Service account private key (from Firebase console)

### 3. Get Firebase Credentials

#### Client Configuration
1. Go to Firebase Console → Project Settings → General
2. Find your app configuration under "Your apps"
3. Copy the config object values

#### Admin SDK Configuration
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Extract the following values:
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY`

**Important**: For the private key, copy the entire string including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` headers.

### 4. Deploy

Once environment variables are configured:
1. Push your code to GitHub (if using GitHub integration)
2. Vercel will automatically deploy
3. Or run `vercel --prod` if using CLI

## Firebase Security Rules

Ensure your Firestore security rules are properly configured for production:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Add your security rules here
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Domain Configuration

### Custom Domain (Optional)
1. In Vercel Dashboard → Domains
2. Add your custom domain
3. Update DNS records as instructed by Vercel

### Firebase Authentication Domain
1. Go to Firebase Console → Authentication → Settings
2. Add your Vercel domain to "Authorized domains"
3. Include both the Vercel subdomain (e.g., `your-app.vercel.app`) and any custom domains

## Environment Variables Summary

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key | `AIzaSyC...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `bni-game.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | `bni-game` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | `bni-game.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | `539367129213` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | `1:539367...` |
| `FIREBASE_ADMIN_PROJECT_ID` | Admin project ID | `bni-game` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Service account email | `firebase-adminsdk-...@bni-game.iam.gserviceaccount.com` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Service account private key | `-----BEGIN PRIVATE KEY-----\n...` |

## Build Configuration

The project includes optimized configuration for Vercel:

- **`vercel.json`**: Deployment configuration
- **`next.config.ts`**: Next.js configuration with Vercel optimizations
- **`.vercelignore`**: Files to exclude from deployment

## Troubleshooting

### Build Fails
- Check that all environment variables are set correctly
- Ensure Firebase credentials are valid
- Review build logs in Vercel dashboard

### Authentication Issues
- Verify that your Vercel domain is added to Firebase authorized domains
- Check that Firebase Auth is enabled in your Firebase project
- Ensure environment variables don't have extra quotes or spaces

### API Routes Not Working
- Verify Firebase Admin SDK environment variables are set
- Check that the service account has proper permissions
- Review function logs in Vercel dashboard

### Performance Optimization
- The app uses Turbopack for faster builds
- ESLint and TypeScript errors are ignored during build (configured in `next.config.ts`)
- Images from dicebear.com are pre-configured in the domains list

## Post-Deployment Checklist

- [ ] Environment variables are set
- [ ] Firebase authorized domains include Vercel domain
- [ ] Authentication works
- [ ] Database reads/writes work
- [ ] API routes function properly
- [ ] All features tested in production environment

## Support

For deployment issues:
1. Check Vercel build logs
2. Review Firebase console for authentication/database errors
3. Verify all environment variables match the required format
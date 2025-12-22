# Firebase Deployment Guide

This document explains how to deploy Firestore security rules and indexes for the BNI Tracker application.

## Prerequisites

1. Install Firebase CLI if you haven't already:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in this project (if not already done):
   ```bash
   firebase init
   ```
   - Select "Firestore" when prompted
   - Choose your existing Firebase project
   - Accept the default files (firestore.rules and firestore.indexes.json)

## Deploying Security Rules

To deploy the Firestore security rules to production:

```bash
firebase deploy --only firestore:rules
```

This will upload the `firestore.rules` file to your Firebase project.

### Testing Rules Locally

You can test security rules locally using the Firebase Emulator:

```bash
firebase emulators:start --only firestore
```

## Deploying Indexes

To deploy the Firestore composite indexes:

```bash
firebase deploy --only firestore:indexes
```

This will create the necessary composite indexes defined in `firestore.indexes.json`.

**Important:** Index creation can take several minutes. You can monitor progress in the Firebase Console under:
`Firestore Database > Indexes`

## Deploy Both Rules and Indexes

To deploy both at once:

```bash
firebase deploy --only firestore
```

## Required Indexes

The following composite indexes are required for the application to work properly:

### 1. Drafts by Season
- **Collection:** `drafts`
- **Fields:**
  - `seasonId` (Ascending)
  - `createdAt` (Descending)
- **Used in:** `draftService.getBySeasonId()` and `draftService.subscribeBySeasonId()`

### 2. Sessions by Season
- **Collection:** `sessions`
- **Fields:**
  - `seasonId` (Ascending)
  - `date` (Descending)
- **Used in:** Session listing and filtering by season

### 3. Scores by Season and User
- **Collection:** `scores`
- **Fields:**
  - `seasonId` (Ascending)
  - `userId` (Ascending)
- **Used in:** User statistics and leaderboards

### 4. Scores by Session and User
- **Collection:** `scores`
- **Fields:**
  - `sessionId` (Ascending)
  - `userId` (Ascending)
- **Used in:** Session-specific scoring

### 5. Teams by Season
- **Collection:** `teams`
- **Fields:**
  - `seasonId` (Ascending)
  - `createdAt` (Ascending)
- **Used in:** Team listings and draft order calculation

## Security Rules Overview

The `firestore.rules` file contains security rules for all collections:

- **Users:** Read-only for authenticated users, write-only for admins
- **Teams:** Read-only for authenticated users, write-only for admins
- **Seasons:** Read-only for authenticated users, write-only for admins
- **Sessions:** Read-only for authenticated users, write-only for admins
- **Scores:** Read for all authenticated, write for admins and team leaders (draft scores only)
- **Settings:** Read-only for authenticated users, write-only for admins
- **Drafts:** Read for all authenticated (so team leaders can watch live), write for admins and team leaders (when it's their turn)

### Draft Security Rules Details

The draft collection has special rules:
- Anyone authenticated can **read** (allows all team leaders to watch draft live)
- Only admins can **create** drafts
- Admins can always **update** drafts
- Team leaders can **update** drafts ONLY when:
  - They are listed in the draft's teamLeaders array
  - They are only adding one pick at a time
  - The currentPickNumber increments by exactly 1
  - The new pick's pickedBy field matches their user ID
- Only admins can **delete** drafts (for cancellation/reset)

## Troubleshooting

### Error: "The query requires an index"

If you see this error in production, it means an index is missing. The error message will include a link to create the index in the Firebase Console. Alternatively, you can run:

```bash
firebase deploy --only firestore:indexes
```

### Error: "Missing or insufficient permissions"

This means the security rules are blocking the operation. Check:
1. The user is authenticated
2. The user has the correct role (admin, team-leader, member)
3. The operation matches the allowed rules in `firestore.rules`

### Index Build Taking Too Long

Large collections can take time to index. You can check progress at:
`Firebase Console > Firestore Database > Indexes`

Indexes show statuses:
- **Building** - Still creating the index
- **Enabled** - Index is ready to use
- **Error** - Something went wrong

## Production Checklist

Before going to production, ensure:

- [ ] Security rules deployed: `firebase deploy --only firestore:rules`
- [ ] Indexes deployed: `firebase deploy --only firestore:indexes`
- [ ] All indexes show "Enabled" status in Firebase Console
- [ ] Test authentication works in production
- [ ] Test that admins can perform admin actions
- [ ] Test that team leaders can only pick when it's their turn
- [ ] Test that non-authenticated users cannot access data

## Development vs Production

In development, you may have security rules disabled or set to allow all reads/writes. Make sure to deploy the production rules before launch.

You can check current rules in Firebase Console:
`Firestore Database > Rules`

## Backup Before Deployment

Always create a backup before deploying new security rules:

```bash
# Export all Firestore data
firebase firestore:export gs://YOUR_BUCKET_NAME/backups/$(date +%Y%m%d)
```

Or use the built-in backup page at `/admin/backup` in the application.

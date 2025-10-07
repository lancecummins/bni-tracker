# BNI Competition Tracker

A real-time scoring and leaderboard application for BNI team competitions with live updates, sound effects, and visual celebrations.

## Features

- **Real-time Updates**: All data syncs instantly through Firebase
- **Live Scoring**: Enter scores person-by-person during meetings
- **Team Competition**: Track team standings and weekly winners
- **Individual Leaderboard**: F1-style individual rankings
- **TV Display View**: Full-screen optimized display with animations
- **Sound Effects**: Audio feedback for score updates and lead changes
- **Visual Effects**: Confetti animations for winning teams
- **Session Management**: Open/close weekly scoring sessions
- **Mock Data Seeding**: Easily populate database with test data

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Database**: Firebase Firestore (real-time)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **State Management**: Zustand
- **Deployment**: Vercel

## Getting Started

### 1. Prerequisites

- Node.js 18+ installed
- Firebase account
- npm or yarn

### 2. Installation

```bash
cd bni-tracker
npm install
```

### 3. Firebase Setup

1. Create a new Firebase project at https://console.firebase.google.com
2. Enable Authentication (Email/Password)
3. Enable Firestore Database
4. Enable Storage
5. Get your Firebase configuration from Project Settings

### 4. Environment Configuration

Copy the example env file and add your Firebase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Firebase configuration:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# For server-side operations
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account_email
FIREBASE_ADMIN_PRIVATE_KEY="your_private_key"
```

### 5. Seed Database with Mock Data

To populate your Firebase database with test data:

```bash
# Start the development server
npm run dev

# In another terminal, seed the database (server must be running)
curl -X POST http://localhost:3000/api/seed?secret=development-seed-key \
  -H "Content-Type: application/json" \
  -d '{"userCount": 20, "teamCount": 4, "weeksToGenerate": 3}'
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the admin dashboard.

## Application Structure

### Routes

- `/` - Redirects to admin dashboard
- `/admin/dashboard` - Admin control center
- `/admin/scoring` - Live score entry interface
- `/admin/sessions` - Session history
- `/admin/users` - User management
- `/admin/teams` - Team management
- `/display` - TV display view (open in separate window/tab)

### Data Model

#### Users
- firstName, lastName, email
- avatarUrl
- teamId (optional)
- role (admin/member)
- isActive

#### Teams
- name, color
- memberIds[]
- seasonId
- totalPoints, weeklyWins

#### Sessions (Weekly Meetings)
- weekNumber
- date
- status (draft/open/closed)
- seasonId

#### Scores
- userId, sessionId, teamId
- metrics (attendance, 121s, referrals, etc.)
- totalPoints

### Point System

Default point values (configurable per season):
- Attendance: 10 points
- 1-2-1s: 15 points
- Referrals: 25 points
- TYFCB: 20 points
- Visitors: 15 points
- RTIB: 30 points

## Usage Guide

### Admin Workflow

1. **Open a Session**
   - Go to Admin Dashboard
   - Click "Open Session" to start weekly scoring

2. **Enter Scores**
   - Navigate to Live Scoring
   - Enter metrics for each member
   - Scores auto-save individually or save all at once

3. **Monitor Display**
   - Open `/display` on TV/projector
   - Real-time updates appear automatically
   - Teams and individuals ranked live

4. **Close Session**
   - Return to Dashboard
   - Click "Close Session" when complete
   - Data locks for historical record

### TV Display Features

- **Team Scoreboard**: Shows team rankings with total points
- **Individual Leaderboard**: Top 10 performers
- **Live Animations**: Smooth transitions on updates
- **Sound Effects**: Audio cues for changes (add sound files to `/public/sounds/`)
- **Confetti**: Celebrates winning team

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

```bash
vercel --prod
```

## Sound Files

Add these sound files to `/public/sounds/`:
- `score-update.mp3` - When any score updates
- `lead-change.mp3` - When leaderboard position changes
- `achievement.mp3` - Special achievements
- `victory.mp3` - Team victory celebration

## Development Tips

- Use Firebase Emulator Suite for local development
- Monitor Firestore reads/writes in Firebase Console
- Test with different screen sizes for TV display
- Use React DevTools to debug real-time updates

## Future Enhancements

- Authentication system
- Historical analytics
- Export to CSV
- Achievement badges
- Mobile app for score entry
- Seasonal statistics
- Email notifications

## Troubleshooting

### No Real-time Updates
- Check Firebase configuration
- Verify Firestore rules allow read/write
- Check browser console for errors

### Sound Not Playing
- Add sound files to `/public/sounds/`
- Check browser autoplay policies
- User interaction may be required first

### Display Issues
- Clear browser cache
- Check for conflicting CSS
- Verify Tailwind configuration

## License

Private project for BNI use.
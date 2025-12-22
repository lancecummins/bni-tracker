import { Timestamp } from 'firebase/firestore';
import {
  User,
  Team,
  Season,
  Session,
  Score,
  Achievement,
  ScoreMetrics,
  PointValues,
} from '@/lib/types';

// Lists of realistic names for mock data
const firstNames = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Helen', 'Donald', 'Sandra', 'Mark', 'Donna',
  'Paul', 'Carol', 'Steven', 'Ruth', 'Andrew', 'Sharon', 'Kenneth', 'Michelle'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris',
  'Clark', 'Lewis', 'Robinson', 'Walker', 'Hall', 'Allen', 'Young', 'King'
];

const teamNames = [
  'Thunder', 'Lightning', 'Phoenix', 'Dragons', 'Titans', 'Mavericks',
  'Spartans', 'Vikings', 'Eagles', 'Warriors'
];

const teamColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#9B59B6', '#3498DB', '#E74C3C', '#2ECC71', '#F39C12'
];

const avatarUrls = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=',
  'https://api.dicebear.com/7.x/bottts/svg?seed=',
  'https://api.dicebear.com/7.x/personas/svg?seed=',
];

// Helper function to generate random number in range
const randomInRange = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Helper function to get random element from array
const randomFromArray = <T>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)];
};

// Generate a mock user
export const generateMockUser = (index: number, role: 'admin' | 'team-leader' | 'member' = 'member'): User => {
  const firstName = randomFromArray(firstNames);
  const lastName = randomFromArray(lastNames);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@example.com`;
  const avatarType = randomFromArray(avatarUrls);

  return {
    email,
    firstName,
    lastName,
    avatarUrl: `${avatarType}${firstName}${lastName}${index}`,
    teamId: null,
    role,
    createdAt: Timestamp.fromDate(new Date(Date.now() - randomInRange(0, 90) * 24 * 60 * 60 * 1000)),
    isActive: true,
  };
};

// Generate a mock team
export const generateMockTeam = (index: number, seasonId: string): Team => {
  return {
    name: `Team ${teamNames[index % teamNames.length]}`,
    color: teamColors[index % teamColors.length],
    memberIds: [],
    seasonId,
    totalPoints: 0,
    weeklyWins: 0,
    createdAt: Timestamp.now(),
  };
};

// Generate a mock season
export const generateMockSeason = (isActive: boolean = true): Season => {
  const startDate = isActive
    ? new Date(Date.now() - 21 * 24 * 60 * 60 * 1000) // 3 weeks ago
    : new Date(Date.now() - 120 * 24 * 60 * 60 * 1000); // 4 months ago

  const endDate = new Date(startDate.getTime() + 12 * 7 * 24 * 60 * 60 * 1000); // 12 weeks

  const pointValues: PointValues = {
    attendance: 10,
    one21s: 15,
    referrals: 25,
    tyfcb: 20,
    visitors: 15,
    ceu: 10,
  };

  return {
    name: isActive ? 'Winter 2025' : 'Fall 2024',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(endDate),
    weekCount: 12,
    currentWeek: isActive ? 3 : 12,
    isActive,
    pointValues,
    createdAt: Timestamp.fromDate(startDate),
  };
};

// Generate a mock session
export const generateMockSession = (
  seasonId: string,
  weekNumber: number,
  daysAgo: number = 0
): Session => {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const isCurrentWeek = daysAgo === 0;

  return {
    seasonId,
    weekNumber,
    date: Timestamp.fromDate(date),
    status: isCurrentWeek ? 'draft' : 'closed',
    createdBy: 'admin-user-id',
    createdAt: Timestamp.fromDate(date),
    closedAt: isCurrentWeek ? null : Timestamp.fromDate(new Date(date.getTime() + 2 * 60 * 60 * 1000)),
  };
};

// Generate realistic score metrics
export const generateMockMetrics = (weekNumber: number, userPerformance: number = 0.5): ScoreMetrics => {
  // userPerformance: 0-1, where 1 is best performer
  const baseMultiplier = 0.5 + userPerformance * 0.5;

  return {
    attendance: Math.random() > 0.1 ? 1 : 0, // 90% attendance rate
    one21s: Math.floor(randomInRange(0, 3) * baseMultiplier),
    referrals: Math.floor(randomInRange(0, 5) * baseMultiplier),
    tyfcb: Math.floor(randomInRange(0, 4) * baseMultiplier),
    visitors: Math.floor(randomInRange(0, 3) * baseMultiplier),
    ceu: Math.floor(randomInRange(0, 2) * baseMultiplier),
  };
};

// Generate a mock score
export const generateMockScore = (
  userId: string,
  sessionId: string,
  seasonId: string,
  teamId: string,
  pointValues: PointValues,
  weekNumber: number,
  userPerformance: number = 0.5
): Score => {
  const metrics = generateMockMetrics(weekNumber, userPerformance);

  const totalPoints =
    metrics.attendance * pointValues.attendance +
    metrics.one21s * pointValues.one21s +
    metrics.referrals * pointValues.referrals +
    metrics.tyfcb * pointValues.tyfcb +
    metrics.visitors * pointValues.visitors;

  return {
    userId,
    sessionId,
    seasonId,
    teamId,
    metrics,
    totalPoints,
    isDraft: false, // Mark as published by default for mock data
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
};

// Generate mock achievements
export const generateMockAchievements = (): Achievement[] => {
  return [
    {
      name: 'Top Performer',
      description: 'Highest weekly score',
      type: 'weekly',
      awardedTo: [],
    },
    {
      name: 'Referral Master',
      description: 'Most referrals in a week',
      type: 'weekly',
      awardedTo: [],
    },
    {
      name: 'Perfect Attendance',
      description: 'Never missed a meeting this season',
      type: 'seasonal',
      awardedTo: [],
    },
    {
      name: 'Team MVP',
      description: 'Highest contributor to team success',
      type: 'seasonal',
      awardedTo: [],
    },
    {
      name: 'Rising Star',
      description: 'Most improved member',
      type: 'special',
      awardedTo: [],
    },
  ];
};

// Generate a complete dataset for testing
export interface MockDataset {
  users: User[];
  teams: Team[];
  season: Season;
  sessions: Session[];
  scores: Score[];
  achievements: Achievement[];
}

export const generateCompleteDataset = (
  userCount: number = 20,
  teamCount: number = 4,
  weeksToGenerate: number = 3
): MockDataset => {
  // Generate season
  const season = generateMockSeason(true);

  // Generate teams
  const teams = Array.from({ length: teamCount }, (_, i) =>
    generateMockTeam(i, 'season-id')
  );

  // Generate users (1 admin + team leaders + members)
  const users: User[] = [
    generateMockUser(0, 'admin'), // Admin user
  ];

  // Generate team leaders (one per team)
  const teamLeaders = Array.from({ length: teamCount }, (_, i) =>
    generateMockUser(i + 1, 'team-leader')
  );
  users.push(...teamLeaders);

  // Generate regular members
  const memberCount = userCount - 1 - teamCount; // Subtract admin and team leaders
  const members = Array.from({ length: memberCount }, (_, i) =>
    generateMockUser(i + teamCount + 1, 'member')
  );
  users.push(...members);

  // Assign team leaders to teams
  teamLeaders.forEach((leader, index) => {
    leader.teamId = `team-${index}`;
    teams[index].teamLeaderId = `user-${index + 1}`;
    teams[index].memberIds.push(`user-${index + 1}`);
  });

  // Assign members to teams
  members.forEach((member, index) => {
    const teamIndex = index % teamCount;
    member.teamId = `team-${teamIndex}`;
    teams[teamIndex].memberIds.push(`user-${index + teamCount + 1}`);
  });

  // Generate sessions for past weeks
  const sessions = Array.from({ length: weeksToGenerate }, (_, i) =>
    generateMockSession('season-id', i + 1, (weeksToGenerate - i - 1) * 7)
  );

  // Generate scores for each session (only for members, not admin or team leaders)
  const scores: Score[] = [];
  sessions.forEach((session, sessionIndex) => {
    users.forEach((user, userIndex) => {
      // Only generate scores for regular members
      if (user.role !== 'member') return;

      // Vary performance by user to create realistic leaderboard
      const userPerformance = (userIndex / userCount) + Math.random() * 0.3;

      scores.push(
        generateMockScore(
          `user-${userIndex}`,
          `session-${sessionIndex}`,
          'season-id',
          user.teamId!,
          season.pointValues,
          session.weekNumber,
          Math.min(userPerformance, 1)
        )
      );
    });
  });

  // Generate achievements
  const achievements = generateMockAchievements();

  return {
    users,
    teams,
    season,
    sessions,
    scores,
    achievements,
  };
};
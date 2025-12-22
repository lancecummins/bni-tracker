import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'team-leader' | 'member';

export interface User {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  teamId?: string | null;
  role: UserRole;
  createdAt: Timestamp;
  isActive: boolean;
}

export interface Team {
  id?: string;
  name: string;
  slug?: string; // URL-friendly identifier for team scoring pages
  color: string;
  logoUrl?: string; // URL to team logo image
  captainId?: string;
  teamLeaderId?: string; // User ID of the team leader who can enter scores
  memberIds: string[];
  seasonId: string;
  totalPoints: number;
  weeklyWins: number;
  createdAt: Timestamp;
}

export interface Season {
  id?: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  weekCount: number;
  currentWeek: number;
  isActive: boolean;
  pointValues: PointValues;
  bonusValues?: BonusValues;
  createdAt: Timestamp;
}

export interface PointValues {
  attendance: number;
  one21s: number;
  referrals: number;
  tyfcb: number;
  visitors: number;
}

export interface BonusValues {
  attendance: number;
  one21s: number;
  referrals: number;
  tyfcb: number;
  visitors: number;
}

export type SessionStatus = 'draft' | 'open' | 'closed';

export interface TeamCustomBonus {
  teamId: string;
  bonusId: string;
  bonusName: string;
  points: number;
  awardedBy: string;
  awardedAt: Timestamp;
}

export interface Session {
  id?: string;
  name?: string;
  seasonId: string;
  weekNumber: number;
  date: Timestamp;
  status: SessionStatus;
  createdBy: string;
  createdAt: Timestamp;
  closedAt?: Timestamp | null;
  isArchived?: boolean;
  teamCustomBonuses?: TeamCustomBonus[];
  excludedUserIds?: string[]; // Users excluded from "All In" bonus calculations for this session
}

export interface ScoreMetrics {
  attendance: number;
  one21s: number;
  referrals: number;
  tyfcb: number;
  visitors: number;
}

export interface CustomBonus {
  id?: string;
  name: string;
  points: number;
  isArchived?: boolean;
  createdAt?: Timestamp;
}

export interface AwardedCustomBonus {
  bonusId: string;
  bonusName: string;
  points: number;
  awardedBy: string;
  awardedAt: Timestamp;
}

export interface Score {
  id?: string;
  userId: string;
  sessionId: string;
  seasonId: string;
  teamId?: string;
  metrics: ScoreMetrics;
  totalPoints: number;
  isDraft: boolean; // true = entered by team leader, false = published by admin
  enteredBy?: string; // ID of team leader who entered the score
  publishedBy?: string; // ID of admin who published
  publishedAt?: Timestamp;
  customBonuses?: AwardedCustomBonus[]; // Custom bonuses awarded to this individual
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AchievementType = 'weekly' | 'seasonal' | 'special';

export interface Achievement {
  id?: string;
  name: string;
  description: string;
  iconUrl?: string;
  type: AchievementType;
  awardedTo: AwardedAchievement[];
}

export interface AwardedAchievement {
  userId: string;
  sessionId?: string;
  dateAwarded: Timestamp;
}

// Aggregated data types for display
export interface LeaderboardEntry {
  userId: string;
  user: User;
  teamId?: string;
  team?: Team;
  weeklyPoints: number;
  totalPoints: number;
  metrics: ScoreMetrics;
  position: number;
  previousPosition?: number;
}

export interface TeamStandings {
  teamId: string;
  team: Team;
  weeklyPoints: number;
  totalPoints: number;
  weeklyWins: number;
  members: LeaderboardEntry[];
  bonusPoints?: number;
  bonusCategories?: string[];
  customBonuses?: { bonusName: string; points: number; teamId: string }[];
  position: number;
}

export interface Settings {
  id?: string;
  pointValues: PointValues;
  bonusValues?: BonusValues;
  customBonuses?: CustomBonus[]; // Custom bonuses that can be awarded
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type DraftStatus = 'setup' | 'in_progress' | 'completed';

export interface DraftPick {
  userId: string;
  teamId: string;
  round: number;
  pickNumber: number;
  pickedBy: string; // User ID of who made the pick (team leader or admin)
  timestamp: Timestamp;
}

export interface Draft {
  id?: string;
  seasonId: string;
  status: DraftStatus;
  teamLeaders: {
    teamId: string;
    userId: string;
    draftPosition: number; // 1-4, based on previous season standings
  }[];
  picks: DraftPick[];
  currentPickNumber: number; // Overall pick number (0-indexed)
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
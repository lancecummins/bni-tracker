// Static data hooks that fetch once instead of subscribing
import { useState, useEffect, useRef } from 'react';
import { User, Team, Settings, Session, Score } from '@/lib/types';
import { userService, teamService, settingsService, sessionService, scoreService } from '@/lib/firebase/services';

// Global refresh counter to force re-fetching
let globalRefreshCounter = 0;
const refreshListeners = new Set<() => void>();

// Simple in-memory cache with TTL
class DataCache<T> {
  private data: T | null = null;
  private timestamp: number = 0;
  private ttl: number;

  constructor(ttlMinutes: number = 5) {
    this.ttl = ttlMinutes * 60 * 1000; // Convert to milliseconds
  }

  set(data: T) {
    this.data = data;
    this.timestamp = Date.now();
  }

  get(): T | null {
    if (!this.data) return null;
    if (Date.now() - this.timestamp > this.ttl) {
      this.data = null;
      return null;
    }
    return this.data;
  }

  clear() {
    this.data = null;
    this.timestamp = 0;
  }
}

// Create cache instances
const userCache = new DataCache<User[]>(10); // 10 minutes
const teamCache = new DataCache<Team[]>(10); // 10 minutes
const settingsCache = new DataCache<Settings>(10); // 10 minutes
const sessionCache = new DataCache<Session>(5); // 5 minutes
const scoreCache = new Map<string, DataCache<Score[]>>(); // Per-session cache

export function useStaticUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(globalRefreshCounter);

  // Subscribe to refresh events
  useEffect(() => {
    const handleRefresh = () => {
      setRefreshCounter(globalRefreshCounter);
    };
    refreshListeners.add(handleRefresh);
    return () => {
      refreshListeners.delete(handleRefresh);
    };
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        // Check cache first
        const cached = userCache.get();
        if (cached) {
          setUsers(cached);
          setLoading(false);
          return;
        }

        const data = await userService.getAll();
        setUsers(data);
        userCache.set(data);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [refreshCounter]);

  return { users, loading };
}

export function useStaticTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(globalRefreshCounter);

  // Subscribe to refresh events
  useEffect(() => {
    const handleRefresh = () => {
      setRefreshCounter(globalRefreshCounter);
    };
    refreshListeners.add(handleRefresh);
    return () => {
      refreshListeners.delete(handleRefresh);
    };
  }, []);

  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      try {
        // Check cache first
        const cached = teamCache.get();
        if (cached) {
          setTeams(cached);
          setLoading(false);
          return;
        }

        const data = await teamService.getAll();
        setTeams(data);
        teamCache.set(data);
      } catch (error) {
        console.error('Error fetching teams:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, [refreshCounter]);

  return { teams, loading };
}

export function useStaticSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Check cache first
        const cached = settingsCache.get();
        if (cached) {
          setSettings(cached);
          setLoading(false);
          return;
        }

        const data = await settingsService.get();
        setSettings(data);
        if (data) settingsCache.set(data);
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  return { settings, loading };
}

export function useStaticActiveSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        // Check cache first
        const cached = sessionCache.get();
        if (cached) {
          setSession(cached);
          setLoading(false);
          return;
        }

        const data = await sessionService.getActive();
        setSession(data);
        if (data) sessionCache.set(data);
      } catch (error) {
        console.error('Error fetching active session:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, []);

  return { session, loading };
}

// New static hook for session scores
export function useStaticSessionScores(sessionId: string | null) {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setScores([]);
      setLoading(false);
      return;
    }

    const fetchScores = async () => {
      try {
        // Check cache first
        if (!scoreCache.has(sessionId)) {
          scoreCache.set(sessionId, new DataCache<Score[]>(5));
        }
        const cache = scoreCache.get(sessionId)!;
        const cached = cache.get();
        if (cached) {
          setScores(cached);
          setLoading(false);
          return;
        }

        const data = await scoreService.getBySession(sessionId);
        setScores(data);
        cache.set(data);
      } catch (error) {
        console.error('Error fetching scores:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchScores();
  }, [sessionId]);

  return { scores, loading };
}

// New static hook for all sessions in a season
export function useStaticSeasonSessions(seasonId: string | null) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!seasonId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const fetchSessions = async () => {
      try {
        const data = await sessionService.getBySeason(seasonId);
        setSessions(data);
      } catch (error) {
        console.error('Error fetching sessions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [seasonId]);

  return { sessions, loading };
}

// Function to clear all caches (useful when data is updated)
export function clearStaticDataCache() {
  userCache.clear();
  teamCache.clear();
  settingsCache.clear();
  sessionCache.clear();
  scoreCache.clear();

  // Increment refresh counter and notify all listeners
  globalRefreshCounter++;
  refreshListeners.forEach(listener => listener());
}
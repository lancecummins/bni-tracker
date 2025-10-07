import { useState, useEffect } from 'react';
import { Session } from '@/lib/types';
import { sessionService } from '@/lib/firebase/services';

export function useActiveSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = sessionService.subscribeToActive((data) => {
      setSession(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { session, loading, error };
}

export function useSeasonSessions(seasonId: string | null) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!seasonId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = sessionService.subscribeToSeason(seasonId, (data) => {
      setSessions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [seasonId]);

  return { sessions, loading, error };
}

export function useAllSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = sessionService.subscribeToAll((data) => {
      setSessions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { sessions, loading, error };
}
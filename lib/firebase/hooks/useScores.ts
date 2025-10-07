import { useState, useEffect } from 'react';
import { Score } from '@/lib/types';
import { scoreService } from '@/lib/firebase/services';

export function useSessionScores(sessionId: string | null) {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setScores([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = scoreService.subscribeToSession(sessionId, (data) => {
      setScores(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [sessionId]);

  return { scores, loading, error };
}

export function useUserScores(userId: string | null) {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setScores([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = scoreService.subscribeToUser(userId, (data) => {
      setScores(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  return { scores, loading, error };
}
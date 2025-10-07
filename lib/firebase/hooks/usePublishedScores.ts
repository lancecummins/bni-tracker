import { useState, useEffect } from 'react';
import { scoreService } from '../services';
import { Score } from '@/lib/types';

export function usePublishedSessionScores(sessionId: string | null) {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setScores([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Subscribe to published scores only
    const unsubscribe = scoreService.subscribeToPublishedSession(sessionId, (publishedScores) => {
      setScores(publishedScores);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [sessionId]);

  return { scores, loading };
}
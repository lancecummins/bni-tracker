import { useState, useEffect } from 'react';
import { Season } from '@/lib/types';
import { seasonService } from '../services/seasonService';

export function useSeasons() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = seasonService.subscribeToAll((data) => {
      setSeasons(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { seasons, loading, error };
}

export function useActiveSeason() {
  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = seasonService.subscribeToActive((data) => {
      setSeason(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { season, loading, error };
}

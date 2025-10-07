import { useState, useEffect } from 'react';
import { Team } from '@/lib/types';
import { teamService } from '@/lib/firebase/services';

export function useTeams(seasonId?: string) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = seasonId
      ? teamService.subscribeToSeason(seasonId, (data) => {
          setTeams(data);
          setLoading(false);
        })
      : teamService.subscribeToAll((data) => {
          setTeams(data);
          setLoading(false);
        });

    return () => unsubscribe();
  }, [seasonId]);

  return { teams, loading, error };
}
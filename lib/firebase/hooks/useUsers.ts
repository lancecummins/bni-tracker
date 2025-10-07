import { useState, useEffect } from 'react';
import { User } from '@/lib/types';
import { userService } from '@/lib/firebase/services';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = userService.subscribeToAll((data) => {
      setUsers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { users, loading, error };
}

export function useTeamUsers(teamId: string | null) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!teamId) {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = userService.subscribeToTeam(teamId, (data) => {
      setUsers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamId]);

  return { users, loading, error };
}
import { useState, useEffect } from 'react';
import { draftService } from '../services/draftService';
import { Draft } from '@/lib/types';

export function useDraft(draftId: string | null) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!draftId) {
      setDraft(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = draftService.subscribe(draftId, (data) => {
      setDraft(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [draftId]);

  const currentTurn = draft ? draftService.getCurrentTurn(draft) : null;

  return {
    draft,
    loading,
    error,
    currentTurn,
  };
}

export function useDraftBySeasonId(seasonId: string | null) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!seasonId) {
      setDraft(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const unsubscribe = draftService.subscribeBySeasonId(
        seasonId,
        (data) => {
          setDraft(data);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('Draft subscription error:', err);
          setError(err);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Draft subscription setup error:', err);
      setError(err as Error);
      setLoading(false);
    }
  }, [seasonId]);

  const currentTurn = draft ? draftService.getCurrentTurn(draft) : null;

  return {
    draft,
    loading,
    error,
    currentTurn,
  };
}

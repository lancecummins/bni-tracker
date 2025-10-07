import { useState, useEffect } from 'react';
import { settingsService, Settings } from '../services/settingsService';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch initial settings
    settingsService.get().then((data) => {
      setSettings(data);
      setLoading(false);
    });

    // Subscribe to settings changes
    const unsubscribe = settingsService.subscribe((data) => {
      setSettings(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateSettings = async (updates: Partial<Settings>) => {
    try {
      await settingsService.update(updates);
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  };

  return { settings, loading, updateSettings };
}
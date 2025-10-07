import { useState, useEffect } from 'react';
import { mockAuth } from '../mockAuth';

// Use mock auth for development
// In production, replace with real Firebase Auth
const USE_MOCK_AUTH = true;

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (USE_MOCK_AUTH) {
      // Mock auth
      const unsubscribe = mockAuth.onAuthStateChanged((mockUser) => {
        setUser(mockUser);
        setLoading(false);
      });
      return unsubscribe;
    } else {
      // Real Firebase auth would go here
      setLoading(false);
      return () => {};
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      if (USE_MOCK_AUTH) {
        const result = await mockAuth.signIn(email, password);
        setUser(result.user);
        return { success: true, user: result.user };
      } else {
        // Real Firebase login would go here
        return { success: false, error: 'Firebase Auth not configured' };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      if (USE_MOCK_AUTH) {
        await mockAuth.signOut();
        setUser(null);
        return { success: true };
      } else {
        // Real Firebase logout would go here
        return { success: false, error: 'Firebase Auth not configured' };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  return { user, loading, login, logout };
}
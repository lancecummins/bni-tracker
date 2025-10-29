'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { userService, sessionService } from '@/lib/firebase/services';
import { User, Session, AwardedCustomBonus } from '@/lib/types';
import { Calculator, Users, Gift, Save, Eye, EyeOff, Trophy, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useActiveSession } from '@/lib/firebase/hooks';
import { useSessionScores } from '@/lib/firebase/hooks/useScores';
import { useSettings } from '@/lib/firebase/hooks/useSettings';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { clearStaticDataCache } from '@/lib/firebase/hooks/useStaticData';

interface LanceScore {
  attendance: number;
  one21s: number;
  referrals: number;
  tyfcb: number;
  visitors: number;
  totalPoints: number;
}

interface UserAllocation {
  userId: string;
  user: User;
  points: number;
}

export default function LanceScoringPage() {
  const router = useRouter();
  const { session: activeSession } = useActiveSession();
  const { scores } = useSessionScores(activeSession?.id || null);
  const { settings } = useSettings();

  const [lanceScore, setLanceScore] = useState<LanceScore>({
    attendance: 0,
    one21s: 0,
    referrals: 0,
    tyfcb: 0,
    visitors: 0,
    totalPoints: 0,
  });

  const [users, setUsers] = useState<User[]>([]);
  const [allocations, setAllocations] = useState<UserAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    calculateTotalPoints();
  }, [lanceScore.attendance, lanceScore.one21s, lanceScore.referrals, lanceScore.tyfcb, lanceScore.visitors]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const allUsers = await userService.getAll();
      // Filter out Lance's own account
      const otherUsers = allUsers.filter(u => u.email !== 'lance@nectafy.com');
      setUsers(otherUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalPoints = () => {
    const points =
      (lanceScore.attendance * 5) +
      (lanceScore.one21s * 5) +
      (lanceScore.referrals * 10) +
      (lanceScore.tyfcb * 5) +
      (lanceScore.visitors * 10);

    setLanceScore(prev => ({ ...prev, totalPoints: points }));
  };

  const handleMetricChange = (metric: keyof Omit<LanceScore, 'totalPoints'>, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setLanceScore(prev => ({ ...prev, [metric]: numValue }));
  };

  const addAllocation = (user: User) => {
    if (allocations.find(a => a.userId === user.id)) {
      toast.error('User already added');
      return;
    }

    setAllocations(prev => [...prev, {
      userId: user.id!,
      user,
      points: 0,
    }]);
  };

  const updateAllocation = (userId: string, points: number) => {
    setAllocations(prev => prev.map(a =>
      a.userId === userId ? { ...a, points: Math.max(0, points) } : a
    ));
  };

  const removeAllocation = (userId: string) => {
    setAllocations(prev => prev.filter(a => a.userId !== userId));
  };

  const getTotalAllocated = () => {
    return allocations.reduce((sum, a) => sum + a.points, 0);
  };

  const getRemainingPoints = () => {
    return lanceScore.totalPoints - getTotalAllocated();
  };

  const handleSave = async () => {
    if (!activeSession?.id) {
      toast.error('No active session found');
      return;
    }

    if (getRemainingPoints() < 0) {
      toast.error('You have allocated more points than available!');
      return;
    }

    try {
      setSaving(true);

      // Save Lance's allocations to localStorage for now
      // In a real implementation, you'd save this to Firebase
      const saveData = {
        sessionId: activeSession.id,
        lanceScore,
        allocations: allocations.map(a => ({
          userId: a.userId,
          points: a.points,
        })),
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem(`lance-scoring-${activeSession.id}`, JSON.stringify(saveData));
      toast.success('Allocations saved! Ready to reveal during the game.');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save allocations');
    } finally {
      setSaving(false);
    }
  };

  const handleReveal = async () => {
    if (!activeSession?.id) {
      toast.error('No active session found');
      return;
    }

    if (allocations.length === 0) {
      toast.error('No allocations to reveal');
      return;
    }

    if (getRemainingPoints() < 0) {
      toast.error('You have allocated more points than available!');
      return;
    }

    if (!settings) {
      toast.error('Settings not loaded');
      return;
    }

    try {
      // Award each allocation as a custom bonus
      for (const allocation of allocations) {
        if (allocation.points <= 0) continue;

        const userScore = scores.find(s => s.userId === allocation.userId);
        if (!userScore) {
          toast.error(`No score found for ${allocation.user.firstName} ${allocation.user.lastName}`);
          continue;
        }

        // Create the custom bonus
        const awardedBonus: AwardedCustomBonus = {
          bonusId: 'lance-bonus',
          bonusName: "Lance's Bonus",
          points: allocation.points,
          awardedBy: 'lance@nectafy.com',
          awardedAt: Timestamp.now(),
        };

        // Calculate new totals
        const updatedCustomBonuses = [...(userScore.customBonuses || []), awardedBonus];
        const customBonusTotal = updatedCustomBonuses.reduce((sum, b) => sum + b.points, 0);
        const metricsTotal = (
          ((userScore.metrics.attendance || 0) * (settings.pointValues.attendance || 0)) +
          ((userScore.metrics.one21s || 0) * (settings.pointValues.one21s || 0)) +
          ((userScore.metrics.referrals || 0) * (settings.pointValues.referrals || 0)) +
          ((userScore.metrics.tyfcb || 0) * (settings.pointValues.tyfcb || 0)) +
          ((userScore.metrics.visitors || 0) * (settings.pointValues.visitors || 0))
        );

        // Update the score document
        await updateDoc(doc(db, 'scores', userScore.id!), {
          customBonuses: updatedCustomBonuses,
          totalPoints: metricsTotal + customBonusTotal,
          updatedAt: Timestamp.now(),
        });

        // Trigger display notification
        await fetch('/api/display', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'DISPLAY_CUSTOM_BONUS',
            bonusName: "Lance's Bonus",
            bonusPoints: allocation.points,
            targetName: `${allocation.user.firstName} ${allocation.user.lastName}`,
            isTeamBonus: false,
          })
        });

        toast.success(`Awarded ${allocation.points} pts to ${allocation.user.firstName} ${allocation.user.lastName}`);
      }

      // Clear cache so display shows updated totals immediately
      clearStaticDataCache();

      // Clear the saved allocations
      localStorage.removeItem(`lance-scoring-${activeSession.id}`);

      // Reset the form
      setLanceScore({
        attendance: 0,
        one21s: 0,
        referrals: 0,
        tyfcb: 0,
        visitors: 0,
        totalPoints: 0,
      });
      setAllocations([]);

      toast.success('All points revealed and awarded!');
    } catch (error) {
      console.error('Error revealing points:', error);
      toast.error('Failed to reveal points');
    }
  };

  const loadSavedData = () => {
    if (!activeSession?.id) return;

    const saved = localStorage.getItem(`lance-scoring-${activeSession.id}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setLanceScore(data.lanceScore);

        // Reconstruct allocations with user objects
        const reconstructed = data.allocations.map((a: any) => {
          const user = users.find(u => u.id === a.userId);
          return user ? { userId: a.userId, user, points: a.points } : null;
        }).filter(Boolean);

        setAllocations(reconstructed);
        toast.success('Loaded saved allocations');
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin')}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Lance's Scoring</h1>
                <p className="text-gray-600 mt-1">
                  {activeSession ? `Session: ${activeSession.name || `Week ${activeSession.weekNumber}`}` : 'No active session'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {activeSession && users.length > 0 && (
                <button
                  onClick={loadSavedData}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <Eye size={20} />
                  Load Saved
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Lance's Score */}
          <div className="space-y-6">
            {/* Metrics Input */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Calculator size={24} className="text-blue-600" />
                Your Metrics
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Attendance (5 pts each)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={lanceScore.attendance}
                    onChange={(e) => handleMetricChange('attendance', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    1-2-1s (5 pts each)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={lanceScore.one21s}
                    onChange={(e) => handleMetricChange('one21s', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Referrals (10 pts each)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={lanceScore.referrals}
                    onChange={(e) => handleMetricChange('referrals', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    TYFCB (5 pts each)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={lanceScore.tyfcb}
                    onChange={(e) => handleMetricChange('tyfcb', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visitors (10 pts each)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={lanceScore.visitors}
                    onChange={(e) => handleMetricChange('visitors', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Total Points */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg opacity-90">Total Points Available</p>
                  <p className="text-5xl font-bold mt-2">{lanceScore.totalPoints}</p>
                </div>
                <Trophy size={64} className="opacity-50" />
              </div>

              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="flex justify-between text-sm">
                  <span>Allocated:</span>
                  <span className="font-semibold">{getTotalAllocated()}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Remaining:</span>
                  <span className={`font-semibold ${getRemainingPoints() < 0 ? 'text-red-300' : 'text-green-300'}`}>
                    {getRemainingPoints()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Point Allocation */}
          <div className="space-y-6">
            {/* Add User */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Gift size={24} className="text-purple-600" />
                Allocate Points to Users
              </h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select User to Add
                </label>
                <select
                  onChange={(e) => {
                    const user = users.find(u => u.id === e.target.value);
                    if (user) {
                      addAllocation(user);
                      e.target.value = '';
                    }
                  }}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue=""
                >
                  <option value="" disabled>Choose a user...</option>
                  {users
                    .filter(u => !allocations.find(a => a.userId === u.id))
                    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
                    .map(user => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName}
                      </option>
                    ))}
                </select>
              </div>

              {/* Allocations List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {allocations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No allocations yet. Select users above to allocate points.</p>
                  </div>
                ) : (
                  allocations.map(allocation => (
                    <div
                      key={allocation.userId}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <img
                        src={allocation.user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${allocation.user.firstName}${allocation.user.lastName}`}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {allocation.user.firstName} {allocation.user.lastName}
                        </div>
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={allocation.points}
                        onChange={(e) => updateAllocation(allocation.userId, parseInt(e.target.value) || 0)}
                        className="w-24 px-3 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-semibold"
                        placeholder="Points"
                      />
                      <button
                        onClick={() => removeAllocation(allocation.userId)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4">Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={handleSave}
                  disabled={saving || !activeSession}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {saving ? 'Saving...' : 'Save Allocations'}
                </button>

                <button
                  onClick={handleReveal}
                  disabled={!activeSession || allocations.length === 0}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Eye size={20} />
                  Reveal & Apply Points
                </button>

                <p className="text-xs text-gray-500 text-center">
                  Save your allocations before the game, then reveal them during the game to apply the points to user scores.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

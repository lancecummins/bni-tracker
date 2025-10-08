'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { scoreService } from '@/lib/firebase/services';
import { ScoreMetrics, Score } from '@/lib/types';
import { Save, AlertCircle, CheckCircle, Trophy, Zap, Users } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { Avatar } from '@/components/Avatar';

interface TeamScoringPageProps {
  params: {
    teamId: string;
  };
}

export default function TeamScoringPage({ params }: TeamScoringPageProps) {
  const router = useRouter();
  const { teamId } = params;
  const [activeSession, setActiveSession] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [editedScores, setEditedScores] = useState<Record<string, ScoreMetrics>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [mobileView, setMobileView] = useState<'table' | 'cards'>('cards');
  const [savingUsers, setSavingUsers] = useState<Record<string, boolean>>({});
  const [savedUsers, setSavedUsers] = useState<Record<string, boolean>>({});

  // Find the team by ID from URL
  const team = teams.find(t => t.id === teamId);

  // Filter users to only show this team's members
  const teamMembers = useMemo(() => {
    return users.filter(u => u.teamId === teamId && (u.role === 'member' || u.role === 'team-leader' || u.role === 'admin') && u.isActive);
  }, [users, teamId]);

  // Load all data directly from Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load active session
        const sessionsQuery = query(
          collection(db, 'sessions'),
          where('status', '==', 'open'),
          orderBy('createdAt', 'desc')
        );
        const sessionsSnapshot = await getDocs(sessionsQuery);
        const activeSessions = sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (activeSessions.length > 0) {
          setActiveSession(activeSessions[0]);
        }

        // Load users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersData);

        // Load teams
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        const teamsData = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTeams(teamsData);

        // Load settings
        const settingsSnapshot = await getDocs(collection(db, 'settings'));
        if (!settingsSnapshot.empty) {
          const settingsData = settingsSnapshot.docs[0].data();
          setSettings(settingsData);
        }

        // Load scores for active session
        if (activeSessions.length > 0) {
          const sessionScores = await scoreService.getBySession(activeSessions[0].id);
          setScores(sessionScores);
        }

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Clear save message after 5 seconds
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const getScore = (userId: string): ScoreMetrics => {
    const existingScore = scores.find(s => s.userId === userId);
    const editedScore = editedScores[userId];

    return editedScore || existingScore?.metrics || {
      attendance: 0,
      one21s: 0,
      referrals: 0,
      tyfcb: 0,
      visitors: 0
    };
  };

  const calculateTotal = (metrics: ScoreMetrics): number => {
    if (!settings) return 0;

    return (
      metrics.attendance * settings.pointValues.attendance +
      metrics.one21s * settings.pointValues.one21s +
      metrics.referrals * settings.pointValues.referrals +
      metrics.tyfcb * settings.pointValues.tyfcb +
      metrics.visitors * settings.pointValues.visitors
    );
  };

  const updateScore = (userId: string, field: keyof ScoreMetrics, value: number) => {
    setEditedScores(prev => ({
      ...prev,
      [userId]: {
        ...getScore(userId),
        [field]: Math.max(0, value) // Ensure no negative values
      }
    }));
  };

  const saveScore = async (userId: string) => {
    if (!activeSession?.id) return;

    const metrics = editedScores[userId];
    if (!metrics) return;

    setSavingUsers(prev => ({ ...prev, [userId]: true }));

    try {
      // Use upsert to create or update score
      await scoreService.upsert({
        userId,
        sessionId: activeSession.id,
        seasonId: 'season-id', // Should come from active season
        teamId: teamId,
        metrics,
        totalPoints: calculateTotal(metrics),
        isDraft: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Reload scores to get the updated data
      const sessionScores = await scoreService.getBySession(activeSession.id);
      setScores(sessionScores);

      // Clear edited state for this user
      setEditedScores(prev => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });

      // Show saved indicator
      setSavedUsers(prev => ({ ...prev, [userId]: true }));
      setTimeout(() => {
        setSavedUsers(prev => ({ ...prev, [userId]: false }));
      }, 2000);

    } catch (error) {
      console.error('Error saving score:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save score' });
    } finally {
      setSavingUsers(prev => ({ ...prev, [userId]: false }));
    }
  };

  const hasUnsavedChanges = (userId: string): boolean => {
    return !!editedScores[userId];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Active Session</h2>
          <p className="text-gray-600">There is no active scoring session at the moment.</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Team Not Found</h2>
          <p className="text-gray-600">The specified team could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: team.color || '#3B82F6' }}
                >
                  <span className="text-white font-bold text-sm">{team.name.charAt(0)}</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{team.name} - Team Scoring</h1>
                  <p className="text-gray-600">
                    Week {activeSession.weekNumber} • {teamMembers.length} members
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className={`rounded-md p-4 ${
            saveMessage.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex">
              {saveMessage.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-400" />
              )}
              <div className="ml-3">
                <p className={`text-sm font-medium ${
                  saveMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {saveMessage.text}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mobile View Toggle */}
        <div className="lg:hidden mb-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setMobileView('cards')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                mobileView === 'cards'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Cards View
            </button>
            <button
              onClick={() => setMobileView('table')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                mobileView === 'table'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Table View
            </button>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendance
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    1-2-1s
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Referrals
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TYFCB
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Visitors
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamMembers.map((member) => {
                  const score = getScore(member.id!);
                  const total = calculateTotal(score);
                  const isSaving = savingUsers[member.id!];
                  const isSaved = savedUsers[member.id!];
                  const hasChanges = hasUnsavedChanges(member.id!);

                  return (
                    <tr key={member.id} className={hasChanges ? 'bg-blue-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Avatar
                            src={member.avatarUrl}
                            fallbackSeed={`${member.firstName}${member.lastName}`}
                            size="sm"
                          />
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {member.firstName} {member.lastName}
                            </div>
                            <div className="text-sm text-gray-500 capitalize">{member.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          min="0"
                          max="1"
                          value={score.attendance}
                          onChange={(e) => updateScore(member.id!, 'attendance', parseInt(e.target.value) || 0)}
                          className="w-16 text-center border border-gray-300 rounded-md px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          min="0"
                          value={score.one21s}
                          onChange={(e) => updateScore(member.id!, 'one21s', parseInt(e.target.value) || 0)}
                          className="w-16 text-center border border-gray-300 rounded-md px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          min="0"
                          value={score.referrals}
                          onChange={(e) => updateScore(member.id!, 'referrals', parseInt(e.target.value) || 0)}
                          className="w-16 text-center border border-gray-300 rounded-md px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          min="0"
                          value={score.tyfcb}
                          onChange={(e) => updateScore(member.id!, 'tyfcb', parseInt(e.target.value) || 0)}
                          className="w-16 text-center border border-gray-300 rounded-md px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          min="0"
                          value={score.visitors}
                          onChange={(e) => updateScore(member.id!, 'visitors', parseInt(e.target.value) || 0)}
                          className="w-16 text-center border border-gray-300 rounded-md px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`text-lg font-bold ${
                          hasChanges ? 'text-blue-600' : 'text-gray-900'
                        }`}>
                          {total}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => saveScore(member.id!)}
                          disabled={!hasChanges || isSaving}
                          className={`inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md transition-colors ${
                            hasChanges
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : isSaved
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {isSaving ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : isSaved ? (
                            <CheckCircle size={16} />
                          ) : (
                            <Save size={16} />
                          )}
                          <span className="ml-1">
                            {isSaving ? 'Saving...' : isSaved ? 'Saved!' : 'Save'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className={`lg:hidden ${mobileView === 'cards' ? 'block' : 'hidden'}`}>
          <div className="space-y-4">
            {teamMembers.map((member) => {
              const score = getScore(member.id!);
              const total = calculateTotal(score);
              const isSaving = savingUsers[member.id!];
              const isSaved = savedUsers[member.id!];
              const hasChanges = hasUnsavedChanges(member.id!);

              return (
                <div key={member.id} className={`bg-white rounded-lg shadow p-4 ${hasChanges ? 'ring-2 ring-blue-200' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <Avatar
                        src={member.avatarUrl}
                        fallbackSeed={`${member.firstName}${member.lastName}`}
                        size="sm"
                      />
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="text-sm text-gray-500 capitalize">{member.role}</div>
                      </div>
                    </div>
                    <div className={`text-2xl font-bold ${
                      hasChanges ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {total}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Attendance</label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        value={score.attendance}
                        onChange={(e) => updateScore(member.id!, 'attendance', parseInt(e.target.value) || 0)}
                        className="w-full text-center border border-gray-300 rounded-md px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">1-2-1s</label>
                      <input
                        type="number"
                        min="0"
                        value={score.one21s}
                        onChange={(e) => updateScore(member.id!, 'one21s', parseInt(e.target.value) || 0)}
                        className="w-full text-center border border-gray-300 rounded-md px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Referrals</label>
                      <input
                        type="number"
                        min="0"
                        value={score.referrals}
                        onChange={(e) => updateScore(member.id!, 'referrals', parseInt(e.target.value) || 0)}
                        className="w-full text-center border border-gray-300 rounded-md px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">TYFCB</label>
                      <input
                        type="number"
                        min="0"
                        value={score.tyfcb}
                        onChange={(e) => updateScore(member.id!, 'tyfcb', parseInt(e.target.value) || 0)}
                        className="w-full text-center border border-gray-300 rounded-md px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Visitors</label>
                      <input
                        type="number"
                        min="0"
                        value={score.visitors}
                        onChange={(e) => updateScore(member.id!, 'visitors', parseInt(e.target.value) || 0)}
                        className="w-full text-center border border-gray-300 rounded-md px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => saveScore(member.id!)}
                        disabled={!hasChanges || isSaving}
                        className={`w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md transition-colors ${
                          hasChanges
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : isSaved
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {isSaving ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : isSaved ? (
                          <CheckCircle size={16} />
                        ) : (
                          <Save size={16} />
                        )}
                        <span className="ml-1">
                          {isSaving ? 'Saving...' : isSaved ? 'Saved!' : 'Save'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Table View */}
        <div className={`lg:hidden ${mobileView === 'table' ? 'block' : 'hidden'}`}>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Member
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Att
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      1-2-1
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ref
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      TYFCB
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vis
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Save
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teamMembers.map((member) => {
                    const score = getScore(member.id!);
                    const total = calculateTotal(score);
                    const isSaving = savingUsers[member.id!];
                    const isSaved = savedUsers[member.id!];
                    const hasChanges = hasUnsavedChanges(member.id!);

                    return (
                      <tr key={member.id} className={hasChanges ? 'bg-blue-50' : ''}>
                        <td className="px-3 py-2">
                          <div className="flex items-center">
                            <Avatar
                              src={member.avatarUrl}
                              fallbackSeed={`${member.firstName}${member.lastName}`}
                              size="xs"
                            />
                            <div className="ml-2">
                              <div className="text-xs font-medium text-gray-900">
                                {member.firstName} {member.lastName}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="1"
                            value={score.attendance}
                            onChange={(e) => updateScore(member.id!, 'attendance', parseInt(e.target.value) || 0)}
                            className="w-12 text-center border border-gray-300 rounded px-1 py-1 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={score.one21s}
                            onChange={(e) => updateScore(member.id!, 'one21s', parseInt(e.target.value) || 0)}
                            className="w-12 text-center border border-gray-300 rounded px-1 py-1 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={score.referrals}
                            onChange={(e) => updateScore(member.id!, 'referrals', parseInt(e.target.value) || 0)}
                            className="w-12 text-center border border-gray-300 rounded px-1 py-1 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={score.tyfcb}
                            onChange={(e) => updateScore(member.id!, 'tyfcb', parseInt(e.target.value) || 0)}
                            className="w-12 text-center border border-gray-300 rounded px-1 py-1 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={score.visitors}
                            onChange={(e) => updateScore(member.id!, 'visitors', parseInt(e.target.value) || 0)}
                            className="w-12 text-center border border-gray-300 rounded px-1 py-1 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className={`text-sm font-bold ${
                            hasChanges ? 'text-blue-600' : 'text-gray-900'
                          }`}>
                            {total}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => saveScore(member.id!)}
                            disabled={!hasChanges || isSaving}
                            className={`p-1 rounded transition-colors ${
                              hasChanges
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : isSaved
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {isSaving ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            ) : isSaved ? (
                              <CheckCircle size={12} />
                            ) : (
                              <Save size={12} />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
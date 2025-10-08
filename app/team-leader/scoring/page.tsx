'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/hooks/useAuth';
import { useStaticActiveSession, useStaticUsers, useStaticTeams, useStaticSettings } from '@/lib/firebase/hooks/useStaticData';
import { scoreService } from '@/lib/firebase/services';
import { ScoreMetrics, Score } from '@/lib/types';
import { Save, AlertCircle, CheckCircle, Trophy, Zap, Users } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { Avatar } from '@/components/Avatar';

export default function TeamLeaderScoringPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { session: activeSession } = useStaticActiveSession();
  const { users } = useStaticUsers();
  const { teams } = useStaticTeams();
  const [scores, setScores] = useState<Score[]>([]);
  const { settings } = useStaticSettings();

  const [editedScores, setEditedScores] = useState<Record<string, ScoreMetrics>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'table' | 'cards'>('cards');
  const [savingUsers, setSavingUsers] = useState<Record<string, boolean>>({});
  const [savedUsers, setSavedUsers] = useState<Record<string, boolean>>({});

  // Get current user's role
  const userRecord = users.find(u => u.email === currentUser?.email);
  const isAdmin = userRecord?.role === 'admin';
  const isTeamLeader = userRecord?.role === 'team-leader';

  // Find the team that this leader manages (or selected team if admin)
  const myTeam = isAdmin
    ? teams.find(t => t.id === selectedTeamId) || teams[0]
    : teams.find(t => t.teamLeaderId === currentUser?.uid);

  // Use useMemo to prevent recreating teamMembers array on every render
  const teamMembers = useMemo(() => {
    return users.filter(u => u.teamId === myTeam?.id && (u.role === 'member' || u.role === 'team-leader' || u.role === 'admin') && u.isActive);
  }, [users, myTeam?.id]);

  // Set initial selected team for admin
  useEffect(() => {
    if (isAdmin && teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id!);
    }
  }, [isAdmin, teams, selectedTeamId]);

  // Check if user is authorized
  useEffect(() => {
    if (currentUser && users.length > 0) {
      if (!isAdmin && !isTeamLeader) {
        router.push('/');
      }
    }
  }, [currentUser, users, router, isAdmin, isTeamLeader]);

  // Initialize scores - refetch when team changes
  useEffect(() => {
    const fetchScores = async () => {
      // Fetch scores when we have an active session and team
      if (activeSession && myTeam?.id && users.length > 0) {
        try {
          // Fetch scores once (not subscribe)
          const sessionScores = await scoreService.getBySession(activeSession.id!);
          setScores(sessionScores);

          const initial: Record<string, ScoreMetrics> = {};
          const currentTeamMembers = users.filter(u => u.teamId === myTeam.id && (u.role === 'member' || u.role === 'team-leader' || u.role === 'admin') && u.isActive);

          currentTeamMembers.forEach(member => {
            const existingScore = sessionScores.find(s => s.userId === member.id);
            initial[member.id!] = existingScore?.metrics || {
              attendance: 0,
              one21s: 0,
              referrals: 0,
              tyfcb: 0,
              visitors: 0,
            };
          });
          setEditedScores(initial);

          // Mark all users as saved initially (since we're loading existing scores)
          const savedStatus: Record<string, boolean> = {};
          currentTeamMembers.forEach(member => {
            savedStatus[member.id!] = true;
          });
          setSavedUsers(savedStatus);
        } catch (error) {
          console.error('Error fetching scores:', error);
        }
      }
    };

    fetchScores();
  }, [activeSession?.id, myTeam?.id, users.length]); // Re-run when team changes

  const handleMetricChange = (userId: string, metric: keyof ScoreMetrics, value: string) => {
    const numValue = parseInt(value) || 0;
    setEditedScores(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [metric]: numValue,
      },
    }));
    // Mark user as unsaved
    setSavedUsers(prev => ({ ...prev, [userId]: false }));
  };

  // Save individual user score
  const handleSaveUser = async (userId: string) => {
    if (!activeSession || !myTeam || !currentUser) return;

    setSavingUsers(prev => ({ ...prev, [userId]: true }));

    try {
      const metrics = editedScores[userId] || {
        attendance: 0,
        one21s: 0,
        referrals: 0,
        tyfcb: 0,
        visitors: 0,
      };

      const score = {
        userId: userId,
        sessionId: activeSession.id!,
        seasonId: activeSession.seasonId,
        teamId: myTeam.id!,
        metrics,
        totalPoints: calculateTotal(metrics),
        isDraft: false,
        enteredBy: currentUser.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const scoreId = await scoreService.upsert(score);
      setSavedUsers(prev => ({ ...prev, [userId]: true }));

      // Update local scores array
      setScores(prev => {
        const existing = prev.find(s => s.userId === userId && s.sessionId === activeSession.id);
        if (existing) {
          return prev.map(s =>
            s.userId === userId && s.sessionId === activeSession.id
              ? { ...score, id: existing.id }
              : s
          );
        } else {
          return [...prev, { ...score, id: scoreId }];
        }
      });
    } catch (error) {
      console.error('Error saving user score:', error);
    } finally {
      setSavingUsers(prev => ({ ...prev, [userId]: false }));
    }
  };

  const calculateTotal = (metrics: ScoreMetrics) => {
    if (!settings) return 0;
    return (
      (metrics.attendance || 0) * settings.pointValues.attendance +
      (metrics.one21s || 0) * settings.pointValues.one21s +
      (metrics.referrals || 0) * settings.pointValues.referrals +
      (metrics.tyfcb || 0) * settings.pointValues.tyfcb +
      (metrics.visitors || 0) * settings.pointValues.visitors
    );
  };

  // Calculate team bonuses
  const calculateTeamBonuses = () => {
    if (!settings || teamMembers.length === 0) return { bonuses: [], total: 0 };

    const earnedBonuses: { category: string; points: number }[] = [];
    let bonusTotal = 0;

    // Check each category for "All In" bonus
    const categories = ['attendance', 'one21s', 'referrals', 'tyfcb', 'visitors'] as const;

    categories.forEach(category => {
      const allMembersHavePoints = teamMembers.every(member => {
        const metrics = editedScores[member.id!];
        return metrics && metrics[category] > 0;
      });

      if (allMembersHavePoints && settings.bonusValues) {
        const bonusPoints = settings.bonusValues[category];
        earnedBonuses.push({
          category: category === 'one21s' ? '1-2-1s' :
                    category === 'tyfcb' ? 'TYFCB' :
                    category.charAt(0).toUpperCase() + category.slice(1),
          points: bonusPoints
        });
        bonusTotal += bonusPoints;
      }
    });

    return { bonuses: earnedBonuses, total: bonusTotal };
  };

  // Calculate team totals
  const calculateTeamTotals = () => {
    let individualTotal = 0;
    teamMembers.forEach(member => {
      const metrics = editedScores[member.id!] || {
        attendance: 0,
        one21s: 0,
        referrals: 0,
        tyfcb: 0,
        visitors: 0,
      };
      individualTotal += calculateTotal(metrics);
    });

    const { bonuses, total: bonusTotal } = calculateTeamBonuses();
    return {
      individual: individualTotal,
      bonuses,
      bonusTotal,
      grandTotal: individualTotal + bonusTotal
    };
  };

  const handleSave = async () => {
    if (!activeSession || !myTeam || !currentUser) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const promises = teamMembers.map(async (member) => {
        if (!member.id) return;

        const metrics = editedScores[member.id] || {
          attendance: 0,
          one21s: 0,
          referrals: 0,
          tyfcb: 0,
          visitors: 0,
        };

        const score = {
          userId: member.id,
          sessionId: activeSession.id!,
          seasonId: activeSession.seasonId,
          teamId: myTeam.id!,
          metrics,
          totalPoints: calculateTotal(metrics),
          isDraft: false, // Scores are live immediately
          enteredBy: currentUser.uid,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        return scoreService.upsert(score);
      });

      await Promise.all(promises);
      setSaveMessage({ type: 'success', text: 'All scores saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving scores:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save scores. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (!myTeam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold">No Team Available</h2>
          <p className="text-gray-600 mt-2">
            {isAdmin
              ? "No teams have been created yet. Please create a team first."
              : "You are not assigned as a team leader."}
          </p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold">No Active Session</h2>
          <p className="text-gray-600 mt-2">Please wait for an admin to start a scoring session.</p>
        </div>
      </div>
    );
  }

  const teamTotals = calculateTeamTotals();

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-sm p-3 md:p-6 md:rounded-lg md:mx-4 md:mt-8 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Team Scoring</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-600">Week {activeSession.weekNumber}</span>
                <span className="text-sm text-gray-400">•</span>
                <span className="text-sm text-gray-600">{activeSession.date.toDate().toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-end md:items-center gap-2">
              {isAdmin && teams.length > 1 ? (
                <select
                  value={selectedTeamId || ''}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="text-sm md:text-base border-2 rounded-lg px-3 py-1.5 font-semibold"
                  style={{ borderColor: myTeam?.color, color: myTeam?.color }}
                >
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div
                  className="inline-block px-4 py-1.5 rounded-full text-sm md:text-base font-semibold text-white"
                  style={{ backgroundColor: myTeam?.color }}
                >
                  {myTeam?.name}
                </div>
              )}

            </div>
          </div>

          {/* Save message */}
          {saveMessage && (
            <div className={`mt-4 p-4 rounded-lg flex items-center gap-2 text-lg font-semibold ${
              saveMessage.type === 'success' ? 'bg-green-100 text-green-800 border-2 border-green-300' : 'bg-red-100 text-red-800 border-2 border-red-300'
            }`}>
              {saveMessage.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
              {saveMessage.text}
            </div>
          )}
        </div>

        {/* Team Score Summary */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-6 px-2 md:mx-4">
          {/* Individual Points */}
          <div className="bg-white rounded-lg shadow-sm p-3 md:p-4">
            <div className="flex flex-col items-center md:items-start">
              <div className="flex items-center gap-1 md:gap-2 text-gray-600 mb-1">
                <Users size={16} className="md:hidden" />
                <Users size={18} className="hidden md:block" />
                <span className="text-xs md:text-sm font-medium hidden md:block">Individual Points</span>
              </div>
              <p className="text-xs text-gray-600 md:hidden">Individual</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{teamTotals.individual}</p>
            </div>
          </div>

          {/* Bonus Points */}
          <div className="bg-white rounded-lg shadow-sm p-3 md:p-4">
            <div className="flex flex-col items-center md:items-start">
              <div className="flex items-center gap-1 md:gap-2 text-green-600 mb-1">
                <Zap size={16} className="md:hidden" />
                <Zap size={18} className="hidden md:block" />
                <span className="text-xs md:text-sm font-medium hidden md:block">Bonus Points</span>
              </div>
              <p className="text-xs text-gray-600 md:hidden">Bonus</p>
              <p className="text-xl md:text-2xl font-bold text-green-600">{teamTotals.bonusTotal}</p>
              {teamTotals.bonuses.length > 0 && (
                <div className="mt-2 space-y-1 hidden md:block">
                  {teamTotals.bonuses.map((bonus, idx) => (
                    <p key={idx} className="text-xs text-gray-600">
                      ✓ {bonus.category} All-In (+{bonus.points})
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Grand Total */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-sm p-3 md:p-4 text-white">
            <div className="flex flex-col items-center md:items-start">
              <div className="flex items-center gap-1 md:gap-2 mb-1">
                <Trophy size={16} className="md:hidden" />
                <Trophy size={18} className="hidden md:block" />
                <span className="text-xs md:text-sm font-medium hidden md:block">Team Total</span>
              </div>
              <p className="text-xs text-white/90 md:hidden">Total</p>
              <p className="text-xl md:text-3xl font-bold">{teamTotals.grandTotal}</p>
            </div>
          </div>
        </div>

        {/* Mobile View Toggle */}
        <div className="md:hidden flex justify-end mb-4 px-4">
          <div className="bg-white rounded-lg shadow-sm p-1 inline-flex">
            <button
              onClick={() => setMobileView('cards')}
              className={`px-3 py-1 rounded text-sm ${
                mobileView === 'cards'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setMobileView('table')}
              className={`px-3 py-1 rounded text-sm ${
                mobileView === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Table
            </button>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className={`md:hidden ${mobileView === 'cards' ? 'block' : 'hidden'} px-4`}>
          <div className="space-y-3">
            {teamMembers.map(member => {
              const metrics = editedScores[member.id!] || {
                attendance: 0,
                one21s: 0,
                referrals: 0,
                tyfcb: 0,
                visitors: 0,
              };
              const total = calculateTotal(metrics);

              return (
                <div key={member.id} className="bg-white rounded-lg shadow-sm p-4">
                  {/* Member Info */}
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                    <Avatar
                      src={member.avatarUrl}
                      fallbackSeed={`${member.firstName}${member.lastName}`}
                      size="md"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-xl font-bold text-blue-600">{total}</p>
                    </div>
                  </div>

                  {/* Quick Entry Grid */}
                  <div className="space-y-3">
                    {/* Attendance */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">
                        Attendance ({settings?.pointValues.attendance || 0}pts)
                      </label>
                      <button
                        onClick={() => handleMetricChange(member.id!, 'attendance', metrics.attendance === 1 ? '0' : '1')}
                        className={`w-full py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                          metrics.attendance === 1
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          metrics.attendance === 1
                            ? 'bg-white border-white'
                            : 'bg-white border-gray-400'
                        }`}>
                          {metrics.attendance === 1 && (
                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        Present
                      </button>
                    </div>

                    {/* 1-2-1s */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">
                        1-2-1s ({settings?.pointValues.one21s || 0}pts)
                      </label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(val => (
                          <button
                            key={val}
                            onClick={() => handleMetricChange(member.id!, 'one21s', val.toString())}
                            className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                              metrics.one21s === val
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                        <input
                          type="number"
                          min="0"
                          value={metrics.one21s > 5 ? metrics.one21s : ''}
                          onChange={(e) => handleMetricChange(member.id!, 'one21s', e.target.value)}
                          placeholder="+"
                          className="w-10 px-1 py-2 text-center border rounded text-sm"
                        />
                      </div>
                    </div>

                    {/* Referrals */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">
                        Referrals ({settings?.pointValues.referrals || 0}pts)
                      </label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(val => (
                          <button
                            key={val}
                            onClick={() => handleMetricChange(member.id!, 'referrals', val.toString())}
                            className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                              metrics.referrals === val
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                        <input
                          type="number"
                          min="0"
                          value={metrics.referrals > 5 ? metrics.referrals : ''}
                          onChange={(e) => handleMetricChange(member.id!, 'referrals', e.target.value)}
                          placeholder="+"
                          className="w-10 px-1 py-2 text-center border rounded text-sm"
                        />
                      </div>
                    </div>

                    {/* TYFCB */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">
                        TYFCB ({settings?.pointValues.tyfcb || 0}pts)
                      </label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(val => (
                          <button
                            key={val}
                            onClick={() => handleMetricChange(member.id!, 'tyfcb', val.toString())}
                            className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                              metrics.tyfcb === val
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                        <input
                          type="number"
                          min="0"
                          value={metrics.tyfcb > 5 ? metrics.tyfcb : ''}
                          onChange={(e) => handleMetricChange(member.id!, 'tyfcb', e.target.value)}
                          placeholder="+"
                          className="w-10 px-1 py-2 text-center border rounded text-sm"
                        />
                      </div>
                    </div>

                    {/* Visitors */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">
                        Visitors ({settings?.pointValues.visitors || 0}pts)
                      </label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(val => (
                          <button
                            key={val}
                            onClick={() => handleMetricChange(member.id!, 'visitors', val.toString())}
                            className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                              metrics.visitors === val
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                        <input
                          type="number"
                          min="0"
                          value={metrics.visitors > 5 ? metrics.visitors : ''}
                          onChange={(e) => handleMetricChange(member.id!, 'visitors', e.target.value)}
                          placeholder="+"
                          className="w-10 px-1 py-2 text-center border rounded text-sm"
                        />
                      </div>
                    </div>

                    {/* Save button for this user */}
                    <div className="mt-3 pt-3 border-t">
                      <button
                        onClick={() => handleSaveUser(member.id!)}
                        disabled={savingUsers[member.id!] || savedUsers[member.id!]}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
                          savedUsers[member.id!]
                            ? 'bg-gray-100 text-gray-400'
                            : savingUsers[member.id!]
                            ? 'bg-blue-300 text-white'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          {savingUsers[member.id!] ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                              <span>Saving...</span>
                            </>
                          ) : savedUsers[member.id!] ? (
                            <>
                              <CheckCircle size={16} />
                              <span>Saved</span>
                            </>
                          ) : (
                            <>
                              <Save size={16} />
                              <span>Save</span>
                            </>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop Table View (and mobile table if selected) */}
        <div className={`bg-white md:rounded-lg shadow-sm overflow-hidden md:mx-4 ${
          mobileView === 'table' ? 'block' : 'hidden md:block'
        }`}>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Member</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                    <div>Present</div>
                    <div className="text-xs font-normal text-gray-500">{settings?.pointValues.attendance || 0}pts</div>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                    <div>1-2-1s</div>
                    <div className="text-xs font-normal text-gray-500">{settings?.pointValues.one21s || 0}pts</div>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                    <div>Referrals</div>
                    <div className="text-xs font-normal text-gray-500">{settings?.pointValues.referrals || 0}pts</div>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                    <div>TYFCB</div>
                    <div className="text-xs font-normal text-gray-500">{settings?.pointValues.tyfcb || 0}pts</div>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                    <div>Visitors</div>
                    <div className="text-xs font-normal text-gray-500">{settings?.pointValues.visitors || 0}pts</div>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {teamMembers.map(member => {
                  const metrics = editedScores[member.id!] || {
                    attendance: 0,
                    one21s: 0,
                    referrals: 0,
                    tyfcb: 0,
                    visitors: 0,
                  };
                  const total = calculateTotal(metrics);

                  return (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={member.avatarUrl}
                            fallbackSeed={`${member.firstName}${member.lastName}`}
                            size="sm"
                          />
                          <div>
                            <div className="font-medium text-gray-900">
                              {member.firstName} {member.lastName}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">{member.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleMetricChange(member.id!, 'attendance', metrics.attendance === 1 ? '0' : '1')}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                              metrics.attendance === 1
                                ? 'bg-green-600 hover:bg-green-700'
                                : 'bg-gray-200 hover:bg-gray-300'
                            }`}
                          >
                            {metrics.attendance === 1 ? (
                              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <div className="w-5 h-5 border-2 border-gray-400 rounded"></div>
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          value={metrics.one21s || 0}
                          onChange={(e) => handleMetricChange(member.id!, 'one21s', e.target.value)}
                          className="w-16 px-2 py-1 text-center border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          value={metrics.referrals || 0}
                          onChange={(e) => handleMetricChange(member.id!, 'referrals', e.target.value)}
                          className="w-16 px-2 py-1 text-center border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          value={metrics.tyfcb || 0}
                          onChange={(e) => handleMetricChange(member.id!, 'tyfcb', e.target.value)}
                          className="w-16 px-2 py-1 text-center border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          value={metrics.visitors || 0}
                          onChange={(e) => handleMetricChange(member.id!, 'visitors', e.target.value)}
                          className="w-16 px-2 py-1 text-center border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-medium text-lg">{total}</span>
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
  );
}
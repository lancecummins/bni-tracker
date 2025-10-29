'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { scoreService, userService } from '@/lib/firebase/services';
import { ScoreMetrics, Score, User, Session, Settings, AwardedCustomBonus } from '@/lib/types';
import { Save, AlertCircle, CheckCircle, Trophy, Zap, User as UserIcon, Gift, X, Eye, Calendar } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { Avatar } from '@/components/Avatar';
import Image from 'next/image';
import { useSessionScores } from '@/lib/firebase/hooks/useScores';
import { clearStaticDataCache } from '@/lib/firebase/hooks/useStaticData';
import toast from 'react-hot-toast';
import { useAllSessions } from '@/lib/firebase/hooks';

interface UserAllocation {
  userId: string;
  user: User;
  points: number;
  customText: string;
}

export default function LanceScoringPage() {
  const [lanceUser, setLanceUser] = useState<User | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const { sessions: allSessions } = useAllSessions();

  const [editedScore, setEditedScore] = useState<ScoreMetrics>({
    attendance: 0,
    one21s: 0,
    referrals: 0,
    tyfcb: 0,
    visitors: 0,
  });

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isSaved, setIsSaved] = useState(true);
  const [tempInputs, setTempInputs] = useState<Record<string, string>>({});

  // Allocation state
  const [allocations, setAllocations] = useState<UserAllocation[]>([]);
  const [savingAllocations, setSavingAllocations] = useState(false);
  const [allocationsSaved, setAllocationsSaved] = useState(false);

  const { scores: sessionScores } = useSessionScores(selectedSession?.id || null);

  // Set selected session when sessions load
  useEffect(() => {
    if (allSessions.length > 0 && !selectedSessionId) {
      // Default to the active session
      const activeSession = allSessions.find(s => s.status === 'open');
      if (activeSession) {
        setSelectedSessionId(activeSession.id!);
      }
    }
  }, [allSessions, selectedSessionId]);

  // Update selected session when ID changes
  useEffect(() => {
    if (selectedSessionId) {
      const session = allSessions.find(s => s.id === selectedSessionId) || null;
      setSelectedSession(session);
    } else {
      setSelectedSession(null);
    }
  }, [selectedSessionId, allSessions]);

  // Load saved allocations when session is loaded
  useEffect(() => {
    if (selectedSession?.id) {
      const saved = localStorage.getItem(`lance-allocations-${selectedSession.id}`);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          // Reconstruct allocations with user objects
          const reconstructed = data.allocations.map((a: any) => {
            const user = allUsers.find(u => u.id === a.userId);
            return user ? { userId: a.userId, user, points: a.points, customText: a.customText } : null;
          }).filter(Boolean);
          setAllocations(reconstructed);
        } catch (error) {
          console.error('Error loading saved allocations:', error);
        }
      } else {
        setAllocations([]);
      }
    }
  }, [selectedSession?.id, allUsers]);

  // Load all data directly from Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load Lance's user account
        const usersQuery = query(
          collection(db, 'users'),
          where('email', '==', 'lance@nectafy.com')
        );
        const usersSnapshot = await getDocs(usersQuery);

        if (usersSnapshot.empty) {
          console.error('Lance user not found');
          setLoading(false);
          return;
        }

        const userData = { id: usersSnapshot.docs[0].id, ...usersSnapshot.docs[0].data() } as User;
        setLanceUser(userData);

        // Load settings
        const settingsSnapshot = await getDocs(collection(db, 'settings'));
        if (!settingsSnapshot.empty) {
          const settingsData = { id: settingsSnapshot.docs[0].id, ...settingsSnapshot.docs[0].data() } as Settings;
          setSettings(settingsData);
        }

        // Load all users for allocation
        const allUsersSnapshot = await getDocs(collection(db, 'users'));
        const allUsersData = allUsersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
        const otherUsers = allUsersData.filter(u => u.email !== 'lance@nectafy.com');
        console.log('Loaded users for allocation:', otherUsers.length);
        setAllUsers(otherUsers);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Load score when session changes
  useEffect(() => {
    const loadScore = async () => {
      if (selectedSession?.id && lanceUser?.id) {
        const sessionScores = await scoreService.getBySession(selectedSession.id);
        const existingScore = sessionScores.find(s => s.userId === lanceUser.id);

        if (existingScore) {
          setScore(existingScore);
          setEditedScore(existingScore.metrics);
          setIsSaved(true);
        } else {
          setScore(null);
          setEditedScore({
            attendance: 0,
            one21s: 0,
            referrals: 0,
            tyfcb: 0,
            visitors: 0,
          });
          setIsSaved(true);
        }
      }
    };

    loadScore();
  }, [selectedSession?.id, lanceUser?.id]);

  const handleMetricChange = (metric: keyof ScoreMetrics, value: string) => {
    const numValue = parseInt(value) || 0;
    setEditedScore(prev => ({
      ...prev,
      [metric]: numValue,
    }));
    setIsSaved(false);
  };

  const handleSave = async () => {
    if (!selectedSession || !lanceUser) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const scoreData = {
        userId: lanceUser.id!,
        sessionId: selectedSession.id!,
        seasonId: selectedSession.seasonId,
        teamId: lanceUser.teamId || '',
        metrics: editedScore,
        totalPoints: calculateTotal(editedScore),
        isDraft: false,
        enteredBy: 'lance@nectafy.com',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const scoreId = await scoreService.upsert(scoreData);
      setScore({ ...scoreData, id: scoreId });
      setIsSaved(true);
      setSaveMessage({ type: 'success', text: 'Score saved successfully!' });

      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving score:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save score. Please try again.' });
    } finally {
      setSaving(false);
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

  const totalPoints = calculateTotal(editedScore);

  const addAllocation = (user: User) => {
    if (allocations.find(a => a.userId === user.id)) {
      toast.error('User already added');
      return;
    }

    setAllocations(prev => [...prev, {
      userId: user.id!,
      user,
      points: 0,
      customText: '',
    }]);
    setAllocationsSaved(false);
  };

  const updateAllocation = (userId: string, field: 'points' | 'customText', value: number | string) => {
    setAllocations(prev => prev.map(a =>
      a.userId === userId ? { ...a, [field]: field === 'points' ? Math.max(0, value as number) : value } : a
    ));
    setAllocationsSaved(false); // Mark as unsaved when changes are made
  };

  const removeAllocation = (userId: string) => {
    setAllocations(prev => prev.filter(a => a.userId !== userId));
    setAllocationsSaved(false);
  };

  const getTotalAllocated = () => {
    return allocations.reduce((sum, a) => sum + a.points, 0);
  };

  const getRemainingPoints = () => {
    return totalPoints - getTotalAllocated();
  };

  const handleSaveAllocations = async () => {
    if (!selectedSession?.id) {
      toast.error('No session selected');
      return;
    }

    if (allocations.length === 0) {
      toast.error('No allocations to save');
      return;
    }

    if (getRemainingPoints() < 0) {
      toast.error('You have allocated more points than available!');
      return;
    }

    try {
      setSavingAllocations(true);

      // Save allocations to localStorage
      const saveData = {
        sessionId: selectedSession.id,
        lanceScore: editedScore,
        totalPoints: totalPoints,
        allocations: allocations.map(a => ({
          userId: a.userId,
          points: a.points,
          customText: a.customText,
          userName: `${a.user.firstName} ${a.user.lastName}`,
        })),
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem(`lance-allocations-${selectedSession.id}`, JSON.stringify(saveData));
      setAllocationsSaved(true);
      toast.success('Allocations saved!');
    } catch (error) {
      console.error('Error saving allocations:', error);
      toast.error('Failed to save allocations');
      setAllocationsSaved(false);
    } finally {
      setSavingAllocations(false);
    }
  };

  const handleClearAllocations = () => {
    if (confirm('Are you sure you want to clear all allocations?')) {
      setAllocations([]);
      setAllocationsSaved(false);
      if (selectedSession?.id) {
        localStorage.removeItem(`lance-allocations-${selectedSession.id}`);
      }
      toast.success('Allocations cleared');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!lanceUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold">User Not Found</h2>
          <p className="text-gray-600 mt-2">Lance's account not found in the system.</p>
        </div>
      </div>
    );
  }

  if (allSessions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold">No Sessions Available</h2>
          <p className="text-gray-600 mt-2">Please wait for a session to be created.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-sm p-3 md:p-6 md:rounded-lg md:mx-4 md:mt-8 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* BNI Game Logo */}
              <div className="flex-shrink-0">
                <Image
                  src="/bni-game-logo.png"
                  alt="BNI Game"
                  width={80}
                  height={80}
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                  Admin Scoring
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Lance's Personal Score & Allocations
                </p>
              </div>
            </div>
          </div>

          {/* Session Selector */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Calendar size={16} />
              Select Session
            </label>
            <select
              value={selectedSessionId || ''}
              onChange={(e) => setSelectedSessionId(e.target.value || null)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="">Select a session...</option>
              {allSessions.filter(s => !s.isArchived).map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name || `Week ${session.weekNumber}`} - {new Date(session.date.seconds * 1000).toLocaleDateString()}
                  {session.status === 'open' ? ' (Active)' : ''}
                </option>
              ))}
            </select>
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

        {/* Score Summary */}
        <div className="grid grid-cols-2 gap-2 md:gap-4 mb-4 md:mb-6 px-2 md:mx-4">
          {/* Current Score */}
          <div className="bg-white rounded-lg shadow-sm p-3 md:p-6">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 md:gap-2 text-gray-600 mb-1">
                <UserIcon size={18} />
                <span className="text-xs md:text-sm font-medium">Your Score</span>
              </div>
              <p className="text-2xl md:text-4xl font-bold text-gray-900">{totalPoints}</p>
              <p className="text-xs text-gray-500 mt-1">Total Points</p>
            </div>
          </div>

          {/* Saved Score */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-sm p-3 md:p-6 text-white">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 md:gap-2 mb-1">
                <Trophy size={18} />
                <span className="text-xs md:text-sm font-medium">Saved Score</span>
              </div>
              <p className="text-2xl md:text-4xl font-bold">{score ? calculateTotal(score.metrics) : 0}</p>
              <p className="text-xs text-white/80 mt-1">Last Saved</p>
            </div>
          </div>
        </div>

        {/* Scoring Card */}
        <div className="px-4 md:mx-4">
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
            {/* User Info */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
              <Avatar
                src={lanceUser.avatarUrl}
                fallbackSeed={`${lanceUser.firstName}${lanceUser.lastName}`}
                size="lg"
              />
              <div className="flex-1">
                <p className="text-xl font-semibold text-gray-900">
                  {lanceUser.firstName} {lanceUser.lastName}
                </p>
                <p className="text-sm text-gray-500">Site Administrator</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-3xl font-bold text-blue-600">{totalPoints}</p>
              </div>
            </div>

            {/* Scoring Grid */}
            <div className="space-y-4">
              {/* Attendance */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Attendance ({settings?.pointValues.attendance || 0} pts each)
                </label>
                <button
                  onClick={() => handleMetricChange('attendance', editedScore.attendance === 1 ? '0' : '1')}
                  className={`w-full py-4 rounded-lg text-base font-medium transition-colors flex items-center justify-center gap-2 ${
                    editedScore.attendance === 1
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                    editedScore.attendance === 1
                      ? 'bg-white border-white'
                      : 'bg-white border-gray-400'
                  }`}>
                    {editedScore.attendance === 1 && (
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  Present
                </button>
              </div>

              {/* 1-2-1s */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  1-2-1s ({settings?.pointValues.one21s || 0} pts each)
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(val => (
                    <button
                      key={val}
                      onClick={() => {
                        const newVal = editedScore.one21s === val ? '0' : val.toString();
                        handleMetricChange('one21s', newVal);
                      }}
                      className={`flex-1 py-3 rounded-lg text-base font-medium transition-colors ${
                        editedScore.one21s === val
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={tempInputs.one21s ?? (editedScore.one21s > 5 ? editedScore.one21s : '')}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setTempInputs(prev => ({ ...prev, one21s: val }));
                      const num = parseInt(val) || 0;
                      if (num === 0 || num >= 6) {
                        handleMetricChange('one21s', val || '0');
                      }
                    }}
                    onBlur={(e) => {
                      const numVal = parseInt(e.target.value) || 0;
                      if (numVal > 0 && numVal < 6) {
                        handleMetricChange('one21s', '0');
                      }
                      setTempInputs(prev => {
                        const copy = { ...prev };
                        delete copy.one21s;
                        return copy;
                      });
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="6+"
                    className="w-20 px-3 py-3 text-center border-2 rounded-lg text-base"
                  />
                </div>
              </div>

              {/* Referrals */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Referrals ({settings?.pointValues.referrals || 0} pts each)
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(val => (
                    <button
                      key={val}
                      onClick={() => {
                        const newVal = editedScore.referrals === val ? '0' : val.toString();
                        handleMetricChange('referrals', newVal);
                      }}
                      className={`flex-1 py-3 rounded-lg text-base font-medium transition-colors ${
                        editedScore.referrals === val
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={tempInputs.referrals ?? (editedScore.referrals > 5 ? editedScore.referrals : '')}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setTempInputs(prev => ({ ...prev, referrals: val }));
                      const num = parseInt(val) || 0;
                      if (num === 0 || num >= 6) {
                        handleMetricChange('referrals', val || '0');
                      }
                    }}
                    onBlur={(e) => {
                      const numVal = parseInt(e.target.value) || 0;
                      if (numVal > 0 && numVal < 6) {
                        handleMetricChange('referrals', '0');
                      }
                      setTempInputs(prev => {
                        const copy = { ...prev };
                        delete copy.referrals;
                        return copy;
                      });
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="6+"
                    className="w-20 px-3 py-3 text-center border-2 rounded-lg text-base"
                  />
                </div>
              </div>

              {/* TYFCB */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  TYFCB ({settings?.pointValues.tyfcb || 0} pts each)
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(val => (
                    <button
                      key={val}
                      onClick={() => {
                        const newVal = editedScore.tyfcb === val ? '0' : val.toString();
                        handleMetricChange('tyfcb', newVal);
                      }}
                      className={`flex-1 py-3 rounded-lg text-base font-medium transition-colors ${
                        editedScore.tyfcb === val
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={tempInputs.tyfcb ?? (editedScore.tyfcb > 5 ? editedScore.tyfcb : '')}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setTempInputs(prev => ({ ...prev, tyfcb: val }));
                      const num = parseInt(val) || 0;
                      if (num === 0 || num >= 6) {
                        handleMetricChange('tyfcb', val || '0');
                      }
                    }}
                    onBlur={(e) => {
                      const numVal = parseInt(e.target.value) || 0;
                      if (numVal > 0 && numVal < 6) {
                        handleMetricChange('tyfcb', '0');
                      }
                      setTempInputs(prev => {
                        const copy = { ...prev };
                        delete copy.tyfcb;
                        return copy;
                      });
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="6+"
                    className="w-20 px-3 py-3 text-center border-2 rounded-lg text-base"
                  />
                </div>
              </div>

              {/* Visitors */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Visitors ({settings?.pointValues.visitors || 0} pts each)
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(val => (
                    <button
                      key={val}
                      onClick={() => {
                        const newVal = editedScore.visitors === val ? '0' : val.toString();
                        handleMetricChange('visitors', newVal);
                      }}
                      className={`flex-1 py-3 rounded-lg text-base font-medium transition-colors ${
                        editedScore.visitors === val
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={tempInputs.visitors ?? (editedScore.visitors > 5 ? editedScore.visitors : '')}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setTempInputs(prev => ({ ...prev, visitors: val }));
                      const num = parseInt(val) || 0;
                      if (num === 0 || num >= 6) {
                        handleMetricChange('visitors', val || '0');
                      }
                    }}
                    onBlur={(e) => {
                      const numVal = parseInt(e.target.value) || 0;
                      if (numVal > 0 && numVal < 6) {
                        handleMetricChange('visitors', '0');
                      }
                      setTempInputs(prev => {
                        const copy = { ...prev };
                        delete copy.visitors;
                        return copy;
                      });
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="6+"
                    className="w-20 px-3 py-3 text-center border-2 rounded-lg text-base"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="mt-6 pt-6 border-t">
                <button
                  onClick={handleSave}
                  disabled={saving || isSaved}
                  className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all ${
                    isSaved
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : saving
                      ? 'bg-blue-300 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  <div className="flex items-center justify-center gap-3">
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        <span>Saving...</span>
                      </>
                    ) : isSaved ? (
                      <>
                        <CheckCircle size={20} />
                        <span>Saved</span>
                      </>
                    ) : (
                      <>
                        <Save size={20} />
                        <span>Save Score</span>
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Point Allocation Section */}
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mt-4">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Gift className="text-purple-600" />
              Allocate Points to Users
            </h2>

            {/* Points Summary */}
            <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-xs text-gray-500">Available</p>
                <p className="text-lg font-bold text-gray-900">{totalPoints}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Allocated</p>
                <p className="text-lg font-bold text-blue-600">{getTotalAllocated()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Remaining</p>
                <p className={`text-lg font-bold ${getRemainingPoints() < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {getRemainingPoints()}
                </p>
              </div>
            </div>

            {/* Add User Dropdown */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select User to Add ({allUsers.length} users available)
              </label>
              <select
                onChange={(e) => {
                  console.log('Selected user ID:', e.target.value);
                  const user = allUsers.find(u => u.id === e.target.value);
                  console.log('Found user:', user);
                  if (user) {
                    addAllocation(user);
                    e.target.value = '';
                  }
                }}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue=""
              >
                <option value="" disabled>Choose a user...</option>
                {allUsers.length === 0 ? (
                  <option disabled>Loading users...</option>
                ) : (
                  allUsers
                    .filter(u => !allocations.find(a => a.userId === u.id))
                    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
                    .map(user => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName}
                      </option>
                    ))
                )}
              </select>
            </div>

            {/* Allocations List */}
            <div className="space-y-3 mb-4">
              {allocations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <UserIcon size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No allocations yet. Select users above to allocate points.</p>
                </div>
              ) : (
                allocations.map(allocation => (
                  <div
                    key={allocation.userId}
                    className="border rounded-lg p-3 bg-gray-50"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar
                        src={allocation.user.avatarUrl}
                        fallbackSeed={`${allocation.user.firstName}${allocation.user.lastName}`}
                        size="sm"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {allocation.user.firstName} {allocation.user.lastName}
                        </div>
                      </div>
                      <button
                        onClick={() => removeAllocation(allocation.userId)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Points
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={allocation.points}
                          onChange={(e) => updateAllocation(allocation.userId, 'points', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter points"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Custom Message (shown on Referee page)
                        </label>
                        <input
                          type="text"
                          value={allocation.customText}
                          onChange={(e) => updateAllocation(allocation.userId, 'customText', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Extra effort bonus, Great referral work, etc."
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Save/Clear Buttons */}
            {allocations.length > 0 && (
              <div className="space-y-2">
                {allocationsSaved && (
                  <div className="p-4 bg-green-100 border-2 border-green-400 rounded-lg flex items-center gap-3">
                    <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
                    <div>
                      <p className="font-semibold text-green-800">Allocations Saved!</p>
                      <p className="text-sm text-green-700">
                        Ready to reveal on the Referee page during the game
                      </p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSaveAllocations}
                  disabled={savingAllocations || getRemainingPoints() < 0 || (allocationsSaved && allocations.length > 0)}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    savingAllocations
                      ? 'bg-blue-300 text-white'
                      : allocationsSaved
                      ? 'bg-green-100 text-green-700 border-2 border-green-400'
                      : getRemainingPoints() < 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {savingAllocations ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Saving...</span>
                    </>
                  ) : allocationsSaved ? (
                    <>
                      <CheckCircle size={20} />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Save size={20} />
                      <span>Save Allocations</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleClearAllocations}
                  className="w-full py-2 px-4 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                >
                  <X size={18} />
                  <span>Clear All</span>
                </button>

                {!allocationsSaved && (
                  <p className="text-xs text-gray-500 text-center">
                    Saved allocations will appear on the Referee page for you to reveal during the game.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

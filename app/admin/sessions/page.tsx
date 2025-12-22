'use client';

import { useState, useEffect } from 'react';
import { sessionService, scoreService } from '@/lib/firebase/services';
import { Session, Score, Season } from '@/lib/types';
import { Calendar, Clock, CheckCircle, XCircle, BarChart2, Users, Archive, ArrowUpDown, Filter, Eye, EyeOff, Monitor, Edit2, PlayCircle, X, ChevronDown, ChevronRight, TrendingUp } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useActiveSession, useActiveSeason, useSeasons } from '@/lib/firebase/hooks';

type SortBy = 'date' | 'week' | 'status' | 'points';
type SortOrder = 'asc' | 'desc';

export default function SessionsPage() {
  const { session: activeSession } = useActiveSession();
  const { season: activeSeason } = useActiveSeason();
  const { seasons } = useSeasons();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionScores, setSessionScores] = useState<Record<string, Score[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionDate, setSessionDate] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);

  // Auto-expand active season when it loads
  useEffect(() => {
    if (activeSeason?.id && !expandedSeasons.has(activeSeason.id)) {
      setExpandedSeasons(new Set([activeSeason.id]));
    }
  }, [activeSeason]);

  useEffect(() => {
    loadSessions();
  }, []);

  // Set default date and name when modal opens
  useEffect(() => {
    if (showSessionModal) {
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0];
      setSessionDate(formattedDate);

      // Set default name
      const weekNumber = sessions.length + 1;
      const defaultName = formatSessionName(weekNumber, today);
      setSessionName(defaultName);
    }
  }, [showSessionModal, sessions.length]);

  const formatSessionName = (weekNumber: number, date: Date) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `Week ${weekNumber} - ${month} ${day}, ${year}`;
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      const allSessions = await sessionService.getAll();
      setSessions(allSessions);

      // Load scores for each session
      const scoresMap: Record<string, Score[]> = {};
      for (const session of allSessions) {
        if (session.id) {
          const scores = await scoreService.getBySession(session.id);
          scoresMap[session.id] = scores;
        }
      }
      setSessionScores(scoresMap);
    } catch (error) {
      console.error('Error loading sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleReopenSession = async (sessionId: string) => {
    try {
      await sessionService.open(sessionId);
      toast.success('Session reopened');
      loadSessions();
    } catch (error) {
      console.error('Error reopening session:', error);
      toast.error('Failed to reopen session');
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    try {
      await sessionService.close(sessionId);
      toast.success('Session closed');
      loadSessions();
    } catch (error) {
      console.error('Error closing session:', error);
      toast.error('Failed to close session');
    }
  };

  const handleArchiveSession = async (sessionId: string, archive: boolean) => {
    try {
      await sessionService.archive(sessionId, archive);
      toast.success(archive ? 'Session archived' : 'Session unarchived');
      loadSessions();
    } catch (error) {
      console.error('Error archiving session:', error);
      toast.error('Failed to archive session');
    }
  };

  const handleStartEdit = (session: Session) => {
    setEditingSession(session.id!);
    setEditingName(session.name || `Week ${session.weekNumber}`);
  };

  const handleCancelEdit = () => {
    setEditingSession(null);
    setEditingName('');
  };

  const handleSaveEdit = async (sessionId: string) => {
    try {
      await sessionService.update(sessionId, { name: editingName });
      toast.success('Session renamed');
      setEditingSession(null);
      setEditingName('');
      loadSessions();
    } catch (error) {
      console.error('Error renaming session:', error);
      toast.error('Failed to rename session');
    }
  };

  const handleCreateSession = async () => {
    if (!sessionDate) {
      toast.error('Please select a date');
      return;
    }

    if (!sessionName.trim()) {
      toast.error('Please enter a session name');
      return;
    }

    if (!activeSeason?.id) {
      toast.error('No active season found. Please create a season first.');
      return;
    }

    try {
      setCreatingSession(true);

      const selectedDate = new Date(sessionDate + 'T12:00:00'); // Set to noon to avoid timezone issues

      // Calculate week number based on existing sessions
      const weekNumber = sessions.length + 1;

      const newSession: Omit<Session, 'id'> = {
        name: sessionName.trim(),
        seasonId: activeSeason.id,
        weekNumber: weekNumber,
        date: Timestamp.fromDate(selectedDate),
        status: 'open',
        createdBy: 'admin-user-id', // Should come from auth
        createdAt: Timestamp.now(),
      };

      await sessionService.create(newSession);

      toast.success(`Session opened: ${sessionName}`);

      setShowSessionModal(false);
      setSessionDate('');
      setSessionName('');
      loadSessions();
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('Failed to open session');
    } finally {
      setCreatingSession(false);
    }
  };

  const handleCloseActiveSession = async () => {
    if (!activeSession?.id) return;

    try {
      await sessionService.close(activeSession.id);
      toast.success('Session closed successfully!');
      loadSessions();
    } catch (error) {
      console.error('Error closing session:', error);
      toast.error('Failed to close session');
    }
  };

  const getSessionStats = (sessionId: string) => {
    const scores = sessionScores[sessionId] || [];
    const totalPoints = scores.reduce((sum, score) => sum + score.totalPoints, 0);
    const avgPoints = scores.length > 0 ? Math.round(totalPoints / scores.length) : 0;
    const attendance = scores.filter(s => s.metrics.attendance > 0).length;

    return {
      participants: scores.length,
      totalPoints,
      avgPoints,
      attendance,
    };
  };

  const getTopPerformers = (sessionId: string) => {
    const scores = sessionScores[sessionId] || [];
    return scores
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 3);
  };

  // Filter and sort sessions
  const filteredAndSortedSessions = sessions
    .filter(session => showArchived || !session.isArchived)
    .sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = (a.date?.seconds || 0) - (b.date?.seconds || 0);
          break;
        case 'week':
          comparison = a.weekNumber - b.weekNumber;
          break;
        case 'status':
          const statusOrder = { 'open': 0, 'draft': 1, 'closed': 2 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        case 'points':
          const aStats = getSessionStats(a.id!);
          const bStats = getSessionStats(b.id!);
          comparison = aStats.totalPoints - bStats.totalPoints;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const toggleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const toggleSeasonExpanded = (seasonId: string) => {
    const newExpanded = new Set(expandedSeasons);
    if (newExpanded.has(seasonId)) {
      newExpanded.delete(seasonId);
    } else {
      newExpanded.add(seasonId);
    }
    setExpandedSeasons(newExpanded);
  };

  // Group sessions by season
  // Map old 'season-id' to the active season if it exists
  const sessionsBySeason = sessions.reduce((acc, session) => {
    let seasonId = session.seasonId || 'unknown';

    // Migrate old hardcoded 'season-id' to active season
    if (seasonId === 'season-id' && activeSeason?.id) {
      seasonId = activeSeason.id;
    }

    if (!acc[seasonId]) {
      acc[seasonId] = [];
    }
    acc[seasonId].push(session);
    return acc;
  }, {} as Record<string, Session[]>);

  // Sort seasons (active first, then by date)
  const sortedSeasons = [...seasons].sort((a, b) => {
    if (a.isActive) return -1;
    if (b.isActive) return 1;
    return (b.startDate?.seconds || 0) - (a.startDate?.seconds || 0);
  });

  // Debug logging
  console.log('[Sessions] Total sessions:', sessions.length);
  console.log('[Sessions] Total seasons:', seasons.length);
  console.log('[Sessions] Sessions by season:', sessionsBySeason);
  console.log('[Sessions] Sorted seasons:', sortedSeasons);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Session History</h1>
            <p className="text-gray-600 mt-1">View and manage past scoring sessions</p>
          </div>

          {/* Session Control Buttons */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar size={20} />
              {filteredAndSortedSessions.length} of {sessions.length} Sessions
            </div>

            {activeSession ? (
              <button
                onClick={handleCloseActiveSession}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Clock size={20} />
                Close Session
              </button>
            ) : (
              <button
                onClick={() => setShowSessionModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlayCircle size={20} />
                Open Session
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters and Sorting */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          {/* Archive Toggle */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showArchived
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {showArchived ? <Eye size={18} /> : <EyeOff size={18} />}
            {showArchived ? 'Showing Archived' : 'Hide Archived'}
          </button>

          {/* Sorting Options */}
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-500">Sort by:</span>
            <div className="flex gap-2">
              {(['date', 'week', 'status', 'points'] as SortBy[]).map((field) => (
                <button
                  key={field}
                  onClick={() => toggleSort(field)}
                  className={`px-3 py-1 rounded-lg text-sm capitalize transition-colors ${
                    sortBy === field
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {field}
                  {sortBy === field && (
                    <span className="ml-1">
                      {sortOrder === 'desc' ? '↓' : '↑'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sessions List - Grouped by Season */}
      <div className="space-y-6">
        {sessions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No sessions found. Create your first session to get started!</p>
          </div>
        ) : seasons.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="mb-4">
              <p className="text-gray-900 font-semibold mb-2">No seasons found</p>
              <p className="text-gray-500">You need to create a season before sessions can be displayed.</p>
            </div>
            <a
              href="/admin/migrate-season"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Run Migration to Create Initial Season
            </a>
          </div>
        ) : (
          sortedSeasons.map((season) => {
            const seasonSessions = (sessionsBySeason[season.id!] || [])
              .filter(session => showArchived || !session.isArchived)
              .sort((a, b) => {
                let comparison = 0;
                switch (sortBy) {
                  case 'date':
                    comparison = (a.date?.seconds || 0) - (b.date?.seconds || 0);
                    break;
                  case 'week':
                    comparison = a.weekNumber - b.weekNumber;
                    break;
                  case 'status':
                    const statusOrder = { 'open': 0, 'draft': 1, 'closed': 2 };
                    comparison = statusOrder[a.status] - statusOrder[b.status];
                    break;
                  case 'points':
                    const aStats = getSessionStats(a.id!);
                    const bStats = getSessionStats(b.id!);
                    comparison = aStats.totalPoints - bStats.totalPoints;
                    break;
                }
                return sortOrder === 'asc' ? comparison : -comparison;
              });

            if (seasonSessions.length === 0 && !showArchived) return null;

            const isExpanded = expandedSeasons.has(season.id!);
            const totalSessions = seasonSessions.length;
            const closedSessions = seasonSessions.filter(s => s.status === 'closed').length;

            return (
              <div key={season.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Season Header */}
                <div
                  className={`p-4 cursor-pointer transition-colors border-l-4 ${
                    season.isActive
                      ? 'bg-gradient-to-r from-green-50 to-blue-50 border-green-500'
                      : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                  }`}
                  onClick={() => toggleSeasonExpanded(season.id!)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      <TrendingUp size={20} className={season.isActive ? 'text-green-600' : 'text-gray-400'} />
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          {season.name}
                          {season.isActive && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                              Active
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {season.startDate && new Date(season.startDate.seconds * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          {' - '}
                          {season.endDate && new Date(season.endDate.seconds * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <p className="text-gray-500">Sessions</p>
                        <p className="font-semibold text-gray-900">{totalSessions}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500">Closed</p>
                        <p className="font-semibold text-gray-900">{closedSessions}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500">Weeks</p>
                        <p className="font-semibold text-gray-900">{season.weekCount}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Season Sessions (nested) */}
                {isExpanded && (
                  <div className="border-t">
                    {seasonSessions.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        No sessions in this season yet.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {seasonSessions.map((session) => {
            const stats = getSessionStats(session.id!);
            const isExpanded = expandedSession === session.id;
            const topPerformers = getTopPerformers(session.id!);

            return (
              <div key={session.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Session Header */}
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedSession(isExpanded ? null : session.id || null)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-3 rounded-lg ${
                          session.status === 'closed'
                            ? 'bg-gray-100 text-gray-600'
                            : session.status === 'open'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-yellow-100 text-yellow-600'
                        }`}
                      >
                        <Calendar size={24} />
                      </div>
                      <div className="flex-1">
                        {editingSession === session.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                              autoFocus
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEdit(session.id!);
                              }}
                              className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelEdit();
                              }}
                              className="px-3 py-1 bg-gray-400 text-white rounded-lg hover:bg-gray-500 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">
                              {session.name || `Week ${session.weekNumber}`}
                            </h3>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(session);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Rename session"
                            >
                              <Edit2 size={16} />
                            </button>
                          </div>
                        )}
                        <p className="text-gray-600">
                          {session.date &&
                            new Date(session.date.seconds * 1000).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Session Stats */}
                      <div className="flex gap-6 text-sm">
                        <div className="text-center">
                          <p className="text-gray-500">Participants</p>
                          <p className="text-xl font-semibold">{stats.participants}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500">Total Points</p>
                          <p className="text-xl font-semibold">{stats.totalPoints}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500">Avg Points</p>
                          <p className="text-xl font-semibold">{stats.avgPoints}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500">Attendance</p>
                          <p className="text-xl font-semibold">{stats.attendance}</p>
                        </div>
                      </div>

                      {/* Status Badge and Archive Indicator */}
                      <div className="flex items-center gap-2">
                        {session.isArchived && (
                          <span className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                            <Archive size={16} />
                            Archived
                          </span>
                        )}
                        {session.status === 'closed' ? (
                          <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                            <CheckCircle size={16} />
                            Closed
                          </span>
                        ) : session.status === 'open' ? (
                          <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                            <Clock size={16} />
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                            <Clock size={16} />
                            Draft
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t bg-gray-50">
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Top Performers */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                            <BarChart2 size={18} />
                            Top Performers
                          </h4>
                          {topPerformers.length === 0 ? (
                            <p className="text-gray-500 text-sm">No scores recorded</p>
                          ) : (
                            <div className="space-y-2">
                              {topPerformers.map((score, index) => (
                                <div
                                  key={score.id}
                                  className="flex items-center justify-between p-2 bg-white rounded"
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                                        index === 0
                                          ? 'bg-yellow-500'
                                          : index === 1
                                          ? 'bg-gray-400'
                                          : 'bg-orange-600'
                                      }`}
                                    >
                                      {index + 1}
                                    </div>
                                    <span className="text-sm">User {score.userId.slice(-4)}</span>
                                  </div>
                                  <span className="font-semibold">{score.totalPoints} pts</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Session Actions */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                            <Users size={18} />
                            Session Actions
                          </h4>
                          <div className="space-y-2">
                            {session.status === 'closed' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReopenSession(session.id!);
                                }}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                Reopen Session
                              </button>
                            ) : session.status === 'open' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCloseSession(session.id!);
                                }}
                                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                              >
                                Close Session
                              </button>
                            ) : null}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(session);
                              }}
                              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                              <Edit2 size={18} />
                              Rename Session
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveSession(session.id!, !session.isArchived);
                              }}
                              className={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                                session.isArchived
                                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                                  : 'bg-gray-600 text-white hover:bg-gray-700'
                              }`}
                            >
                              <Archive size={18} />
                              {session.isArchived ? 'Unarchive' : 'Archive'}
                            </button>

                            <button
                              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/display?sessionId=${session.id}`, '_blank');
                              }}
                            >
                              <Monitor size={18} />
                              View Display
                            </button>

                            <button
                              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/admin/sessions/${session.id}/metrics`, '_blank');
                              }}
                            >
                              <BarChart2 size={18} />
                              View Metrics Grid
                            </button>

                            <button
                              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Implement export functionality
                                toast.success('Export feature coming soon!');
                              }}
                            >
                              Export to CSV
                            </button>
                          </div>

                          {/* Session Metadata */}
                          <div className="mt-4 p-3 bg-white rounded text-sm text-gray-600">
                            <p>Created: {session.createdAt && new Date(session.createdAt.seconds * 1000).toLocaleString()}</p>
                            {session.closedAt && (
                              <p>Closed: {new Date(session.closedAt.seconds * 1000).toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Session Creation Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Create New Session</h2>
              <button
                onClick={() => {
                  setShowSessionModal(false);
                  setSessionDate('');
                  setSessionName('');
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => {
                      setSessionDate(e.target.value);
                      // Update default name when date changes
                      if (e.target.value) {
                        const weekNumber = sessions.length + 1;
                        const newName = formatSessionName(weekNumber, new Date(e.target.value + 'T12:00:00'));
                        setSessionName(newName);
                      }
                    }}
                    className="w-full px-4 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Name
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Enter session name"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Customize the name that will be displayed for this session
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateSession}
                  disabled={!sessionDate || creatingSession}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingSession ? 'Creating...' : 'Create Session'}
                </button>
                <button
                  onClick={() => {
                    setShowSessionModal(false);
                    setSessionDate('');
                    setSessionName('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
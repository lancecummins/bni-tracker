'use client';

import { useState, useEffect } from 'react';
import { sessionService, scoreService } from '@/lib/firebase/services';
import { Session, Score } from '@/lib/types';
import { Calendar, Clock, CheckCircle, XCircle, BarChart2, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionScores, setSessionScores] = useState<Record<string, Score[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

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
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar size={20} />
            {sessions.length} Total Sessions
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        {sessions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No sessions found</p>
          </div>
        ) : (
          sessions.map((session) => {
            const stats = getSessionStats(session.id!);
            const isExpanded = expandedSession === session.id;
            const topPerformers = getTopPerformers(session.id!);

            return (
              <div key={session.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Session Header */}
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedSession(isExpanded ? null : session.id)}
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
                      <div>
                        <h3 className="text-lg font-semibold">
                          Week {session.weekNumber}
                        </h3>
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

                      {/* Status Badge */}
                      <div className="flex items-center gap-2">
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
          })
        )}
      </div>
    </div>
  );
}
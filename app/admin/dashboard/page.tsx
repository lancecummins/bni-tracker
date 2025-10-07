'use client';

import { useEffect, useState } from 'react';
import {
  useActiveSession,
  useUsers,
  useTeams,
  useSessionScores,
  useSeasonSessions
} from '@/lib/firebase/hooks';
import { sessionService } from '@/lib/firebase/services';
import { Session } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import {
  PlayCircle,
  StopCircle,
  UserCheck,
  Trophy,
  TrendingUp,
  Clock,
  AlertCircle,
  Calendar,
  X
} from 'lucide-react';

export default function AdminDashboard() {
  const { session: activeSession, loading: sessionLoading } = useActiveSession();
  const { users, loading: usersLoading } = useUsers();
  const { teams, loading: teamsLoading } = useTeams();
  const { scores, loading: scoresLoading } = useSessionScores(activeSession?.id || null);
  const { sessions: allSessions } = useSeasonSessions('season-id'); // Should come from active season

  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionDate, setSessionDate] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);

  const loading = sessionLoading || usersLoading || teamsLoading || scoresLoading;

  const activeUsers = users.filter(u => u.isActive);
  const scoringEligibleUsers = users.filter(u => u.isActive && u.role === 'member');
  const scoresEntered = scores.length;
  const attendanceRate = scoringEligibleUsers.length > 0
    ? Math.round((scoresEntered / scoringEligibleUsers.length) * 100)
    : 0;

  // Set default date to today when modal opens
  useEffect(() => {
    if (showSessionModal) {
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0];
      setSessionDate(formattedDate);
    }
  }, [showSessionModal]);

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

  const handleCreateSession = async () => {
    if (!sessionDate) {
      toast.error('Please select a date');
      return;
    }

    try {
      setCreatingSession(true);

      const selectedDate = new Date(sessionDate + 'T12:00:00'); // Set to noon to avoid timezone issues

      // Calculate week number based on existing sessions
      const weekNumber = allSessions.length + 1;

      const newSession: Omit<Session, 'id'> = {
        seasonId: 'season-id', // This should come from active season
        weekNumber: weekNumber,
        date: Timestamp.fromDate(selectedDate),
        status: 'open',
        createdBy: 'admin-user-id', // Should come from auth
        createdAt: Timestamp.now(),
      };

      await sessionService.create(newSession);

      const sessionName = formatSessionName(weekNumber, selectedDate);
      toast.success(`Session opened: ${sessionName}`);

      setShowSessionModal(false);
      setSessionDate('');
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('Failed to open session');
    } finally {
      setCreatingSession(false);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession?.id) return;

    try {
      await sessionService.close(activeSession.id);
      toast.success('Session closed successfully!');
    } catch (error) {
      console.error('Error closing session:', error);
      toast.error('Failed to close session');
    }
  };

  const getSessionDisplayName = (session: Session | null) => {
    if (!session) return 'No Session';
    if (session.date) {
      const date = session.date.toDate();
      return formatSessionName(session.weekNumber, date);
    }
    return `Week ${session.weekNumber}`;
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
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage sessions and track performance</p>
          </div>

          {/* Session Control */}
          <div className="flex items-center gap-4">
            {activeSession ? (
              <>
                <div className="flex items-center gap-2 text-green-600">
                  <div className="w-3 h-3 bg-green-600 rounded-full animate-pulse"></div>
                  <span className="font-medium">Session Active</span>
                </div>
                <button
                  onClick={handleCloseSession}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <StopCircle size={20} />
                  Close Session
                </button>
              </>
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

      {/* Session Creation Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Create New Session</h2>
              <button
                onClick={() => setShowSessionModal(false)}
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
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full px-4 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                </div>
              </div>

              {sessionDate && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">This session will be created as:</p>
                  <p className="font-medium text-blue-900 mt-1">
                    {formatSessionName(allSessions.length + 1, new Date(sessionDate + 'T12:00:00'))}
                  </p>
                </div>
              )}

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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Active Session"
          value={getSessionDisplayName(activeSession)}
          icon={Clock}
          color={activeSession ? 'green' : 'gray'}
        />
        <StatCard
          title="Active Members"
          value={activeUsers.length.toString()}
          icon={UserCheck}
          color="blue"
        />
        <StatCard
          title="Teams"
          value={teams.length.toString()}
          icon={Trophy}
          color="purple"
        />
        <StatCard
          title="Attendance"
          value={`${attendanceRate}%`}
          icon={TrendingUp}
          color="orange"
        />
      </div>

      {/* Session Info */}
      {activeSession && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Current Session Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Session Name</p>
              <p className="font-medium">{getSessionDisplayName(activeSession)}</p>
            </div>
            <div>
              <p className="text-gray-500">Status</p>
              <p className="font-medium capitalize">{activeSession.status}</p>
            </div>
            <div>
              <p className="text-gray-500">Scores Entered</p>
              <p className="font-medium">{scoresEntered} / {scoringEligibleUsers.length}</p>
            </div>
            <div>
              <p className="text-gray-500">Session Date</p>
              <p className="font-medium">
                {activeSession.date &&
                  new Date(activeSession.date.seconds * 1000).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickActionCard
            title="Enter Scores"
            description="Input weekly scores for members"
            href="/admin/scoring"
            disabled={!activeSession}
          />
          <QuickActionCard
            title="Manage Teams"
            description="View and edit team assignments"
            href="/admin/teams"
          />
          <QuickActionCard
            title="View History"
            description="Browse past sessions and scores"
            href="/admin/sessions"
          />
        </div>
      </div>

      {/* Alert if no active session */}
      {!activeSession && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-yellow-900">No Active Session</p>
              <p className="text-yellow-700 text-sm mt-1">
                Open a new session to start entering scores for this week.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  color
}: {
  title: string;
  value: string;
  icon: any;
  color: string;
}) {
  const colorClasses = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    gray: 'bg-gray-50 text-gray-600',
  }[color] || 'bg-gray-50 text-gray-600';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

// Quick Action Card Component
function QuickActionCard({
  title,
  description,
  href,
  disabled = false
}: {
  title: string;
  description: string;
  href: string;
  disabled?: boolean;
}) {
  const content = (
    <div className={`
      border rounded-lg p-4 transition-all
      ${disabled
        ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
        : 'border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer'
      }
    `}>
      <h3 className="font-medium text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{description}</p>
    </div>
  );

  if (disabled) {
    return content;
  }

  return (
    <a href={href}>
      {content}
    </a>
  );
}
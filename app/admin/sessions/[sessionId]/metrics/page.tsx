'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sessionService, scoreService, userService } from '@/lib/firebase/services';
import { Session, Score, User } from '@/lib/types';
import { ArrowLeft, Download, Users, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface UserWithScore {
  user: User;
  score: Score | null;
}

type SortColumn = 'name' | 'attendance' | 'one21s' | 'referrals' | 'tyfcb' | 'visitors' | 'total';
type SortDirection = 'asc' | 'desc';

export default function SessionMetricsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [usersWithScores, setUsersWithScores] = useState<UserWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>('total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [hideZeroValues, setHideZeroValues] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    attendance: true,
    one21s: true,
    referrals: true,
    tyfcb: true,
    visitors: true,
    total: true,
  });

  useEffect(() => {
    loadData();
  }, [sessionId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load session
      const sessionData = await sessionService.getById(sessionId);
      setSession(sessionData);

      // Load all users
      const allUsers = await userService.getAll();

      // Load scores for this session
      const scores = await scoreService.getBySession(sessionId);

      // Create a map of userId to score
      const scoresMap = new Map<string, Score>();
      scores.forEach(score => {
        scoresMap.set(score.userId, score);
      });

      // Combine users with their scores
      const combined = allUsers.map(user => ({
        user,
        score: scoresMap.get(user.id!) || null,
      }));

      setUsersWithScores(combined);
    } catch (error) {
      console.error('Error loading metrics:', error);
      toast.error('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortedUsers = () => {
    let filtered = [...usersWithScores];

    // Filter out rows where the sorted column value is less than 1
    if (hideZeroValues) {
      filtered = filtered.filter((item) => {
        switch (sortColumn) {
          case 'name':
            return true; // Always show when sorting by name
          case 'attendance':
            return (item.score?.metrics.attendance || 0) >= 1;
          case 'one21s':
            return (item.score?.metrics.one21s || 0) >= 1;
          case 'referrals':
            return (item.score?.metrics.referrals || 0) >= 1;
          case 'tyfcb':
            return (item.score?.metrics.tyfcb || 0) >= 1;
          case 'visitors':
            return (item.score?.metrics.visitors || 0) >= 1;
          case 'total':
            return (item.score?.totalPoints || 0) >= 1;
          default:
            return true;
        }
      });
    }

    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'name':
          const aName = `${a.user.firstName} ${a.user.lastName}`;
          const bName = `${b.user.firstName} ${b.user.lastName}`;
          comparison = aName.localeCompare(bName);
          break;
        case 'attendance':
          comparison = (a.score?.metrics.attendance || 0) - (b.score?.metrics.attendance || 0);
          break;
        case 'one21s':
          comparison = (a.score?.metrics.one21s || 0) - (b.score?.metrics.one21s || 0);
          break;
        case 'referrals':
          comparison = (a.score?.metrics.referrals || 0) - (b.score?.metrics.referrals || 0);
          break;
        case 'tyfcb':
          comparison = (a.score?.metrics.tyfcb || 0) - (b.score?.metrics.tyfcb || 0);
          break;
        case 'visitors':
          comparison = (a.score?.metrics.visitors || 0) - (b.score?.metrics.visitors || 0);
          break;
        case 'total':
          comparison = (a.score?.totalPoints || 0) - (b.score?.totalPoints || 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Attendance', '1-2-1s', 'Referrals', 'TYFCB', 'Visitors', 'Total Points'];
    const rows = usersWithScores.map(({ user, score }) => [
      `${user.firstName} ${user.lastName}`,
      user.email,
      score?.metrics.attendance || 0,
      score?.metrics.one21s || 0,
      score?.metrics.referrals || 0,
      score?.metrics.tyfcb || 0,
      score?.metrics.visitors || 0,
      score?.totalPoints || 0,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session?.name || 'session'}-metrics.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xl text-gray-600">Session not found</p>
          <button
            onClick={() => router.push('/admin/sessions')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin/sessions')}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {session.name || `Week ${session.weekNumber}`} - Metrics
                </h1>
                <p className="text-gray-600 mt-1">
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

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users size={20} />
                {getSortedUsers().length} / {usersWithScores.length} Users
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideZeroValues}
                  onChange={(e) => setHideZeroValues(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span>Hide rows with 0 in sorted column</span>
              </label>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download size={20} />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Column Selector */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-gray-700">Show Columns:</span>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={visibleColumns.attendance}
                onChange={(e) => setVisibleColumns({...visibleColumns, attendance: e.target.checked})}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span>Attendance</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={visibleColumns.one21s}
                onChange={(e) => setVisibleColumns({...visibleColumns, one21s: e.target.checked})}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span>1-2-1s</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={visibleColumns.referrals}
                onChange={(e) => setVisibleColumns({...visibleColumns, referrals: e.target.checked})}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span>Referrals</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={visibleColumns.tyfcb}
                onChange={(e) => setVisibleColumns({...visibleColumns, tyfcb: e.target.checked})}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span>TYFCB</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={visibleColumns.visitors}
                onChange={(e) => setVisibleColumns({...visibleColumns, visitors: e.target.checked})}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span>Visitors</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={visibleColumns.total}
                onChange={(e) => setVisibleColumns({...visibleColumns, total: e.target.checked})}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span>Total Points</span>
            </label>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="bg-white rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 sticky top-0 bg-gray-100 z-10">#</th>
                  <th
                    className={`px-6 py-4 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors sticky top-0 z-10 ${
                      sortColumn === 'name' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      Name
                      {sortColumn === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />
                      ) : (
                        <ArrowUpDown size={16} className="text-gray-400" />
                      )}
                    </div>
                  </th>
                  {visibleColumns.attendance && (
                    <th
                      className={`px-6 py-4 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors sticky top-0 z-10 ${
                        sortColumn === 'attendance' ? 'bg-blue-100' : 'bg-gray-100'
                      }`}
                      onClick={() => handleSort('attendance')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Attendance
                        {sortColumn === 'attendance' ? (
                          sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />
                        ) : (
                          <ArrowUpDown size={16} className="text-gray-400" />
                        )}
                      </div>
                    </th>
                  )}
                  {visibleColumns.one21s && (
                    <th
                      className={`px-6 py-4 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors sticky top-0 z-10 ${
                        sortColumn === 'one21s' ? 'bg-blue-100' : 'bg-gray-100'
                      }`}
                      onClick={() => handleSort('one21s')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        1-2-1s
                        {sortColumn === 'one21s' ? (
                          sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />
                        ) : (
                          <ArrowUpDown size={16} className="text-gray-400" />
                        )}
                      </div>
                    </th>
                  )}
                  {visibleColumns.referrals && (
                    <th
                      className={`px-6 py-4 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors sticky top-0 z-10 ${
                        sortColumn === 'referrals' ? 'bg-blue-100' : 'bg-gray-100'
                      }`}
                      onClick={() => handleSort('referrals')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Referrals
                        {sortColumn === 'referrals' ? (
                          sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />
                        ) : (
                          <ArrowUpDown size={16} className="text-gray-400" />
                        )}
                      </div>
                    </th>
                  )}
                  {visibleColumns.tyfcb && (
                    <th
                      className={`px-6 py-4 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors sticky top-0 z-10 ${
                        sortColumn === 'tyfcb' ? 'bg-blue-100' : 'bg-gray-100'
                      }`}
                      onClick={() => handleSort('tyfcb')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        TYFCB
                        {sortColumn === 'tyfcb' ? (
                          sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />
                        ) : (
                          <ArrowUpDown size={16} className="text-gray-400" />
                        )}
                      </div>
                    </th>
                  )}
                  {visibleColumns.visitors && (
                    <th
                      className={`px-6 py-4 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors sticky top-0 z-10 ${
                        sortColumn === 'visitors' ? 'bg-blue-100' : 'bg-gray-100'
                      }`}
                      onClick={() => handleSort('visitors')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Visitors
                        {sortColumn === 'visitors' ? (
                          sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />
                        ) : (
                          <ArrowUpDown size={16} className="text-gray-400" />
                        )}
                      </div>
                    </th>
                  )}
                  {visibleColumns.total && (
                    <th
                      className={`px-6 py-4 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors sticky top-0 z-10 ${
                        sortColumn === 'total' ? 'bg-blue-100' : 'bg-gray-100'
                      }`}
                      onClick={() => handleSort('total')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Total Points
                        {sortColumn === 'total' ? (
                          sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />
                        ) : (
                          <ArrowUpDown size={16} className="text-gray-400" />
                        )}
                      </div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getSortedUsers().map(({ user, score }, index) => {
                  const isTopThree = index < 3 && (score?.totalPoints || 0) > 0;
                  const hasScore = score !== null;

                  return (
                    <tr
                      key={user.id}
                      className={`
                        ${isTopThree ? 'bg-yellow-50' : hasScore ? 'bg-white' : 'bg-gray-50'}
                        hover:bg-gray-100 transition-colors
                      `}
                    >
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {index === 0 && (score?.totalPoints || 0) > 0 ? (
                          <span className="text-xl">🥇</span>
                        ) : index === 1 && (score?.totalPoints || 0) > 0 ? (
                          <span className="text-xl">🥈</span>
                        ) : index === 2 && (score?.totalPoints || 0) > 0 ? (
                          <span className="text-xl">🥉</span>
                        ) : (
                          index + 1
                        )}
                      </td>
                      <td className={`px-6 py-4 ${sortColumn === 'name' ? 'bg-blue-50' : ''}`}>
                        <div className="flex items-center gap-3">
                          <img
                            src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user.firstName}${user.lastName}`}
                            alt=""
                            className="w-16 h-16 rounded-full object-cover"
                          />
                          <div>
                            <div className="font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                          </div>
                        </div>
                      </td>
                      {visibleColumns.attendance && (
                        <td className={`px-6 py-4 text-center ${sortColumn === 'attendance' ? 'bg-blue-50' : ''}`}>
                          <span className={`text-lg font-semibold ${hasScore ? 'text-gray-900' : 'text-gray-400'}`}>
                            {score?.metrics.attendance || 0}
                          </span>
                        </td>
                      )}
                      {visibleColumns.one21s && (
                        <td className={`px-6 py-4 text-center ${sortColumn === 'one21s' ? 'bg-blue-50' : ''}`}>
                          <span className={`text-lg font-semibold ${hasScore ? 'text-gray-900' : 'text-gray-400'}`}>
                            {score?.metrics.one21s || 0}
                          </span>
                        </td>
                      )}
                      {visibleColumns.referrals && (
                        <td className={`px-6 py-4 text-center ${sortColumn === 'referrals' ? 'bg-blue-50' : ''}`}>
                          <span className={`text-lg font-semibold ${hasScore ? 'text-gray-900' : 'text-gray-400'}`}>
                            {score?.metrics.referrals || 0}
                          </span>
                        </td>
                      )}
                      {visibleColumns.tyfcb && (
                        <td className={`px-6 py-4 text-center ${sortColumn === 'tyfcb' ? 'bg-blue-50' : ''}`}>
                          <span className={`text-lg font-semibold ${hasScore ? 'text-gray-900' : 'text-gray-400'}`}>
                            {score?.metrics.tyfcb || 0}
                          </span>
                        </td>
                      )}
                      {visibleColumns.visitors && (
                        <td className={`px-6 py-4 text-center ${sortColumn === 'visitors' ? 'bg-blue-50' : ''}`}>
                          <span className={`text-lg font-semibold ${hasScore ? 'text-gray-900' : 'text-gray-400'}`}>
                            {score?.metrics.visitors || 0}
                          </span>
                        </td>
                      )}
                      {visibleColumns.total && (
                        <td className={`px-6 py-4 text-center ${sortColumn === 'total' ? 'bg-blue-50' : ''}`}>
                          <span className={`text-xl font-bold ${
                            isTopThree ? 'text-yellow-600' : hasScore ? 'text-gray-900' : 'text-gray-400'
                          }`}>
                            {score?.totalPoints || 0}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {usersWithScores.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p>No users found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

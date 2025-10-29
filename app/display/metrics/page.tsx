'use client';

import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { scoreService, userService } from '@/lib/firebase/services';
import { Score, User } from '@/lib/types';

interface UserWithScore {
  user: User;
  score: Score | null;
}

type SortColumn = 'name' | 'attendance' | 'one21s' | 'referrals' | 'tyfcb' | 'visitors' | 'total';
type SortDirection = 'asc' | 'desc';

interface DisplaySettings {
  sessionId: string;
  visibleColumns: {
    attendance: boolean;
    one21s: boolean;
    referrals: boolean;
    tyfcb: boolean;
    visitors: boolean;
    total: boolean;
  };
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  hideZeroValues: boolean;
}

export default function DisplayMetricsPage() {
  const [settings, setSettings] = useState<DisplaySettings | null>(null);
  const [usersWithScores, setUsersWithScores] = useState<UserWithScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to display settings
    const unsubscribeSettings = onSnapshot(
      doc(db, 'displaySettings', 'metricsView'),
      (doc) => {
        if (doc.exists()) {
          setSettings(doc.data() as DisplaySettings);
        }
      }
    );

    return () => unsubscribeSettings();
  }, []);

  useEffect(() => {
    if (!settings?.sessionId) return;

    loadData();

    // Refresh data every 5 seconds
    const interval = setInterval(loadData, 5000);

    return () => clearInterval(interval);
  }, [settings?.sessionId]);

  // Listen for scroll updates from admin page
  useEffect(() => {
    const eventSource = new EventSource('/api/display');

    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'scroll_update' && typeof data.scrollY === 'number') {
          window.scrollTo({ top: data.scrollY, behavior: 'smooth' });
        } else if (data.type === 'metrics_update') {
          loadData();
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    });

    eventSource.onerror = () => {
      console.error('SSE connection error');
    };

    return () => eventSource.close();
  }, []);

  const loadData = async () => {
    if (!settings?.sessionId) return;

    try {
      const [allUsers, scores] = await Promise.all([
        userService.getAll(),
        scoreService.getBySession(settings.sessionId),
      ]);

      const scoresMap = new Map<string, Score>();
      scores.forEach(score => {
        scoresMap.set(score.userId, score);
      });

      const combined = allUsers.map(user => ({
        user,
        score: scoresMap.get(user.id!) || null,
      }));

      setUsersWithScores(combined);
      setLoading(false);
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  const getSortedUsers = () => {
    if (!settings) return [];

    let filtered = [...usersWithScores];

    // Filter out rows where the sorted column value is less than 1
    if (settings.hideZeroValues) {
      filtered = filtered.filter((item) => {
        switch (settings.sortColumn) {
          case 'name':
            return true;
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

      switch (settings.sortColumn) {
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

      return settings.sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700 border-b-4 border-gray-600">
              <tr>
                <th className="px-8 py-6 text-left text-2xl font-bold text-gray-100">
                  Name
                </th>
                {settings.visibleColumns.attendance && (
                  <th className={`px-8 py-6 text-center text-2xl font-bold ${
                    settings.sortColumn === 'attendance' ? 'text-blue-400' : 'text-gray-100'
                  }`}>
                    Attendance
                  </th>
                )}
                {settings.visibleColumns.one21s && (
                  <th className={`px-8 py-6 text-center text-2xl font-bold ${
                    settings.sortColumn === 'one21s' ? 'text-blue-400' : 'text-gray-100'
                  }`}>
                    1-2-1s
                  </th>
                )}
                {settings.visibleColumns.referrals && (
                  <th className={`px-8 py-6 text-center text-2xl font-bold ${
                    settings.sortColumn === 'referrals' ? 'text-blue-400' : 'text-gray-100'
                  }`}>
                    Referrals
                  </th>
                )}
                {settings.visibleColumns.tyfcb && (
                  <th className={`px-8 py-6 text-center text-2xl font-bold ${
                    settings.sortColumn === 'tyfcb' ? 'text-blue-400' : 'text-gray-100'
                  }`}>
                    TYFCB
                  </th>
                )}
                {settings.visibleColumns.visitors && (
                  <th className={`px-8 py-6 text-center text-2xl font-bold ${
                    settings.sortColumn === 'visitors' ? 'text-blue-400' : 'text-gray-100'
                  }`}>
                    Visitors
                  </th>
                )}
                {settings.visibleColumns.total && (
                  <th className={`px-8 py-6 text-center text-2xl font-bold ${
                    settings.sortColumn === 'total' ? 'text-blue-400' : 'text-gray-100'
                  }`}>
                    Total Points
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {getSortedUsers().map(({ user, score }) => {
                const hasScore = score !== null;

                return (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-750 transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <img
                          src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user.firstName}${user.lastName}`}
                          alt=""
                          className="w-20 h-20 rounded-full object-cover border-4 border-gray-600"
                        />
                        <div className="text-3xl font-bold text-white">
                          {user.firstName} {user.lastName}
                        </div>
                      </div>
                    </td>
                    {settings.visibleColumns.attendance && (
                      <td className="px-8 py-6 text-center">
                        <span className={`text-5xl font-bold ${hasScore ? 'text-white' : 'text-gray-600'}`}>
                          {score?.metrics.attendance || 0}
                        </span>
                      </td>
                    )}
                    {settings.visibleColumns.one21s && (
                      <td className="px-8 py-6 text-center">
                        <span className={`text-5xl font-bold ${hasScore ? 'text-white' : 'text-gray-600'}`}>
                          {score?.metrics.one21s || 0}
                        </span>
                      </td>
                    )}
                    {settings.visibleColumns.referrals && (
                      <td className="px-8 py-6 text-center">
                        <span className={`text-5xl font-bold ${hasScore ? 'text-white' : 'text-gray-600'}`}>
                          {score?.metrics.referrals || 0}
                        </span>
                      </td>
                    )}
                    {settings.visibleColumns.tyfcb && (
                      <td className="px-8 py-6 text-center">
                        <span className={`text-5xl font-bold ${hasScore ? 'text-white' : 'text-gray-600'}`}>
                          {score?.metrics.tyfcb || 0}
                        </span>
                      </td>
                    )}
                    {settings.visibleColumns.visitors && (
                      <td className="px-8 py-6 text-center">
                        <span className={`text-5xl font-bold ${hasScore ? 'text-white' : 'text-gray-600'}`}>
                          {score?.metrics.visitors || 0}
                        </span>
                      </td>
                    )}
                    {settings.visibleColumns.total && (
                      <td className="px-8 py-6 text-center">
                        <span className={`text-6xl font-bold ${hasScore ? 'text-white' : 'text-gray-600'}`}>
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
      </div>
    </div>
  );
}

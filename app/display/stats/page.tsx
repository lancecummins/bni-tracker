'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Trophy,
  TrendingUp,
  Users,
  Crown,
  Award,
  ArrowLeft,
  Calendar,
  Target,
  Zap,
  Star
} from 'lucide-react';
import {
  useSeasonTotals,
  useUsers,
  useTeams,
  useActiveSession,
  useSettings
} from '@/lib/firebase/hooks';
import { Avatar } from '@/components/Avatar';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default function SeasonDashboardPage() {
  const router = useRouter();
  const { session: activeSession } = useActiveSession();
  const { users } = useUsers();
  const { teams } = useTeams();
  const { settings } = useSettings();
  const { userTotals, teamTotals, loading, weekCount, weeklyData } = useSeasonTotals('season-id');

  const totalWeeks = settings?.seasonSettings?.weekCount || 12;
  const progressPercentage = (weekCount / totalWeeks) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  // Get top performers
  const topUsers = userTotals.slice(0, 10);
  const topTeams = teamTotals.slice(0, teams.length);

  // Calculate category leaders
  const categoryLeaders = {
    attendance: { userId: '', total: 0 },
    one21s: { userId: '', total: 0 },
    referrals: { userId: '', total: 0 },
    tyfcb: { userId: '', total: 0 },
    visitors: { userId: '', total: 0 },
  };

  userTotals.forEach(userTotal => {
    Object.keys(categoryLeaders).forEach(category => {
      const catKey = category as keyof typeof categoryLeaders;
      if (userTotal.categoryTotals[catKey] > categoryLeaders[catKey].total) {
        categoryLeaders[catKey] = {
          userId: userTotal.userId,
          total: userTotal.categoryTotals[catKey]
        };
      }
    });
  });

  // Get top 5 users for individual chart
  const topUsersForChart = userTotals.slice(0, 5);
  const chartColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white overflow-hidden">
      <div className="h-full flex flex-col p-4">
        {/* Compact Header - Fixed Height */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <button
            onClick={() => router.push('/display')}
            className="text-white/70 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="text-yellow-400" size={24} />
            Season Dashboard
          </h1>

          {/* Season Progress Bar - Inline */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/70">
              Week {weekCount}/{totalWeeks}
            </span>
            <div className="w-32 bg-white/20 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-green-400 to-blue-500"
              />
            </div>
          </div>
        </div>

        {/* All Individual Users Chart - Full Screen */}
        <div className="flex-1 bg-white/10 backdrop-blur-lg rounded-xl p-4 flex flex-col overflow-hidden">
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <Crown size={20} className="text-yellow-400" />
            All Individual Performance Week Over Week
          </h2>
          <div className="flex-1 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="weekName"
                  stroke="rgba(255,255,255,0.7)"
                  tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 16 }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.7)"
                  tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 14 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value: any, name: any) => {
                    const user = users.find(u => u.id === name);
                    const displayName = user ? `${user.firstName} ${user.lastName}` : name;
                    return [value, displayName];
                  }}
                />
                {userTotals.map((userTotal, index) => {
                  const user = users.find(u => u.id === userTotal.userId);
                  if (!user) return null;
                  // Generate colors for all users
                  const colors = [
                    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1',
                    '#84cc16', '#a855f7', '#22c55e', '#eab308', '#dc2626',
                    '#64748b', '#0ea5e9', '#f43f5e', '#8b5cf6', '#14b8a6'
                  ];
                  return (
                    <Line
                      key={userTotal.userId}
                      type="monotone"
                      dataKey={userTotal.userId}
                      stroke={colors[index % colors.length]}
                      strokeWidth={2}
                      dot={(props: any) => {
                        const { cx, cy, payload, index: dotIndex } = props;
                        if (cx === undefined || cy === undefined) return <g />;

                        return (
                          <g key={`dot-${userTotal.userId}-${dotIndex}`}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={12}
                              fill={colors[index % colors.length]}
                              stroke="white"
                              strokeWidth={2}
                            />
                            {user.avatarUrl ? (
                              <>
                                <defs>
                                  <clipPath id={`clip-${userTotal.userId}-${cx}-${cy}`}>
                                    <circle cx={cx} cy={cy} r={10} />
                                  </clipPath>
                                </defs>
                                <image
                                  x={cx - 10}
                                  y={cy - 10}
                                  width={20}
                                  height={20}
                                  href={user.avatarUrl}
                                  clipPath={`url(#clip-${userTotal.userId}-${cx}-${cy})`}
                                />
                              </>
                            ) : (
                              <text
                                x={cx}
                                y={cy}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill="white"
                                fontSize="10"
                                fontWeight="bold"
                              >
                                {user.firstName[0]}{user.lastName[0]}
                              </text>
                            )}
                            <text
                              x={cx + 20}
                              y={cy}
                              textAnchor="start"
                              dominantBaseline="central"
                              fill="white"
                              fontSize="12"
                              fontWeight="600"
                            >
                              {user.firstName} {user.lastName}
                            </text>
                          </g>
                        );
                      }}
                      name={userTotal.userId}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
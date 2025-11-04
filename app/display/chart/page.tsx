'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trophy, ArrowLeft, Award } from 'lucide-react';
import { useStaticActiveSession } from '@/lib/firebase/hooks/useStaticData';
import { useStaticLeaderboard } from '@/lib/firebase/hooks/useStaticCompositeData';

export default function DisplayChartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get('sessionId');

  const { session: activeSession } = useStaticActiveSession();
  const sessionId = sessionIdParam || activeSession?.id || null;

  // Get ALL users including those without teams (like admin)
  const { leaderboard: rawLeaderboard } = useStaticLeaderboard(sessionId, false);

  // Don't filter out users without teams - we want to show everyone
  const leaders = rawLeaderboard.slice(0, 10); // Top 10

  const maxPoints = leaders[0]?.weeklyPoints || 1; // Top leader's points

  const metricColors = {
    attendance: '#10b981', // green
    one21s: '#3b82f6',     // blue
    referrals: '#f59e0b',  // amber
    tyfcb: '#8b5cf6',      // purple
    visitors: '#ec4899',   // pink
  };

  const metricLabels = {
    attendance: 'ATT',
    one21s: '121',
    referrals: 'REF',
    tyfcb: 'TYFCB',
    visitors: 'VIS',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <button
          onClick={() => router.push(`/display${sessionIdParam ? `?sessionId=${sessionIdParam}` : ''}`)}
          className="mb-6 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={20} />
          <span>Back to Display</span>
        </button>

        <div className="flex items-center justify-center gap-3 mb-2">
          <Award className="text-yellow-400" size={40} />
          <h1 className="text-5xl font-bold">Individual Leaders</h1>
        </div>
        <p className="text-center text-gray-300 text-xl">Performance Breakdown</p>
      </div>

      {/* Chart */}
      <div className="max-w-7xl mx-auto space-y-4">
        {leaders.map((leader, index) => {
          const percentage = (leader.weeklyPoints / maxPoints) * 100;
          const metrics = leader.metrics;
          const totalMetrics = (metrics.attendance || 0) + (metrics.one21s || 0) +
                              (metrics.referrals || 0) + (metrics.tyfcb || 0) +
                              (metrics.visitors || 0);

          return (
            <motion.div
              key={leader.userId}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-6"
            >
              <div className="flex items-center gap-6">
                {/* Rank & Avatar */}
                <div className="flex items-center gap-4 w-64">
                  <div className="text-4xl font-bold text-gray-400 w-12">
                    {index + 1}
                  </div>
                  <img
                    src={leader.user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${leader.user.firstName}${leader.user.lastName}`}
                    alt=""
                    className="w-16 h-16 rounded-full object-cover border-4 border-white/20"
                  />
                  <div className="flex-1">
                    <div className="text-2xl font-bold">
                      {leader.user.firstName} {leader.user.lastName}
                    </div>
                    {leader.team && (
                      <div className="text-sm text-gray-400">
                        {leader.team.name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="flex-1">
                  <div className="relative h-20 bg-gray-800/50 rounded-lg overflow-hidden">
                    {/* Total bar background */}
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, delay: index * 0.1 + 0.3 }}
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500/30 to-purple-500/30"
                    />

                    {/* Stacked metric segments */}
                    <div className="absolute inset-0 flex">
                      {totalMetrics > 0 && (
                        <>
                          {metrics.attendance > 0 && (
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{
                                width: `${(metrics.attendance / totalMetrics) * percentage}%`
                              }}
                              transition={{ duration: 0.8, delay: index * 0.1 + 0.5 }}
                              className="h-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: metricColors.attendance }}
                              title={`Attendance: ${metrics.attendance}`}
                            >
                              {(metrics.attendance / totalMetrics) * percentage > 5 && (
                                <span>{metrics.attendance}</span>
                              )}
                            </motion.div>
                          )}
                          {metrics.one21s > 0 && (
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{
                                width: `${(metrics.one21s / totalMetrics) * percentage}%`
                              }}
                              transition={{ duration: 0.8, delay: index * 0.1 + 0.6 }}
                              className="h-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: metricColors.one21s }}
                              title={`1-2-1s: ${metrics.one21s}`}
                            >
                              {(metrics.one21s / totalMetrics) * percentage > 5 && (
                                <span>{metrics.one21s}</span>
                              )}
                            </motion.div>
                          )}
                          {metrics.referrals > 0 && (
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{
                                width: `${(metrics.referrals / totalMetrics) * percentage}%`
                              }}
                              transition={{ duration: 0.8, delay: index * 0.1 + 0.7 }}
                              className="h-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: metricColors.referrals }}
                              title={`Referrals: ${metrics.referrals}`}
                            >
                              {(metrics.referrals / totalMetrics) * percentage > 5 && (
                                <span>{metrics.referrals}</span>
                              )}
                            </motion.div>
                          )}
                          {metrics.tyfcb > 0 && (
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{
                                width: `${(metrics.tyfcb / totalMetrics) * percentage}%`
                              }}
                              transition={{ duration: 0.8, delay: index * 0.1 + 0.8 }}
                              className="h-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: metricColors.tyfcb }}
                              title={`TYFCB: ${metrics.tyfcb}`}
                            >
                              {(metrics.tyfcb / totalMetrics) * percentage > 5 && (
                                <span>{metrics.tyfcb}</span>
                              )}
                            </motion.div>
                          )}
                          {metrics.visitors > 0 && (
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{
                                width: `${(metrics.visitors / totalMetrics) * percentage}%`
                              }}
                              transition={{ duration: 0.8, delay: index * 0.1 + 0.9 }}
                              className="h-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: metricColors.visitors }}
                              title={`Visitors: ${metrics.visitors}`}
                            >
                              {(metrics.visitors / totalMetrics) * percentage > 5 && (
                                <span>{metrics.visitors}</span>
                              )}
                            </motion.div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Metric breakdown text */}
                  <div className="flex gap-3 mt-2 text-xs">
                    {metrics.attendance > 0 && (
                      <div className="flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: metricColors.attendance }}
                        />
                        <span>{metricLabels.attendance}: {metrics.attendance}</span>
                      </div>
                    )}
                    {metrics.one21s > 0 && (
                      <div className="flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: metricColors.one21s }}
                        />
                        <span>{metricLabels.one21s}: {metrics.one21s}</span>
                      </div>
                    )}
                    {metrics.referrals > 0 && (
                      <div className="flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: metricColors.referrals }}
                        />
                        <span>{metricLabels.referrals}: {metrics.referrals}</span>
                      </div>
                    )}
                    {metrics.tyfcb > 0 && (
                      <div className="flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: metricColors.tyfcb }}
                        />
                        <span>{metricLabels.tyfcb}: {metrics.tyfcb}</span>
                      </div>
                    )}
                    {metrics.visitors > 0 && (
                      <div className="flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: metricColors.visitors }}
                        />
                        <span>{metricLabels.visitors}: {metrics.visitors}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Total Points */}
                <div className="text-right w-32">
                  <div className="text-5xl font-bold text-yellow-400">
                    {leader.weeklyPoints}
                  </div>
                  <div className="text-sm text-gray-400">points</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {leaders.length === 0 && (
        <div className="text-center text-gray-400 text-2xl mt-20">
          No data available
        </div>
      )}
    </div>
  );
}

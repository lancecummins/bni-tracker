'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ArrowLeft } from 'lucide-react';
import { Team } from '@/lib/types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Image from 'next/image';

interface TeamSeasonStats {
  team: Team;
  weeklyWins: number;
  totalPoints: number;
}

export default function SeasonStandingsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamSeasonStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTeamStats = async () => {
      try {
        setLoading(true);

        // Get all teams
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        const teamsData = teamsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Team));

        // Sort by weekly wins first, then by total points
        const sortedTeams = teamsData
          .map(team => ({
            team,
            weeklyWins: team.weeklyWins || 0,
            totalPoints: team.totalPoints || 0
          }))
          .sort((a, b) => {
            if (b.weeklyWins !== a.weeklyWins) {
              return b.weeklyWins - a.weeklyWins;
            }
            return b.totalPoints - a.totalPoints;
          });

        setTeams(sortedTeams);
      } catch (error) {
        console.error('Error loading team stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeamStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            <Image
              src="/bni-game-logo.png"
              alt="BNI Competition Tracker"
              width={200}
              height={67}
              className="object-contain"
              priority
            />
            <div>
              <h1 className="text-5xl font-bold mb-1">
                Season Standings
              </h1>
              <p className="text-xl text-blue-200">
                Weekly Wins Through {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/display')}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
            Back
          </button>
        </div>
      </div>

      {/* Team Standings */}
      <div className="max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          <div className="space-y-4">
            {teams.map((teamStats, index) => (
              <motion.div
                key={teamStats.team.id}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`bg-white/10 backdrop-blur-lg rounded-xl overflow-hidden ${
                  index === 0 ? 'ring-4 ring-yellow-400' : ''
                }`}
              >
                {/* Colored bar */}
                <div className="h-4" style={{ backgroundColor: teamStats.team.color || '#3B82F6' }} />

                <div className="flex items-stretch">
                  {/* Team Logo */}
                  {teamStats.team.logoUrl && (
                    <div className="flex-shrink-0">
                      <img
                        src={teamStats.team.logoUrl}
                        alt={`${teamStats.team.name} logo`}
                        className="h-full w-48 object-cover"
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      {/* Team Info */}
                      <div>
                        <h2 className="text-3xl font-bold text-white mb-1">
                          {teamStats.team.name}
                        </h2>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-center">
                      <div className="text-sm text-white/70 mb-2">
                        Weekly Wins
                      </div>
                      <div className="text-6xl font-bold text-yellow-400">
                        {teamStats.weeklyWins}
                      </div>
                      <div className="text-lg text-white/60 mt-2">
                        {teamStats.totalPoints.toLocaleString()} Season Points
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      </div>
    </div>
  );
}

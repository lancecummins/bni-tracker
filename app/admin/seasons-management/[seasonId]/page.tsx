'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  useSeasons,
  useSeasonTotals,
  useUsers,
  useTeams,
  type UserSeasonTotal,
} from '@/lib/firebase/hooks';
import { ArrowLeft, Users, Calendar, ChevronUp, ChevronDown } from 'lucide-react';

type SortKey =
  | 'member'
  | 'team'
  | 'weekCount'
  | 'totalPoints'
  | 'averagePoints'
  | 'bestWeek'
  | 'attendance'
  | 'one21s'
  | 'referrals'
  | 'tyfcb'
  | 'visitors'
  | 'ceu';

export default function SeasonMemberStatsPage() {
  const params = useParams();
  const seasonId = typeof params.seasonId === 'string' ? params.seasonId : null;
  const { seasons, loading: seasonsLoading } = useSeasons();
  const { users } = useUsers();
  const { teams, loading: teamsLoading } = useTeams(seasonId ?? undefined);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('totalPoints');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { userTotals, loading: totalsLoading, weekCount } = useSeasonTotals(seasonId, {
    includeDraftScores: includeDrafts,
  });

  const season = useMemo(
    () => seasons.find((s) => s.id === seasonId),
    [seasons, seasonId]
  );

  const teamNameById = useMemo(() => {
    const m = new Map<string, string>();
    teams.forEach((t) => {
      if (t.id) m.set(t.id, t.name);
    });
    return m;
  }, [teams]);

  const sortedRows = useMemo(() => {
    const getMemberSortKey = (row: UserSeasonTotal) => {
      const user = users.find((u) => u.id === row.userId);
      return user
        ? `${user.firstName} ${user.lastName}`.toLowerCase()
        : row.userId.toLowerCase();
    };
    const getTeamSortKey = (row: UserSeasonTotal) => {
      const t = row.teamId ? teamNameById.get(row.teamId) ?? '' : '';
      return t.toLowerCase();
    };

    const rows = [...userTotals];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'member':
          cmp = getMemberSortKey(a).localeCompare(getMemberSortKey(b));
          break;
        case 'team':
          cmp = getTeamSortKey(a).localeCompare(getTeamSortKey(b));
          break;
        case 'weekCount':
          cmp = a.weekCount - b.weekCount;
          break;
        case 'totalPoints':
          cmp = a.totalPoints - b.totalPoints;
          break;
        case 'averagePoints':
          cmp = a.averagePoints - b.averagePoints;
          break;
        case 'bestWeek':
          cmp = a.bestWeek - b.bestWeek;
          break;
        case 'attendance':
          cmp = a.categoryTotals.attendance - b.categoryTotals.attendance;
          break;
        case 'one21s':
          cmp = a.categoryTotals.one21s - b.categoryTotals.one21s;
          break;
        case 'referrals':
          cmp = a.categoryTotals.referrals - b.categoryTotals.referrals;
          break;
        case 'tyfcb':
          cmp = a.categoryTotals.tyfcb - b.categoryTotals.tyfcb;
          break;
        case 'visitors':
          cmp = a.categoryTotals.visitors - b.categoryTotals.visitors;
          break;
        case 'ceu':
          cmp = a.categoryTotals.ceu - b.categoryTotals.ceu;
          break;
        default:
          cmp = 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [userTotals, sortKey, sortDir, users, teamNameById]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      const isText = key === 'member' || key === 'team';
      setSortDir(isText ? 'asc' : 'desc');
    }
  };

  const SortableTh = ({
    sortId,
    align,
    children,
  }: {
    sortId: SortKey;
    align?: 'right';
    children: ReactNode;
  }) => {
    const active = sortKey === sortId;
    const base =
      'px-4 py-3 whitespace-nowrap font-semibold text-gray-600 uppercase tracking-wide select-none';
    const alignClass = align === 'right' ? 'text-right' : 'text-left';
    const btnAlign = align === 'right' ? 'w-full flex items-center justify-end gap-1' : 'inline-flex items-center gap-1';

    return (
      <th scope="col" className={`${base} ${alignClass}`} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
        <button
          type="button"
          onClick={() => handleSort(sortId)}
          className={`${btnAlign} max-w-full hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded`}
        >
          <span>{children}</span>
          {active ? (
            sortDir === 'asc' ? (
              <ChevronUp size={16} className="text-blue-600 shrink-0" aria-hidden />
            ) : (
              <ChevronDown size={16} className="text-blue-600 shrink-0" aria-hidden />
            )
          ) : (
            <span className="w-4 h-4 shrink-0 inline-block" aria-hidden />
          )}
        </button>
      </th>
    );
  };

  const loading = seasonsLoading || totalsLoading || (seasonId ? teamsLoading : false);

  if (!seasonId) {
    return (
      <div className="space-y-4">
        <p className="text-gray-600">Invalid season.</p>
        <Link href="/admin/seasons-management" className="text-blue-600 hover:underline">
          Back to seasons
        </Link>
      </div>
    );
  }

  if (!seasonsLoading && !season) {
    return (
      <div className="space-y-4">
        <p className="text-gray-600">Season not found.</p>
        <Link href="/admin/seasons-management" className="text-blue-600 hover:underline">
          Back to seasons
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/admin/seasons-management"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-3"
            >
              <ArrowLeft size={16} />
              Back to season management
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              {season?.name ?? 'Season'} — member stats
            </h1>
            <p className="text-gray-600 mt-1">
              Totals across all non-archived sessions (draft and open weeks included in session list).
              {includeDrafts
                ? ' Showing published and unpublished draft rows.'
                : ' Showing published scores only.'}
            </p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1">
                <Calendar size={16} className="text-gray-400" />
                {season?.startDate
                  ? new Date(season.startDate.seconds * 1000).toLocaleDateString()
                  : '—'}{' '}
                –{' '}
                {season?.endDate
                  ? new Date(season.endDate.seconds * 1000).toLocaleDateString()
                  : '—'}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users size={16} className="text-gray-400" />
                {weekCount} week{weekCount !== 1 ? 's' : ''} with data
              </span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 shrink-0 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeDrafts}
              onChange={(e) => setIncludeDrafts(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Include unpublished drafts
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : userTotals.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No score data for this season yet.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b text-left text-xs">
                <tr>
                  <th scope="col" className="px-4 py-3 whitespace-nowrap font-semibold text-gray-600 uppercase tracking-wide">
                    #
                  </th>
                  <SortableTh sortId="member">Member</SortableTh>
                  <SortableTh sortId="team">Team</SortableTh>
                  <SortableTh sortId="weekCount" align="right">
                    Weeks
                  </SortableTh>
                  <SortableTh sortId="totalPoints" align="right">
                    Total pts
                  </SortableTh>
                  <SortableTh sortId="averagePoints" align="right">
                    Avg
                  </SortableTh>
                  <SortableTh sortId="bestWeek" align="right">
                    Best week
                  </SortableTh>
                  <SortableTh sortId="attendance" align="right">
                    Att.
                  </SortableTh>
                  <SortableTh sortId="one21s" align="right">
                    1-2-1s
                  </SortableTh>
                  <SortableTh sortId="referrals" align="right">
                    Ref.
                  </SortableTh>
                  <SortableTh sortId="tyfcb" align="right">
                    TYFCB
                  </SortableTh>
                  <SortableTh sortId="visitors" align="right">
                    Vis.
                  </SortableTh>
                  <SortableTh sortId="ceu" align="right">
                    CEU
                  </SortableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedRows.map((row, index) => {
                  const user = users.find((u) => u.id === row.userId);
                  const name = user
                    ? `${user.firstName} ${user.lastName}`
                    : row.userId;
                  const teamName = row.teamId ? teamNameById.get(row.teamId) ?? '—' : '—';

                  return (
                    <tr key={row.userId} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {name}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{teamName}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.weekCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {row.totalPoints}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.averagePoints}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.bestWeek}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {row.categoryTotals.attendance}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {row.categoryTotals.one21s}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {row.categoryTotals.referrals}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {row.categoryTotals.tyfcb}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {row.categoryTotals.visitors}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {row.categoryTotals.ceu}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

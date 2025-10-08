'use client';

import { useStaticTeams } from '@/lib/firebase/hooks/useStaticData';
import { Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export default function TeamLinksPage() {
  const { teams } = useStaticTeams();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (text: string, teamId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(teamId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Team Leader Scoring Links</h1>
            <p className="text-gray-600 mt-1">Direct links for team leaders to access their team's scoring page</p>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {teams.map((team) => {
                const teamUrl = `${baseUrl}/team-leader/scoring/${team.id}`;
                const isCopied = copiedId === team.id;

                return (
                  <div key={team.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: team.color || '#3B82F6' }}
                        >
                          <span className="text-white font-bold text-sm">{team.name.charAt(0)}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{team.name}</h3>
                          <p className="text-sm text-gray-500">Team Leader Scoring Page</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(teamUrl, team.id!)}
                          className={`inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md transition-colors ${
                            isCopied
                              ? 'bg-green-600 text-white border-green-600'
                              : 'text-gray-700 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <Copy size={16} className="mr-2" />
                          {isCopied ? 'Copied!' : 'Copy Link'}
                        </button>

                        <a
                          href={teamUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                          <ExternalLink size={16} className="mr-2" />
                          Open
                        </a>
                      </div>
                    </div>

                    <div className="mt-3 p-3 bg-gray-50 rounded border">
                      <code className="text-sm text-gray-800 break-all">{teamUrl}</code>
                    </div>
                  </div>
                );
              })}
            </div>

            {teams.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No teams found. Please set up teams first.</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">How to use:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Each team has a unique URL that goes directly to their scoring page</li>
            <li>• Team leaders can bookmark or save these URLs for easy access</li>
            <li>• No login required - the URL itself provides access to that team's data</li>
            <li>• Only shows members from the specific team</li>
            <li>• Works on mobile and desktop devices</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
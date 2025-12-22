'use client';

import { useSeasons, useActiveSeason } from '@/lib/firebase/hooks';
import { Season } from '@/lib/types';
import { TrendingUp, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface SeasonSelectorProps {
  selectedSeasonId: string | null;
  onSeasonChange: (seasonId: string) => void;
  className?: string;
  showActiveIndicator?: boolean;
}

export function SeasonSelector({
  selectedSeasonId,
  onSeasonChange,
  className = '',
  showActiveIndicator = true
}: SeasonSelectorProps) {
  const { seasons, loading } = useSeasons();
  const { season: activeSeason } = useActiveSeason();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedSeason = seasons.find(s => s.id === selectedSeasonId) || activeSeason;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (loading || !selectedSeason) {
    return (
      <div className={`animate-pulse bg-gray-200 rounded-lg h-10 w-48 ${className}`} />
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
      >
        <TrendingUp size={18} className="text-blue-600" />
        <div className="text-left">
          <div className="text-sm font-medium text-gray-900">
            {selectedSeason.name}
            {showActiveIndicator && selectedSeason.isActive && (
              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                Active
              </span>
            )}
          </div>
          {selectedSeason.startDate && selectedSeason.endDate && (
            <div className="text-xs text-gray-500">
              {new Date(selectedSeason.startDate.seconds * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              {' - '}
              {new Date(selectedSeason.endDate.seconds * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-2">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Select Season
            </div>
            {seasons.map((season) => (
              <button
                key={season.id}
                onClick={() => {
                  onSeasonChange(season.id!);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors ${
                  season.id === selectedSeasonId ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {season.name}
                      {season.isActive && (
                        <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    {season.startDate && season.endDate && (
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(season.startDate.seconds * 1000).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                        {' - '}
                        {new Date(season.endDate.seconds * 1000).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {season.weekCount} weeks
                    </div>
                  </div>
                  {season.id === selectedSeasonId && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

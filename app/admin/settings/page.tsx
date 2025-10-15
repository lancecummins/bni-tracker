'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, Database, Volume2, Monitor, Award, Plus, Edit2, Archive, X } from 'lucide-react';
import { useSettings } from '@/lib/firebase/hooks/useSettings';
import { CustomBonus } from '@/lib/types';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings();

  const [pointValues, setPointValues] = useState({
    attendance: 10,
    one21s: 15,
    referrals: 25,
    tyfcb: 20,
    visitors: 15,
  });

  const [bonusValues, setBonusValues] = useState({
    attendance: 50,
    one21s: 50,
    referrals: 100,
    tyfcb: 75,
    visitors: 50,
  });

  const [seasonSettings, setSeasonSettings] = useState({
    name: 'Winter 2025',
    weekCount: 12,
    startDate: '2025-01-01',
    endDate: '2025-03-31',
  });

  const [displaySettings, setDisplaySettings] = useState({
    showConfetti: true,
    playSounds: true,
    animationSpeed: 'normal',
    leaderboardSize: 10,
  });

  const [customBonuses, setCustomBonuses] = useState<CustomBonus[]>([]);
  const [editingBonus, setEditingBonus] = useState<string | null>(null);
  const [editingBonusData, setEditingBonusData] = useState<{ name: string; points: number }>({ name: '', points: 0 });
  const [showAddBonus, setShowAddBonus] = useState(false);
  const [newBonus, setNewBonus] = useState<{ name: string; points: number }>({ name: '', points: 0 });

  // Load settings when they become available
  useEffect(() => {
    if (settings) {
      setPointValues(settings.pointValues);
      if (settings.bonusValues) {
        setBonusValues(settings.bonusValues);
      }
      setSeasonSettings(settings.seasonSettings);
      setDisplaySettings(settings.displaySettings);
      if (settings.customBonuses) {
        setCustomBonuses(settings.customBonuses);
      }
    }
  }, [settings]);

  const handleSavePointValues = async () => {
    try {
      await updateSettings({
        pointValues,
        bonusValues
      });
      toast.success('Point values and bonuses updated successfully');
    } catch (error) {
      toast.error('Failed to save point values');
    }
  };

  const handleSaveSeasonSettings = async () => {
    try {
      await updateSettings({
        seasonSettings
      });
      toast.success('Season settings updated successfully');
    } catch (error) {
      toast.error('Failed to save season settings');
    }
  };

  const handleSaveDisplaySettings = async () => {
    try {
      await updateSettings({
        displaySettings
      });
      toast.success('Display settings updated successfully');
    } catch (error) {
      toast.error('Failed to save display settings');
    }
  };

  const handleResetDatabase = () => {
    if (confirm('Are you sure you want to reset the database? This will delete all data and reseed with mock data.')) {
      fetch('/api/seed?secret=development-seed-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userCount: 20,
          teamCount: 4,
          weeksToGenerate: 3,
          clearFirst: true,
        }),
      })
        .then(() => {
          toast.success('Database reset successfully');
        })
        .catch(() => {
          toast.error('Failed to reset database');
        });
    }
  };

  const handleAddCustomBonus = async () => {
    if (!newBonus.name || newBonus.points <= 0) {
      toast.error('Please enter a valid bonus name and points');
      return;
    }

    const bonus: CustomBonus = {
      id: Date.now().toString(),
      name: newBonus.name,
      points: newBonus.points,
      isArchived: false,
    };

    const updatedBonuses = [...customBonuses, bonus];
    try {
      await updateSettings({ customBonuses: updatedBonuses });
      setCustomBonuses(updatedBonuses);
      setNewBonus({ name: '', points: 0 });
      setShowAddBonus(false);
      toast.success('Custom bonus added');
    } catch (error) {
      toast.error('Failed to add custom bonus');
    }
  };

  const handleEditCustomBonus = async (bonusId: string) => {
    const updatedBonuses = customBonuses.map(b =>
      b.id === bonusId ? { ...b, name: editingBonusData.name, points: editingBonusData.points } : b
    );

    try {
      await updateSettings({ customBonuses: updatedBonuses });
      setCustomBonuses(updatedBonuses);
      setEditingBonus(null);
      toast.success('Custom bonus updated');
    } catch (error) {
      toast.error('Failed to update custom bonus');
    }
  };

  const handleArchiveCustomBonus = async (bonusId: string) => {
    const updatedBonuses = customBonuses.map(b =>
      b.id === bonusId ? { ...b, isArchived: !b.isArchived } : b
    );

    try {
      await updateSettings({ customBonuses: updatedBonuses });
      setCustomBonuses(updatedBonuses);
      toast.success('Custom bonus updated');
    } catch (error) {
      toast.error('Failed to update custom bonus');
    }
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
        <div className="flex items-center gap-3">
          <Settings size={28} className="text-gray-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600 mt-1">Configure system preferences and scoring rules</p>
          </div>
        </div>
      </div>

      {/* Point Values Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Award className="text-yellow-600" size={20} />
            Point Values & Team Bonuses
          </h2>
          <button
            onClick={handleSavePointValues}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save size={16} />
            Save Changes
          </button>
        </div>

        {/* Individual Points */}
        <div className="mb-6">
          <h3 className="text-md font-medium text-gray-800 mb-3">Individual Points</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(pointValues).map(([key, value]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                  {key === 'one21s' ? '1-2-1s' : key === 'tyfcb' ? 'TYFCB' : key.toUpperCase()}
                </label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) =>
                    setPointValues({ ...pointValues, [key]: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* All In Bonuses */}
        <div className="border-t pt-6">
          <h3 className="text-md font-medium text-gray-800 mb-2">Team "All In" Bonuses</h3>
          <p className="text-sm text-gray-600 mb-4">
            Teams earn these bonus points when ALL members score at least 1 in the category
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(bonusValues).map(([key, value]) => (
              <div key={key} className="bg-green-50 p-3 rounded-lg border border-green-200">
                <label className="block text-sm font-medium text-green-800 mb-1">
                  {key === 'one21s' ? '1-2-1s' : key === 'tyfcb' ? 'TYFCB' : key.toUpperCase()} Bonus
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 text-sm">+</span>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) =>
                      setBonusValues({ ...bonusValues, [key]: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>How it works:</strong> When every member of a team has at least 1 point in a category,
            the team receives the bonus points for that category. These bonuses encourage full team participation.
          </p>
        </div>
      </div>

      {/* Custom Bonuses */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Award className="text-purple-600" size={20} />
              Custom Bonuses
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Create custom bonuses that can be awarded spontaneously to individuals or teams
            </p>
          </div>
          <button
            onClick={() => setShowAddBonus(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus size={16} />
            Add Bonus
          </button>
        </div>

        {showAddBonus && (
          <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h3 className="font-medium text-purple-900 mb-3">New Custom Bonus</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bonus Name</label>
                <input
                  type="text"
                  value={newBonus.name}
                  onChange={(e) => setNewBonus({ ...newBonus, name: e.target.value })}
                  placeholder="e.g., Perfect Attendance, Most Referrals"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                <input
                  type="number"
                  value={newBonus.points}
                  onChange={(e) => setNewBonus({ ...newBonus, points: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddCustomBonus}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Add Bonus
              </button>
              <button
                onClick={() => {
                  setShowAddBonus(false);
                  setNewBonus({ name: '', points: 0 });
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {customBonuses.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No custom bonuses created yet. Click "Add Bonus" to create one.</p>
          ) : (
            customBonuses.map((bonus) => (
              <div
                key={bonus.id}
                className={`p-4 rounded-lg border-2 ${
                  bonus.isArchived ? 'bg-gray-50 border-gray-300' : 'bg-white border-purple-200'
                }`}
              >
                {editingBonus === bonus.id ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={editingBonusData.name}
                      onChange={(e) => setEditingBonusData({ ...editingBonusData, name: e.target.value })}
                      className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="number"
                      value={editingBonusData.points}
                      onChange={(e) => setEditingBonusData({ ...editingBonusData, points: parseInt(e.target.value) || 0 })}
                      className="w-24 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={() => handleEditCustomBonus(bonus.id!)}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingBonus(null)}
                      className="px-3 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`px-4 py-2 rounded-lg ${bonus.isArchived ? 'bg-gray-200' : 'bg-purple-100'}`}>
                        <span className={`font-bold text-2xl ${bonus.isArchived ? 'text-gray-500' : 'text-purple-600'}`}>
                          +{bonus.points}
                        </span>
                      </div>
                      <div>
                        <h3 className={`font-semibold ${bonus.isArchived ? 'text-gray-500' : 'text-gray-900'}`}>
                          {bonus.name}
                        </h3>
                        {bonus.isArchived && (
                          <span className="text-xs text-gray-500">Archived</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingBonus(bonus.id!);
                          setEditingBonusData({ name: bonus.name, points: bonus.points });
                        }}
                        className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                        title="Edit bonus"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleArchiveCustomBonus(bonus.id!)}
                        className={`p-2 transition-colors ${
                          bonus.isArchived ? 'text-green-600 hover:text-green-700' : 'text-gray-600 hover:text-orange-600'
                        }`}
                        title={bonus.isArchived ? 'Unarchive bonus' : 'Archive bonus'}
                      >
                        <Archive size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Season Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Database className="text-green-600" size={20} />
            Season Configuration
          </h2>
          <button
            onClick={handleSaveSeasonSettings}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Save size={16} />
            Save Season
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Season Name
            </label>
            <input
              type="text"
              value={seasonSettings.name}
              onChange={(e) =>
                setSeasonSettings({ ...seasonSettings, name: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Weeks
            </label>
            <input
              type="number"
              value={seasonSettings.weekCount}
              onChange={(e) =>
                setSeasonSettings({ ...seasonSettings, weekCount: parseInt(e.target.value) || 1 })
              }
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={seasonSettings.startDate}
              onChange={(e) =>
                setSeasonSettings({ ...seasonSettings, startDate: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={seasonSettings.endDate}
              onChange={(e) =>
                setSeasonSettings({ ...seasonSettings, endDate: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </div>

      {/* Display Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Monitor className="text-purple-600" size={20} />
            Display Settings
          </h2>
          <button
            onClick={handleSaveDisplaySettings}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Save size={16} />
            Save Display Settings
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 size={18} className="text-gray-600" />
              <span className="text-gray-700">Play Sound Effects</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={displaySettings.playSounds}
                onChange={(e) =>
                  setDisplaySettings({ ...displaySettings, playSounds: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎉</span>
              <span className="text-gray-700">Show Confetti Effects</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={displaySettings.showConfetti}
                onChange={(e) =>
                  setDisplaySettings({ ...displaySettings, showConfetti: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Animation Speed
            </label>
            <select
              value={displaySettings.animationSpeed}
              onChange={(e) =>
                setDisplaySettings({ ...displaySettings, animationSpeed: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Leaderboard Size (TV Display)
            </label>
            <input
              type="number"
              value={displaySettings.leaderboardSize}
              onChange={(e) =>
                setDisplaySettings({
                  ...displaySettings,
                  leaderboardSize: parseInt(e.target.value) || 10,
                })
              }
              min="5"
              max="20"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Reset Database</h3>
              <p className="text-sm text-gray-600 mt-1">
                Clear all data and reseed with mock data
              </p>
            </div>
            <button
              onClick={handleResetDatabase}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <RefreshCw size={16} />
              Reset Database
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
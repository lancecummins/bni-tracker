'use client';

import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Download, Database, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BackupPage() {
  const [backing, setBacking] = useState(false);
  const [backupComplete, setBackupComplete] = useState(false);

  const handleBackup = async () => {
    if (!confirm('This will export all your Firestore data to a JSON file. Continue?')) {
      return;
    }

    try {
      setBacking(true);
      toast('Starting backup... This may take a moment');

      const backup: any = {
        timestamp: new Date().toISOString(),
        collections: {}
      };

      // List of collections to backup
      const collections = [
        'users',
        'teams',
        'sessions',
        'scores',
        'seasons',
        'settings'
      ];

      // Fetch each collection
      for (const collectionName of collections) {
        const snapshot = await getDocs(collection(db, collectionName));
        backup.collections[collectionName] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        toast(`Backed up ${collectionName}: ${snapshot.docs.length} documents`);
      }

      // Convert to JSON
      const jsonString = JSON.stringify(backup, null, 2);

      // Create download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bni-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Backup complete! File downloaded.');
      setBackupComplete(true);
    } catch (error) {
      console.error('Backup error:', error);
      toast.error('Failed to create backup. See console for details.');
    } finally {
      setBacking(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="text-blue-600" size={32} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Database Backup</h1>
            <p className="text-gray-600">Export your Firestore data to JSON</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800 mb-2">
              <AlertCircle size={20} />
              <span className="font-medium">Important</span>
            </div>
            <p className="text-sm text-yellow-700">
              Always create a backup before making major changes to your database.
              This backup includes all collections: users, teams, sessions, scores, seasons, and settings.
            </p>
          </div>

          {backupComplete && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle size={20} />
                <span className="font-medium">Backup created successfully!</span>
              </div>
              <p className="mt-2 text-sm text-green-700">
                Your backup file has been downloaded. Keep this file safe - you can use it to restore your data if needed.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">What gets backed up:</h3>
            <ul className="list-disc ml-5 space-y-1 text-sm text-gray-600">
              <li>All users and their data</li>
              <li>All teams and configurations</li>
              <li>All sessions (current and historical)</li>
              <li>All scores and bonuses</li>
              <li>All seasons</li>
              <li>System settings</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Backup file format:</h3>
            <ul className="list-disc ml-5 space-y-1 text-sm text-gray-600">
              <li>JSON format (easy to read and inspect)</li>
              <li>Includes timestamps for each document</li>
              <li>Can be used with Firebase import tools</li>
              <li>File name: <code className="bg-gray-100 px-1 py-0.5 rounded">bni-tracker-backup-YYYY-MM-DD.json</code></li>
            </ul>
          </div>

          <button
            onClick={handleBackup}
            disabled={backing}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {backing ? (
              <>
                <Database className="animate-spin" size={20} />
                Creating Backup...
              </>
            ) : (
              <>
                <Download size={20} />
                Create Backup & Download
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Storage Recommendations</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Keep backups in multiple locations (cloud storage, external drive)</li>
          <li>• Create backups before major updates or data migrations</li>
          <li>• Test restore process occasionally to ensure backups are valid</li>
          <li>• Label backups with dates and what changed since last backup</li>
        </ul>
      </div>
    </div>
  );
}

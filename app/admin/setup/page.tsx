'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { userService } from '@/lib/firebase/services';
import { User, UserRole } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import { UserPlus, Trash2, CheckCircle, AlertCircle, Upload } from 'lucide-react';
import { useUsers } from '@/lib/firebase/hooks';

// BNI Member data
const bniMembers = [
  { firstName: 'Alexander', lastName: 'Jenkins', company: 'Universal Roofing & Construction', category: 'Roofing & Gutters', role: 'Secretary Treasurer' },
  { firstName: 'Andrew', lastName: 'Smalley', company: 'Law Office of Andrew Smalley', category: 'Family Law', role: 'Membership Committee' },
  { firstName: 'Asher', lastName: 'Hoopes', company: 'MassMutual', category: 'Finance & Insurance (Other)', role: null },
  { firstName: 'Ashley', lastName: 'Haynes', company: 'All Outdoors and Turf Boss', category: 'Lawn Care', role: null },
  { firstName: 'Craig', lastName: 'Hill', company: 'Sanders Heating and Cooling', category: 'HVAC - Heating & Air', role: 'Visitor Host' },
  { firstName: 'Cristina', lastName: 'Gross', company: 'Ceemi Agency', category: 'Web Design', role: null },
  { firstName: 'Dennis', lastName: 'Latham', company: 'Pinnacle Asset Management', category: 'Financial Advisor', role: null },
  { firstName: 'E. Gail', lastName: 'Everett', company: 'Systematic Tutoring Resulting in Development', category: 'Education Services/Tutor', role: null },
  { firstName: 'Geoff', lastName: 'Petis', company: 'That 1 Painter Upstate South Carolina', category: 'Painter & Decorator', role: null },
  { firstName: 'Jeffrey', lastName: 'McCann', company: 'Superior Plumbing Services LLC', category: 'Plumbing', role: null },
  { firstName: 'Justin', lastName: 'Griffin', company: 'Greenville Network Spinal Care', category: 'Chiropractor', role: 'Membership Committee' },
  { firstName: 'Lance', lastName: 'Cummins', company: 'VooHQ', category: 'Advertising & Marketing (Other)', role: 'President' },
  { firstName: 'Lindsey', lastName: 'Johnson', company: 'Carolina Closet', category: 'Construction (Other)', role: 'Visitor Host' },
  { firstName: 'Mandy', lastName: 'Caudill', company: 'Handy Mandy', category: 'Handyman', role: 'Education Coordinator' },
  { firstName: 'Michelle', lastName: 'Gray', company: 'Coldwell Banker Caine', category: 'Residential Real Estate Agent', role: 'Mentoring Coordinator' },
  { firstName: 'Scarlet', lastName: 'Vale', company: 'FutureTech IT Services', category: 'IT & Networks', role: null },
  { firstName: 'Scott', lastName: 'Jones', company: 'NAIEF', category: 'Commercial Real Estate', role: null },
  { firstName: 'Stosh', lastName: 'Fernandez', company: 'Voda Cleaning and Restoration of Greenville', category: 'Commercial Cleaning', role: null },
  { firstName: 'Tinus', lastName: 'Van Wyk', company: 'Superstein PA', category: 'Certified Public Accountant (CPA)', role: 'Vice President' },
];

export default function SetupPage() {
  const router = useRouter();
  const { users, loading: usersLoading } = useUsers();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addProgress = (message: string) => {
    setProgress(prev => [...prev, message]);
  };

  const deleteAllUsers = async () => {
    addProgress('Deleting existing users...');

    try {
      // Delete all existing users
      for (const user of users) {
        if (user.id) {
          await userService.delete(user.id);
        }
      }
      addProgress(`✅ Deleted ${users.length} existing users`);
      return true;
    } catch (error) {
      console.error('Error deleting users:', error);
      addProgress(`❌ Error deleting users: ${error}`);
      return false;
    }
  };

  const createBNIMembers = async () => {
    addProgress('Creating BNI members...');

    for (const member of bniMembers) {
      try {
        // Create email address
        const cleanFirst = member.firstName.toLowerCase().replace(/[^a-z]/g, '');
        const cleanLast = member.lastName.toLowerCase().replace(/[^a-z]/g, '');
        const email = `lance+${cleanFirst}${cleanLast}@lancecummins.com`;

        // Determine user role based on their BNI role
        let userRole: UserRole = 'member';
        if (member.role === 'President') {
          userRole = 'admin';
        } else if (member.role === 'Vice President' || member.role === 'Secretary Treasurer') {
          userRole = 'team-leader';
        }

        const newUser: Omit<User, 'id'> = {
          firstName: member.firstName,
          lastName: member.lastName,
          email: email,
          role: userRole,
          isActive: true,
          createdAt: Timestamp.now(),
          teamId: null,
        };

        await userService.create(newUser);
        addProgress(`✅ Created: ${member.firstName} ${member.lastName} (${userRole})`);

      } catch (error) {
        console.error(`Error creating user ${member.firstName} ${member.lastName}:`, error);
        addProgress(`❌ Failed: ${member.firstName} ${member.lastName}`);
      }
    }

    addProgress('🎉 All BNI members created successfully!');
  };

  const handleSetup = async () => {
    if (!confirm('This will DELETE all existing users and create new BNI members. Are you sure?')) {
      return;
    }

    setProcessing(true);
    setProgress([]);
    setError(null);

    try {
      // Step 1: Delete all users
      const deleteSuccess = await deleteAllUsers();

      if (!deleteSuccess) {
        throw new Error('Failed to delete existing users');
      }

      // Step 2: Create new members
      await createBNIMembers();

      addProgress('✅ Setup complete! Redirecting to users page...');

      setTimeout(() => {
        router.push('/admin/users');
      }, 2000);

    } catch (error) {
      console.error('Setup error:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6">BNI Member Setup</h1>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-yellow-600 mt-1" size={20} />
            <div>
              <p className="font-semibold text-yellow-800">Warning: This action is destructive!</p>
              <p className="text-sm text-yellow-700 mt-1">
                This will delete ALL existing users and create new BNI members with emails in the format:
                lance+firstnamelastname@lancecummins.com
              </p>
            </div>
          </div>
        </div>

        {/* Member Preview */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Members to be created:</h2>
          <div className="max-h-64 overflow-y-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Company</th>
                  <th className="text-left px-3 py-2">BNI Role</th>
                  <th className="text-left px-3 py-2">System Role</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {bniMembers.map((member, index) => {
                  let systemRole = 'Member';
                  if (member.role === 'President') systemRole = 'Admin';
                  else if (member.role === 'Vice President' || member.role === 'Secretary Treasurer') systemRole = 'Team Leader';

                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{member.firstName} {member.lastName}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{member.company}</td>
                      <td className="px-3 py-2">{member.role || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          systemRole === 'Admin' ? 'bg-purple-100 text-purple-800' :
                          systemRole === 'Team Leader' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {systemRole}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Progress Log */}
        {progress.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2">Progress:</h3>
            <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
              {progress.map((message, index) => (
                <div key={index} className="text-xs font-mono py-1">
                  {message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleSetup}
            disabled={processing || usersLoading}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <Upload size={20} />
                Setup BNI Members
              </>
            )}
          </button>

          <button
            onClick={() => router.push('/admin/users')}
            disabled={processing}
            className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          <p>Total members to create: {bniMembers.length}</p>
          <p>Admin: Lance Cummins (President)</p>
          <p>Team Leaders: Tinus Van Wyk (VP), Alexander Jenkins (Secretary Treasurer)</p>
        </div>
      </div>
    </div>
  );
}
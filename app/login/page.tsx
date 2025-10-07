'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/hooks/useAuth';
import { LogIn, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);

    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || 'Login failed');
      setLoading(false);
    }
  };

  // Quick login buttons for testing
  const quickLogin = (email: string, password: string) => {
    setEmail(email);
    setPassword(password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">BNI Tracker</h1>
            <p className="text-gray-600 mt-2">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded-lg">
                <AlertCircle size={20} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn size={20} />
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Quick login buttons for development */}
          <div className="mt-8 pt-6 border-t">
            <p className="text-sm text-gray-600 mb-3">Quick login for BNI members:</p>
            <div className="space-y-2">
              {/* Admin */}
              <button
                type="button"
                onClick={() => quickLogin('lance+lancecummins@lancecummins.com', 'password123')}
                className="w-full text-left px-3 py-2 text-sm bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-purple-700">Lance Cummins</span>
                    <span className="text-xs text-purple-600 ml-2">(Admin - President)</span>
                  </div>
                  <span className="text-xs text-purple-500">VooHQ</span>
                </div>
              </button>

              {/* Team Leaders */}
              <button
                type="button"
                onClick={() => quickLogin('lance+tinusvanwyk@lancecummins.com', 'password123')}
                className="w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-blue-700">Tinus Van Wyk</span>
                    <span className="text-xs text-blue-600 ml-2">(Team Leader - VP)</span>
                  </div>
                  <span className="text-xs text-blue-500">Superstein PA</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => quickLogin('lance+alexanderjenkins@lancecummins.com', 'password123')}
                className="w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-blue-700">Alexander Jenkins</span>
                    <span className="text-xs text-blue-600 ml-2">(Team Leader - Secretary)</span>
                  </div>
                  <span className="text-xs text-blue-500">Universal Roofing</span>
                </div>
              </button>

              {/* Regular Members */}
              <button
                type="button"
                onClick={() => quickLogin('lance+michellgray@lancecummins.com', 'password123')}
                className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-700">Michelle Gray</span>
                    <span className="text-xs text-gray-600 ml-2">(Member)</span>
                  </div>
                  <span className="text-xs text-gray-500">Coldwell Banker</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => quickLogin('lance+craighill@lancecummins.com', 'password123')}
                className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-700">Craig Hill</span>
                    <span className="text-xs text-gray-600 ml-2">(Member)</span>
                  </div>
                  <span className="text-xs text-gray-500">Sanders Heating</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => quickLogin('lance+asherhopes@lancecummins.com', 'password123')}
                className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-700">Asher Hoopes</span>
                    <span className="text-xs text-gray-600 ml-2">(Member)</span>
                  </div>
                  <span className="text-xs text-gray-500">MassMutual</span>
                </div>
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Note: Default password is 'password123' for all accounts.
              <br />
              Email format: lance+firstnamelastname@lancecummins.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
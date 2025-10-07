'use client';

import { useState } from 'react';

export default function TestRefereePage() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [counter, setCounter] = useState(0);

  const testUsers = [
    { id: '1', name: 'User 1' },
    { id: '2', name: 'User 2' },
    { id: '3', name: 'User 3' },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Referee Page</h1>

      <div className="mb-4">
        <p>Selected User: {selectedUser || 'None'}</p>
        <p>Counter: {counter}</p>
        <button
          onClick={() => setCounter(c => c + 1)}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Increment Counter
        </button>
      </div>

      <div className="space-y-2">
        {testUsers.map(user => (
          <div
            key={user.id}
            className={`p-4 border rounded cursor-pointer ${
              selectedUser === user.id ? 'bg-blue-100 border-blue-500' : 'bg-white'
            }`}
            onClick={() => {
              console.log('Clicked:', user.name);
              setSelectedUser(user.id);
            }}
          >
            {user.name}
          </div>
        ))}
      </div>
    </div>
  );
}
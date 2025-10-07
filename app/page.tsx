'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/admin/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
      <div className="text-center text-white">
        <div className="flex justify-center mb-4">
          <Image
            src="/bni-game-logo.png"
            alt="BNI Competition Tracker"
            width={300}
            height={100}
            className="object-contain"
            priority
          />
        </div>
        <p className="text-xl opacity-75">Redirecting to admin dashboard...</p>
        <div className="mt-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    </div>
  );
}
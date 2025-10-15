'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { timerChannel } from '@/lib/utils/timerChannel';

export default function LogoPage() {
  const [timeLeft, setTimeLeft] = useState(169); // 2:49 in seconds
  const [isRunning, setIsRunning] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const buzzerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/bni-game-theme2.mp3');
      audioRef.current.volume = 0.5;
      audioRef.current.loop = false;
    }

    if (!buzzerRef.current) {
      buzzerRef.current = new Audio('/sounds/time-up.mp3');
      buzzerRef.current.volume = 0.7;
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            if (audioRef.current) {
              audioRef.current.pause();
            }
            if (buzzerRef.current) {
              buzzerRef.current.play().catch(err => console.log('Buzzer play failed:', err));
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft]);

  const handleStart = () => {
    setIsRunning(true);
    if (audioRef.current) {
      audioRef.current.play().catch(err => console.log('Audio play failed:', err));
    }
  };

  const handlePause = () => {
    setIsRunning(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(169);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    timerChannel.onMessage((message) => {
      if (message.type === 'TIMER_START') {
        setIsRunning(true);
        if (audioRef.current) {
          audioRef.current.play().catch(err => console.log('Audio play failed:', err));
        }
      } else if (message.type === 'TIMER_PAUSE') {
        setIsRunning(false);
        if (audioRef.current) {
          audioRef.current.pause();
        }
      } else if (message.type === 'TIMER_RESET') {
        setIsRunning(false);
        setTimeLeft(169);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <Image
          src="/bni-game-logo.png"
          alt="BNI Game"
          width={600}
          height={200}
          className="object-contain mb-12"
          priority
        />

        <motion.div
          className={`text-9xl font-bold mb-12 ${
            timeLeft === 0 ? 'text-red-500' : timeLeft <= 30 ? 'text-yellow-400' : 'text-white'
          }`}
          animate={timeLeft === 0 ? { scale: [1, 1.1, 1] } : {}}
          transition={{ repeat: timeLeft === 0 ? Infinity : 0, duration: 0.5 }}
        >
          {formatTime(timeLeft)}
        </motion.div>

        <div className="flex gap-4 justify-center">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 text-2xl font-bold"
            >
              Start
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="px-8 py-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-2xl font-bold"
            >
              Pause
            </button>
          )}
          <button
            onClick={handleReset}
            className="px-8 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 text-2xl font-bold"
          >
            Reset
          </button>
        </div>
      </motion.div>
    </div>
  );
}

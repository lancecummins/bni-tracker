import {
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config';

export interface PointValues {
  attendance: number;
  one21s: number;
  referrals: number;
  tyfcb: number;
  visitors: number;
}

export interface BonusValues {
  attendance: number;
  one21s: number;
  referrals: number;
  tyfcb: number;
  visitors: number;
}

export interface SeasonSettings {
  name: string;
  weekCount: number;
  startDate: string;
  endDate: string;
}

export interface DisplaySettings {
  showConfetti: boolean;
  playSounds: boolean;
  animationSpeed: string;
  leaderboardSize: number;
}

export interface Settings {
  pointValues: PointValues;
  bonusValues: BonusValues;
  seasonSettings: SeasonSettings;
  displaySettings: DisplaySettings;
}

const DEFAULT_SETTINGS: Settings = {
  pointValues: {
    attendance: 10,
    one21s: 15,
    referrals: 25,
    tyfcb: 20,
    visitors: 15,
  },
  bonusValues: {
    attendance: 50,
    one21s: 50,
    referrals: 100,
    tyfcb: 75,
    visitors: 50,
  },
  seasonSettings: {
    name: 'Winter 2025',
    weekCount: 12,
    startDate: '2025-01-01',
    endDate: '2025-03-31',
  },
  displaySettings: {
    showConfetti: true,
    playSounds: true,
    animationSpeed: 'normal',
    leaderboardSize: 10,
  }
};

export const settingsService = {
  async get(): Promise<Settings> {
    try {
      const docRef = doc(db, 'settings', 'main');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as Settings;
      }

      // If no settings exist, create default settings
      await this.update(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error fetching settings:', error);
      return DEFAULT_SETTINGS;
    }
  },

  async update(settings: Partial<Settings>): Promise<void> {
    try {
      const docRef = doc(db, 'settings', 'main');
      const currentSettings = await this.get();
      await setDoc(docRef, {
        ...currentSettings,
        ...settings
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  },

  subscribe(callback: (settings: Settings) => void) {
    const docRef = doc(db, 'settings', 'main');
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback(doc.data() as Settings);
      } else {
        callback(DEFAULT_SETTINGS);
      }
    });
  }
};
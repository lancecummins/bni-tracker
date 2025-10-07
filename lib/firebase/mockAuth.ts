// Mock authentication for development
// In production, replace with real Firebase Auth

interface MockUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'team-leader' | 'member';
}

// Mock user database - includes all BNI members
const mockUsers: Record<string, MockUser> = {
  // Admin
  'lance+lancecummins@lancecummins.com': {
    uid: 'lance_lancecummins',
    email: 'lance+lancecummins@lancecummins.com',
    displayName: 'Lance Cummins',
    role: 'admin'
  },
  // Team Leaders
  'lance+tinusvanwyk@lancecummins.com': {
    uid: 'lance_tinusvanwyk',
    email: 'lance+tinusvanwyk@lancecummins.com',
    displayName: 'Tinus Van Wyk',
    role: 'team-leader'
  },
  'lance+alexanderjenkins@lancecummins.com': {
    uid: 'lance_alexanderjenkins',
    email: 'lance+alexanderjenkins@lancecummins.com',
    displayName: 'Alexander Jenkins',
    role: 'team-leader'
  },
  // Members
  'lance+andrewsmalley@lancecummins.com': {
    uid: 'lance_andrewsmalley',
    email: 'lance+andrewsmalley@lancecummins.com',
    displayName: 'Andrew Smalley',
    role: 'member'
  },
  'lance+asherhoopes@lancecummins.com': {
    uid: 'lance_asherhoopes',
    email: 'lance+asherhoopes@lancecummins.com',
    displayName: 'Asher Hoopes',
    role: 'member'
  },
  'lance+ashleyhaynes@lancecummins.com': {
    uid: 'lance_ashleyhaynes',
    email: 'lance+ashleyhaynes@lancecummins.com',
    displayName: 'Ashley Haynes',
    role: 'member'
  },
  'lance+craighill@lancecummins.com': {
    uid: 'lance_craighill',
    email: 'lance+craighill@lancecummins.com',
    displayName: 'Craig Hill',
    role: 'member'
  },
  'lance+cristinagross@lancecummins.com': {
    uid: 'lance_cristinagross',
    email: 'lance+cristinagross@lancecummins.com',
    displayName: 'Cristina Gross',
    role: 'member'
  },
  'lance+dennislatham@lancecummins.com': {
    uid: 'lance_dennislatham',
    email: 'lance+dennislatham@lancecummins.com',
    displayName: 'Dennis Latham',
    role: 'member'
  },
  'lance+egaileverett@lancecummins.com': {
    uid: 'lance_egaileverett',
    email: 'lance+egaileverett@lancecummins.com',
    displayName: 'E. Gail Everett',
    role: 'member'
  },
  'lance+geoffpetis@lancecummins.com': {
    uid: 'lance_geoffpetis',
    email: 'lance+geoffpetis@lancecummins.com',
    displayName: 'Geoff Petis',
    role: 'member'
  },
  'lance+jeffreymccann@lancecummins.com': {
    uid: 'lance_jeffreymccann',
    email: 'lance+jeffreymccann@lancecummins.com',
    displayName: 'Jeffrey McCann',
    role: 'member'
  },
  'lance+justingriffin@lancecummins.com': {
    uid: 'lance_justingriffin',
    email: 'lance+justingriffin@lancecummins.com',
    displayName: 'Justin Griffin',
    role: 'member'
  },
  'lance+lindseyjohnson@lancecummins.com': {
    uid: 'lance_lindseyjohnson',
    email: 'lance+lindseyjohnson@lancecummins.com',
    displayName: 'Lindsey Johnson',
    role: 'member'
  },
  'lance+mandycaudill@lancecummins.com': {
    uid: 'lance_mandycaudill',
    email: 'lance+mandycaudill@lancecummins.com',
    displayName: 'Mandy Caudill',
    role: 'member'
  },
  'lance+michellegray@lancecummins.com': {
    uid: 'lance_michellegray',
    email: 'lance+michellegray@lancecummins.com',
    displayName: 'Michelle Gray',
    role: 'member'
  },
  'lance+scarletvale@lancecummins.com': {
    uid: 'lance_scarletvale',
    email: 'lance+scarletvale@lancecummins.com',
    displayName: 'Scarlet Vale',
    role: 'member'
  },
  'lance+scottjones@lancecummins.com': {
    uid: 'lance_scottjones',
    email: 'lance+scottjones@lancecummins.com',
    displayName: 'Scott Jones',
    role: 'member'
  },
  'lance+stoshfernandez@lancecummins.com': {
    uid: 'lance_stoshfernandez',
    email: 'lance+stoshfernandez@lancecummins.com',
    displayName: 'Stosh Fernandez',
    role: 'member'
  }
};

// Store current user in memory
let currentMockUser: MockUser | null = null;

// Mock auth functions
export const mockAuth = {
  signIn: async (email: string, password: string) => {
    // For development, accept any password
    const user = mockUsers[email.toLowerCase()];

    if (!user) {
      throw new Error('User not found');
    }

    currentMockUser = user;

    // Store in localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('mockAuthUser', JSON.stringify(user));
    }

    return { user };
  },

  signOut: async () => {
    currentMockUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mockAuthUser');
    }
  },

  getCurrentUser: () => {
    if (currentMockUser) return currentMockUser;

    // Check localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('mockAuthUser');
      if (stored) {
        currentMockUser = JSON.parse(stored);
        return currentMockUser;
      }
    }

    return null;
  },

  onAuthStateChanged: (callback: (user: MockUser | null) => void) => {
    // Check for stored user on mount
    const stored = mockAuth.getCurrentUser();
    callback(stored);

    // Return unsubscribe function
    return () => {};
  }
};
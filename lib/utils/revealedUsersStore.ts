// Store for tracking which users have been shown by the referee
class ShownUsersStore {
  private shownUserIds: Set<string> = new Set();
  private listeners: Array<(userIds: Set<string>) => void> = [];
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    // Set up BroadcastChannel for cross-tab communication
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('shown-users-sync');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data.type === 'SYNC_SHOWN_USERS') {
          console.log('[Store] Received broadcast sync:', event.data.userIds);
          // Don't broadcast again to avoid infinite loop
          this.shownUserIds = new Set(event.data.userIds);
          this.notifyListeners();
        }
      };
    }
  }

  // Mark a user as shown
  showUser(userId: string) {
    this.shownUserIds.add(userId);
    console.log('User shown:', userId, 'Total shown:', this.shownUserIds.size);
    this.notifyListeners();

    // Broadcast to other tabs/windows
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'SYNC_SHOWN_USERS',
        userIds: Array.from(this.shownUserIds)
      });
    }
  }

  // Get all shown user IDs
  getShownUsers(): Set<string> {
    console.log('getShownUsers called, returning:', Array.from(this.shownUserIds));
    return new Set(this.shownUserIds);
  }

  // Check if a user has been shown
  isUserShown(userId: string): boolean {
    return this.shownUserIds.has(userId);
  }

  // Clear all shown users (for new session)
  clearShown() {
    console.log('[Store] Clearing all shown users');
    this.shownUserIds.clear();
    this.notifyListeners();

    // Broadcast to other tabs/windows
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'SYNC_SHOWN_USERS',
        userIds: []
      });
    }
  }

  // Set all shown users at once (for syncing)
  setShownUsers(userIds: string[]) {
    console.log('[Store] Setting shown users:', userIds);
    this.shownUserIds = new Set(userIds);
    this.notifyListeners();

    // Broadcast to other tabs/windows
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'SYNC_SHOWN_USERS',
        userIds: userIds
      });
    }
  }

  // Subscribe to changes
  subscribe(listener: (userIds: Set<string>) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    console.log(`[Store] Notifying ${this.listeners.length} listeners of ${this.shownUserIds.size} shown users`);
    this.listeners.forEach(listener => listener(new Set(this.shownUserIds)));
  }
}

export const shownUsersStore = new ShownUsersStore();

// Keep old export name for compatibility, but use new store
export const revealedUsersStore = shownUsersStore;
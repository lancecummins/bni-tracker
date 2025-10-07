// Store for tracking which teams have had their bonuses revealed
class RevealedBonusesStore {
  private revealedTeamIds: Set<string> = new Set();
  private listeners: Array<(teamIds: Set<string>) => void> = [];
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    // Set up BroadcastChannel for cross-tab communication
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('revealed-bonuses-sync');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data.type === 'SYNC_REVEALED_BONUSES') {
          console.log('[BonusStore] Received broadcast sync:', event.data.teamIds);
          this.revealedTeamIds = new Set(event.data.teamIds);
          this.notifyListeners();
        }
      };
    }
  }

  // Mark a team's bonuses as revealed
  revealTeamBonus(teamId: string) {
    this.revealedTeamIds.add(teamId);
    console.log('[BonusStore] Team bonus revealed:', teamId, 'Total revealed:', this.revealedTeamIds.size);
    this.notifyListeners();

    // Broadcast to other tabs/windows
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'SYNC_REVEALED_BONUSES',
        teamIds: Array.from(this.revealedTeamIds)
      });
    }
  }

  // Get all revealed team IDs
  getRevealedTeams(): Set<string> {
    return new Set(this.revealedTeamIds);
  }

  // Check if a team's bonus has been revealed
  isTeamBonusRevealed(teamId: string): boolean {
    return this.revealedTeamIds.has(teamId);
  }

  // Clear all revealed bonuses (for new session)
  clearRevealed() {
    console.log('[BonusStore] Clearing all revealed bonuses');
    this.revealedTeamIds.clear();
    this.notifyListeners();

    // Broadcast to other tabs/windows
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'SYNC_REVEALED_BONUSES',
        teamIds: []
      });
    }
  }

  // Set all revealed teams at once (for syncing)
  setRevealedTeams(teamIds: string[]) {
    console.log('[BonusStore] Setting revealed teams:', teamIds);
    this.revealedTeamIds = new Set(teamIds);
    this.notifyListeners();

    // Broadcast to other tabs/windows
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'SYNC_REVEALED_BONUSES',
        teamIds: teamIds
      });
    }
  }

  // Subscribe to changes
  subscribe(listener: (teamIds: Set<string>) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    console.log(`[BonusStore] Notifying ${this.listeners.length} listeners of ${this.revealedTeamIds.size} revealed team bonuses`);
    this.listeners.forEach(listener => listener(new Set(this.revealedTeamIds)));
  }
}

export const revealedBonusesStore = new RevealedBonusesStore();
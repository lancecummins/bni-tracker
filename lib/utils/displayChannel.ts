// Broadcast channel for communication between referee and display
// This works across tabs/windows in the same browser

class DisplayChannel {
  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('bni-display-channel');
    }
  }

  // Send a message to all display windows
  send(data: any) {
    if (this.channel) {
      this.channel.postMessage(data);
    } else {
      // Fallback to localStorage events for older browsers
      localStorage.setItem('bni-display-message', JSON.stringify({
        ...data,
        timestamp: Date.now()
      }));
    }
  }

  // Listen for messages
  onMessage(callback: (data: any) => void) {
    if (this.channel) {
      this.channel.onmessage = (event) => {
        callback(event.data);
      };
    } else {
      // Fallback to storage events
      window.addEventListener('storage', (e) => {
        if (e.key === 'bni-display-message' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            callback(data);
          } catch (error) {
            console.error('Error parsing display message:', error);
          }
        }
      });
    }
  }

  // Clean up
  close() {
    if (this.channel) {
      this.channel.close();
    }
  }
}

export const displayChannel = new DisplayChannel();
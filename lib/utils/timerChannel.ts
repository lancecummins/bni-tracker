class TimerChannel {
  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('bni-timer-channel');
    }
  }

  send(data: any) {
    if (this.channel) {
      this.channel.postMessage(data);
    } else {
      localStorage.setItem('bni-timer-message', JSON.stringify({
        ...data,
        timestamp: Date.now()
      }));
    }
  }

  onMessage(callback: (data: any) => void) {
    if (this.channel) {
      this.channel.onmessage = (event) => {
        callback(event.data);
      };
    } else {
      window.addEventListener('storage', (e) => {
        if (e.key === 'bni-timer-message' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            callback(data);
          } catch (error) {
            console.error('Error parsing timer message:', error);
          }
        }
      });
    }
  }

  close() {
    if (this.channel) {
      this.channel.close();
    }
  }
}

export const timerChannel = new TimerChannel();

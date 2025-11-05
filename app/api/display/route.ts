import { NextRequest, NextResponse } from 'next/server';

// Store the current display data in memory (resets on server restart)
let currentDisplayData: any = null;
let clients: Set<ReadableStreamDefaultController> = new Set();

// SSE endpoint for display to listen for updates
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Add this client to our set
      clients.add(controller);

      // Send initial data if we have any
      if (currentDisplayData) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(currentDisplayData)}\n\n`));
      }

      // Keep connection alive with heartbeat (increased to 60s to reduce load)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (error) {
          clearInterval(heartbeat);
          clients.delete(controller);
        }
      }, 60000); // Changed from 30s to 60s

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        clients.delete(controller);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// POST endpoint for referee to send display updates
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Don't persist navigation-type messages (they should only affect currently connected displays)
    // These include SHOW_SEASON_STANDINGS and CLEAR_DISPLAY
    if (data.type !== 'SHOW_SEASON_STANDINGS' && data.type !== 'CLEAR_DISPLAY') {
      currentDisplayData = data;
    } else if (data.type === 'CLEAR_DISPLAY') {
      // Clear the persisted data when explicitly asked
      currentDisplayData = null;
    }

    // Broadcast to all connected clients
    const encoder = new TextEncoder();
    const message = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

    // Send to all connected displays
    clients.forEach(client => {
      try {
        client.enqueue(message);
      } catch (error) {
        // Client disconnected, remove it
        clients.delete(client);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update display' }, { status: 500 });
  }
}
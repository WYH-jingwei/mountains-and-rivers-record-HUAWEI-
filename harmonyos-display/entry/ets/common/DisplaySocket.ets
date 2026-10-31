import { webSocket } from '@kit.NetworkKit';

const SERVER_URL = 'ws://192.168.1.100:3000/ws';

export class DisplaySocket {
  private ws: webSocket.WebSocket | null = null;
  private messageHandler: ((data: string) => void) | null = null;

  connect(onMessage: (data: string) => void): Promise<void> {
    this.messageHandler = onMessage;
    this.ws = webSocket.createWebSocket();

    this.ws.on('message', (err, data) => {
      if (!err && this.messageHandler) {
        this.messageHandler(data as string);
      }
    });

    this.ws.on('close', () => {
      console.info('WebSocket closed');
    });

    this.ws.on('error', (err) => {
      console.error('WebSocket error:', JSON.stringify(err));
    });

    return new Promise((resolve, reject) => {
      this.ws!.connect(SERVER_URL, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  send(data: string): void {
    if (this.ws) {
      this.ws.send(data);
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
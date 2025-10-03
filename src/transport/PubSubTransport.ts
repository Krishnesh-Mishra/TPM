import Redis from 'ioredis';
import { PubSubMessage } from '../types';
import { Logger } from '../utils/Logger';

export class PubSubTransport {
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private messageHandlers: Map<string, (message: PubSubMessage) => void> = new Map();
  private channelPrefix: string;
  private machineId: string;

  constructor(
    private redisURL: string | undefined,
    channelPrefix: string = 'tmc:pubsub:',
    machineId: string,
    private logger: Logger
  ) {
    this.channelPrefix = channelPrefix;
    this.machineId = machineId;
  }

  async connect(): Promise<void> {
    if (!this.redisURL) return;

    this.publisher = new Redis(this.redisURL);
    this.subscriber = new Redis(this.redisURL);

    this.subscriber.on('message', (_channel: string, message: string) => {
      try {
        const parsed: PubSubMessage = JSON.parse(message);
        
        if (parsed.to && parsed.to !== this.machineId) {
          return;
        }

        const handler = this.messageHandlers.get(parsed.type);
        if (handler) {
          handler(parsed);
        }
      } catch (error) {
        this.logger.error('Failed to parse pub/sub message', error);
      }
    });

    await this.subscriber.subscribe(
      `${this.channelPrefix}broadcast`,
      `${this.channelPrefix}${this.machineId}`
    );

    this.logger.log(`Pub/Sub transport connected for machine ${this.machineId}`);
  }

  async publish(message: PubSubMessage): Promise<void> {
    if (!this.publisher) return;

    message.timestamp = Date.now();
    const channel = message.to
      ? `${this.channelPrefix}${message.to}`
      : `${this.channelPrefix}broadcast`;

    await this.publisher.publish(channel, JSON.stringify(message));
    this.logger.pubSub(`Published ${message.type} to ${channel}`);
  }

  on(messageType: string, handler: (message: PubSubMessage) => void): void {
    this.messageHandlers.set(messageType, handler);
  }

  async requestConnection(
    dbName: string,
    query: any,
    timeout: number = 2000
  ): Promise<{ machineId: string; hasConnection: boolean } | null> {
    if (!this.publisher) return null;

    return new Promise((resolve) => {
      const requestId = `${this.machineId}-${Date.now()}`;
      let resolved = false;

      const responseHandler = (msg: PubSubMessage) => {
        if (msg.data?.requestId === requestId && !resolved) {
          resolved = true;
          this.messageHandlers.delete('connection_response');
          resolve({
            machineId: msg.from,
            hasConnection: msg.data.hasConnection,
          });
        }
      };

      this.on('connection_response', responseHandler);

      this.publish({
        type: 'connection_request',
        from: this.machineId,
        dbName,
        query,
        data: { requestId },
        timestamp: Date.now(),
      });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.messageHandlers.delete('connection_response');
          resolve(null);
        }
      }, timeout);
    });
  }

  async streamData(
    to: string,
    data: any,
    chunkSize: number = 100000
  ): Promise<void> {
    if (!this.publisher) return;

    const serialized = JSON.stringify(data);
    const totalChunks = Math.ceil(serialized.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = serialized.slice(i * chunkSize, (i + 1) * chunkSize);
      await this.publish({
        type: 'data_stream',
        from: this.machineId,
        to,
        data: chunk,
        chunkIndex: i,
        totalChunks,
        timestamp: Date.now(),
      });
    }

    this.logger.pubSub(`Streamed data in ${totalChunks} chunks to ${to}`);
  }

  async receiveStreamedData(
    from: string,
    timeout: number = 5000
  ): Promise<any | null> {
    if (!this.subscriber) return null;

    return new Promise((resolve) => {
      const chunks: Map<number, string> = new Map();
      let totalChunks = 0;
      let resolved = false;

      const streamHandler = (msg: PubSubMessage) => {
        if (msg.from !== from || resolved) return;

        if (msg.chunkIndex !== undefined && msg.totalChunks !== undefined) {
          chunks.set(msg.chunkIndex, msg.data);
          totalChunks = msg.totalChunks;

          if (chunks.size === totalChunks) {
            resolved = true;
            this.messageHandlers.delete('data_stream');

            const fullData = Array.from({ length: totalChunks })
              .map((_, i) => chunks.get(i))
              .join('');

            try {
              resolve(JSON.parse(fullData));
            } catch {
              resolve(null);
            }
          }
        }
      };

      this.on('data_stream', streamHandler);

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.messageHandlers.delete('data_stream');
          resolve(null);
        }
      }, timeout);
    });
  }

  isEnabled(): boolean {
    return this.publisher !== null && this.subscriber !== null;
  }

  async close(): Promise<void> {
    if (this.publisher) await this.publisher.quit();
    if (this.subscriber) await this.subscriber.quit();
    this.messageHandlers.clear();
  }
}

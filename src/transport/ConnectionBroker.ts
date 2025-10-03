import { Connection } from 'mongoose';
import { PubSubTransport } from './PubSubTransport';
import { StateManager } from '../storage/StateManager';
import { Logger } from '../utils/Logger';
import { PubSubMessage } from '../types';

export class ConnectionBroker {
  private activeConnections: Map<string, Connection> = new Map();

  constructor(
    private pubSub: PubSubTransport,
    private stateManager: StateManager,
    private maxConnectionsPerDB: number,
    private logger: Logger
  ) {
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    this.pubSub.on('connection_request', async (msg: PubSubMessage) => {
      const hasConnection = this.activeConnections.has(msg.dbName!);
      
      await this.pubSub.publish({
        type: 'connection_response',
        from: this.stateManager.getMachineId(),
        to: msg.from,
        data: {
          requestId: msg.data?.requestId,
          hasConnection,
          dbName: msg.dbName,
        },
        timestamp: Date.now(),
      });

      if (hasConnection && msg.query) {
        const connection = this.activeConnections.get(msg.dbName!);
        try {
          const result = await this.executeQuery(connection!, msg.query);
          await this.pubSub.streamData(msg.from, result);
        } catch (error) {
          this.logger.error(`Failed to execute query for ${msg.from}`, error);
        }
      }
    });

    this.pubSub.on('connection_release', async (msg: PubSubMessage) => {
      if (msg.dbName) {
        this.activeConnections.delete(msg.dbName);
        await this.stateManager.deleteConnection(
          msg.dbName,
          this.stateManager.getMachineId()
        );
        this.logger.connection(`Released connection to ${msg.dbName}`);
      }
    });
  }

  async requestConnectionFromPeers(
    dbName: string,
    query: any
  ): Promise<any | null> {
    if (!this.pubSub.isEnabled()) return null;

    const response = await this.pubSub.requestConnection(dbName, query);
    
    if (response?.hasConnection) {
      this.logger.pubSub(`Machine ${response.machineId} has connection to ${dbName}`);
      const data = await this.pubSub.receiveStreamedData(response.machineId);
      return data;
    }

    return null;
  }

  async canAcceptNewConnection(dbName: string): Promise<boolean> {
    const activeCount = await this.stateManager.getActiveConnectionCount(dbName);
    return activeCount < this.maxConnectionsPerDB;
  }

  async shouldDelegateConnection(dbName: string): Promise<boolean> {
    const canAccept = await this.canAcceptNewConnection(dbName);
    return !canAccept && this.pubSub.isEnabled();
  }

  registerConnection(dbName: string, connection: Connection): void {
    this.activeConnections.set(dbName, connection);
    this.logger.connection(`Registered connection to ${dbName}`);
  }

  getConnection(dbName: string): Connection | undefined {
    return this.activeConnections.get(dbName);
  }

  hasConnection(dbName: string): boolean {
    return this.activeConnections.has(dbName);
  }

  async releaseConnection(dbName: string): Promise<void> {
    if (this.activeConnections.has(dbName)) {
      this.activeConnections.delete(dbName);
      
      if (this.pubSub.isEnabled()) {
        await this.pubSub.publish({
          type: 'connection_release',
          from: this.stateManager.getMachineId(),
          dbName,
          timestamp: Date.now(),
        });
      }

      await this.stateManager.deleteConnection(
        dbName,
        this.stateManager.getMachineId()
      );
      
      this.logger.connection(`Released connection to ${dbName}`);
    }
  }

  private async executeQuery(connection: Connection, query: any): Promise<any> {
    const { model, operation, params } = query;
    const Model = connection.model(model);

    switch (operation) {
      case 'find':
        return await Model.find(params.filter || {});
      case 'findOne':
        return await Model.findOne(params.filter || {});
      case 'findById':
        return await Model.findById(params.id);
      case 'aggregate':
        return await Model.aggregate(params.pipeline || []);
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }
}

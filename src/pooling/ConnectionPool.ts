import mongoose, { Connection } from 'mongoose';
import { DatabaseConnection } from '../types';
import { StateManager } from '../storage/StateManager';
import { ConnectionBroker } from '../transport/ConnectionBroker';
import { MathOptimizer } from '../optimizers/MathOptimizer';
import { ConnectionScorer } from '../optimizers/ConnectionScorer';
import { Logger } from '../utils/Logger';

export class ConnectionPool {
  private connections: Map<string, Connection> = new Map();
  private connectionMetadata: Map<string, DatabaseConnection> = new Map();
  private keepAliveTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private mongoURI: string,
    private stateManager: StateManager,
    private broker: ConnectionBroker,
    private _maxConnectionsPerDB: number,
    private keepAliveAlgorithm: 'adaptive' | 'fixed' | 'exponential',
    private keepAliveBaseDuration: number,
    private logger: Logger
  ) {}

  async getConnection(dbName: string): Promise<Connection> {
    if (this.connections.has(dbName)) {
      await this.updateConnectionActivity(dbName);
      return this.connections.get(dbName)!;
    }

    const canConnect = await this.broker.canAcceptNewConnection(dbName);
    
    if (!canConnect) {
      const shouldDelegate = await this.broker.shouldDelegateConnection(dbName);
      if (shouldDelegate) {
        this.logger.log(`Max connections reached for ${dbName}, evicting oldest connection`);
      }
      
      await this.evictConnection(dbName);
    }

    return await this.createConnection(dbName);
  }

  private async createConnection(dbName: string): Promise<Connection> {
    const uri = `${this.mongoURI}/${dbName}`;
    const connection = await mongoose.createConnection(uri).asPromise();
    
    this.connections.set(dbName, connection);
    this.broker.registerConnection(dbName, connection);

    const metadata: DatabaseConnection = {
      dbName,
      machineId: this.stateManager.getMachineId(),
      connectedAt: Date.now(),
      lastUsed: Date.now(),
      queryCount: 0,
      priority: await this.stateManager.getPriority(dbName),
      isWatching: false,
    };

    this.connectionMetadata.set(dbName, metadata);
    await this.stateManager.saveConnection(metadata);
    
    this.scheduleKeepAlive(dbName);
    this.logger.connection(`Created connection to ${dbName}`);
    
    return connection;
  }

  private async updateConnectionActivity(dbName: string): Promise<void> {
    const metadata = this.connectionMetadata.get(dbName);
    if (metadata) {
      metadata.lastUsed = Date.now();
      metadata.queryCount++;
      this.connectionMetadata.set(dbName, metadata);
      await this.stateManager.saveConnection(metadata);
      await this.stateManager.updateConnectionActivity(dbName);
      
      this.scheduleKeepAlive(dbName);
    }
  }

  private scheduleKeepAlive(dbName: string): void {
    if (this.keepAliveTimers.has(dbName)) {
      clearTimeout(this.keepAliveTimers.get(dbName)!);
    }

    const metadata = this.connectionMetadata.get(dbName);
    if (!metadata) return;

    const duration = MathOptimizer.calculateKeepAlive(
      metadata.queryCount,
      50,
      Date.now() - metadata.lastUsed,
      this.keepAliveAlgorithm,
      this.keepAliveBaseDuration
    );

    const timer = setTimeout(async () => {
      if (!metadata.isWatching) {
        await this.closeConnection(dbName);
      }
    }, duration);

    this.keepAliveTimers.set(dbName, timer);
  }

  private async evictConnection(dbName: string): Promise<void> {
    const allConnections = await this.stateManager.getConnections(dbName);
    const toEvict = ConnectionScorer.selectConnectionToEvict(allConnections);
    
    if (toEvict && toEvict.machineId === this.stateManager.getMachineId()) {
      await this.closeConnection(toEvict.dbName);
    }
  }

  async setWatching(dbName: string, watching: boolean): Promise<void> {
    const metadata = this.connectionMetadata.get(dbName);
    if (metadata) {
      metadata.isWatching = watching;
      this.connectionMetadata.set(dbName, metadata);
      await this.stateManager.saveConnection(metadata);
    }
  }

  async closeConnection(dbName: string): Promise<void> {
    const connection = this.connections.get(dbName);
    if (connection) {
      await connection.close();
      this.connections.delete(dbName);
      this.connectionMetadata.delete(dbName);
      
      if (this.keepAliveTimers.has(dbName)) {
        clearTimeout(this.keepAliveTimers.get(dbName)!);
        this.keepAliveTimers.delete(dbName);
      }

      await this.broker.releaseConnection(dbName);
      this.logger.connection(`Closed connection to ${dbName}`);
    }
  }

  async closeAll(): Promise<void> {
    for (const dbName of this.connections.keys()) {
      await this.closeConnection(dbName);
    }
  }

  hasConnection(dbName: string): boolean {
    return this.connections.has(dbName);
  }
}

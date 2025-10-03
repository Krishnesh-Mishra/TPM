import { Connection } from 'mongoose';
import { ConnectionPool } from './ConnectionPool';
import { StateManager } from '../storage/StateManager';
import { ConnectionBroker } from '../transport/ConnectionBroker';
import { Logger } from '../utils/Logger';

export class PoolManager {
  private pool: ConnectionPool;

  constructor(
    mongoURI: string,
    stateManager: StateManager,
    broker: ConnectionBroker,
    maxConnectionsPerDB: number,
    keepAliveAlgorithm: 'adaptive' | 'fixed' | 'exponential',
    keepAliveBaseDuration: number,
    logger: Logger
  ) {
    this.pool = new ConnectionPool(
      mongoURI,
      stateManager,
      broker,
      maxConnectionsPerDB,
      keepAliveAlgorithm,
      keepAliveBaseDuration,
      logger
    );
  }

  async getConnection(dbName: string): Promise<Connection> {
    return this.pool.getConnection(dbName);
  }

  async setWatching(dbName: string, watching: boolean): Promise<void> {
    await this.pool.setWatching(dbName, watching);
  }

  hasConnection(dbName: string): boolean {
    return this.pool.hasConnection(dbName);
  }

  async closeConnection(dbName: string): Promise<void> {
    await this.pool.closeConnection(dbName);
  }

  async closeAll(): Promise<void> {
    await this.pool.closeAll();
  }
}

import { MongoDBStorage } from './MongoDBStorage';
import { DatabaseConnection } from '../types';

export class StateManager {
  constructor(private storage: MongoDBStorage) {}

  async initialize(): Promise<void> {
    await this.storage.connect();
  }

  async savePriority(dbName: string, priority: number): Promise<void> {
    await this.storage.saveState(`priority:${dbName}`, priority);
  }

  async getPriority(dbName: string): Promise<number> {
    const priority = await this.storage.getState<number>(`priority:${dbName}`);
    return priority !== null ? priority : 100;
  }

  async saveConnection(conn: DatabaseConnection): Promise<void> {
    await this.storage.saveConnection(conn);
  }

  async getConnections(dbName?: string): Promise<DatabaseConnection[]> {
    return this.storage.getConnections(dbName);
  }

  async getActiveConnectionCount(dbName: string): Promise<number> {
    const connections = await this.getConnections(dbName);
    return connections.length;
  }

  async deleteConnection(dbName: string, machineId: string): Promise<void> {
    await this.storage.deleteConnection(dbName, machineId);
  }

  async updateConnectionActivity(dbName: string): Promise<void> {
    await this.storage.updateConnectionLastUsed(dbName);
  }

  async cleanupStaleConnections(maxAge: number = 300000): Promise<void> {
    await this.storage.cleanup(maxAge);
  }

  async saveModelConfig(modelName: string, config: any): Promise<void> {
    await this.storage.saveState(`model:${modelName}`, config);
  }

  async getModelConfig(modelName: string): Promise<any> {
    return this.storage.getState(`model:${modelName}`);
  }

  async saveGlobalConfig(config: any): Promise<void> {
    await this.storage.saveState('global:config', config);
  }

  async getGlobalConfig(): Promise<any> {
    return this.storage.getState('global:config');
  }

  getMachineId(): string {
    return this.storage.getMachineId();
  }

  async close(): Promise<void> {
    await this.storage.close();
  }
}

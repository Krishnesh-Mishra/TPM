import mongoose, { Connection, Schema } from 'mongoose';
import { DatabaseConnection } from '../types';

interface StateDocument {
  key: string;
  value: any;
  updatedAt: Date;
}

interface ConnectionDocument {
  dbName: string;
  machineId: string;
  connectedAt: Date;
  lastUsed: Date;
  queryCount: number;
  priority: number;
  isWatching: boolean;
}

export class MongoDBStorage {
  private connection: Connection | null = null;
  private stateModel: any;
  private connectionModel: any;
  private machineId: string;

  constructor(
    private mongoURI: string,
    private staticAssetDB: string
  ) {
    this.machineId = this.generateMachineId();
  }

  async connect(): Promise<void> {
    if (this.connection) return;

    const uri = `${this.mongoURI}/${this.staticAssetDB}`;
    this.connection = await mongoose.createConnection(uri).asPromise();

    const stateSchema = new Schema<StateDocument>({
      key: { type: String, required: true, unique: true, index: true },
      value: { type: Schema.Types.Mixed, required: true },
      updatedAt: { type: Date, default: Date.now },
    });

    const connectionSchema = new Schema<ConnectionDocument>({
      dbName: { type: String, required: true, index: true },
      machineId: { type: String, required: true, index: true },
      connectedAt: { type: Date, default: Date.now },
      lastUsed: { type: Date, default: Date.now },
      queryCount: { type: Number, default: 0 },
      priority: { type: Number, default: 100 },
      isWatching: { type: Boolean, default: false },
    });

    connectionSchema.index({ dbName: 1, machineId: 1 }, { unique: true });

    this.stateModel = this.connection.model('CacheState', stateSchema);
    this.connectionModel = this.connection.model('ConnectionState', connectionSchema);
  }

  async saveState(key: string, value: any): Promise<void> {
    await this.ensureConnected();
    await this.stateModel.findOneAndUpdate(
      { key },
      { key, value, updatedAt: new Date() },
      { upsert: true, new: true }
    );
  }

  async getState<T>(key: string): Promise<T | null> {
    await this.ensureConnected();
    const doc = await this.stateModel.findOne({ key });
    return doc ? doc.value : null;
  }

  async deleteState(key: string): Promise<void> {
    await this.ensureConnected();
    await this.stateModel.deleteOne({ key });
  }

  async saveConnection(conn: DatabaseConnection): Promise<void> {
    await this.ensureConnected();
    await this.connectionModel.findOneAndUpdate(
      { dbName: conn.dbName, machineId: conn.machineId },
      {
        ...conn,
        lastUsed: new Date(conn.lastUsed),
        connectedAt: new Date(conn.connectedAt),
      },
      { upsert: true, new: true }
    );
  }

  async getConnections(dbName?: string): Promise<DatabaseConnection[]> {
    await this.ensureConnected();
    const filter = dbName ? { dbName } : {};
    const docs = await this.connectionModel.find(filter);
    return docs.map((doc: any) => ({
      dbName: doc.dbName,
      machineId: doc.machineId,
      connectedAt: doc.connectedAt.getTime(),
      lastUsed: doc.lastUsed.getTime(),
      queryCount: doc.queryCount,
      priority: doc.priority,
      isWatching: doc.isWatching,
    }));
  }

  async deleteConnection(dbName: string, machineId: string): Promise<void> {
    await this.ensureConnected();
    await this.connectionModel.deleteOne({ dbName, machineId });
  }

  async updateConnectionLastUsed(dbName: string): Promise<void> {
    await this.ensureConnected();
    await this.connectionModel.findOneAndUpdate(
      { dbName, machineId: this.machineId },
      { lastUsed: new Date(), $inc: { queryCount: 1 } }
    );
  }

  async cleanup(maxAge: number): Promise<void> {
    await this.ensureConnected();
    const cutoff = new Date(Date.now() - maxAge);
    await this.connectionModel.deleteMany({
      lastUsed: { $lt: cutoff },
      isWatching: false,
    });
  }

  getMachineId(): string {
    return this.machineId;
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }
  }

  private generateMachineId(): string {
    const hostname = require('os').hostname();
    const pid = process.pid;
    const random = Math.random().toString(36).substring(2, 8);
    return `${hostname}-${pid}-${random}`;
  }
}

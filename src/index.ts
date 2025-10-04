import { Model } from 'mongoose';
import { TransparentCacheConfig, ModelConfig } from './types';
import { Logger } from './utils/Logger';
import { MongoDBStorage } from './storage/MongoDBStorage';
import { StateManager } from './storage/StateManager';
import { PubSubTransport } from './transport/PubSubTransport';
import { ConnectionBroker } from './transport/ConnectionBroker';
import { PoolManager } from './pooling/PoolManager';
import { CacheManager } from './core/CacheManager';
import { InvalidationEngine } from './core/InvalidationEngine';
import { ChangeStreamHandler } from './core/ChangeStreamHandler';
import { QueryInterceptor } from './proxy/QueryInterceptor';
import { ModelProxy } from './proxy/ModelProxy';
import { StatsCollector } from './monitoring/StatsCollector';
import { PerformanceMonitor } from './monitoring/PerformanceMonitor';

export class TransparentCache {
  private logger: Logger;
  private storage: MongoDBStorage;
  private stateManager: StateManager;
  private pubSub: PubSubTransport;
  private broker: ConnectionBroker;
  private poolManager: PoolManager;
  private cacheManager: CacheManager;
  private invalidationEngine: InvalidationEngine;
  private changeStreamHandler: ChangeStreamHandler;
  private interceptor: QueryInterceptor;
  private modelProxy: ModelProxy;
  private stats: StatsCollector;
  private perfMonitor: PerformanceMonitor;
  private initializationPromise: Promise<void> | null = null;
  private isInitialized: boolean = false;

  constructor(private config: TransparentCacheConfig) {
    this.validateConfig(config);

    this.logger = new Logger(config.debug || false);
    this.stats = new StatsCollector();
    this.perfMonitor = new PerformanceMonitor();

    this.storage = new MongoDBStorage(config.mongoURI, config.staticAssetDB);
    this.stateManager = new StateManager(this.storage);

    this.pubSub = new PubSubTransport(
      config.redisURL,
      config.connectionPooling?.pubSubChannelPrefix || 'tmc:pubsub:',
      this.storage.getMachineId(),
      this.logger
    );

    this.broker = new ConnectionBroker(
      this.pubSub,
      this.stateManager,
      config.connectionPooling?.maxConnectionsPerDB || 3,
      this.logger
    );

    this.poolManager = new PoolManager(
      config.mongoURI,
      this.stateManager,
      this.broker,
      config.connectionPooling?.maxConnectionsPerDB || 3,
      config.connectionPooling?.keepAliveAlgorithm || 'adaptive',
      config.connectionPooling?.keepAliveBaseDuration || 60000,
      this.logger
    );

    this.cacheManager = new CacheManager(
      config.redisURL,
      config.keyPrefix || 'tmc:',
      config.defaultTTL || 300,
      this.logger,
      this.stats,
      this.perfMonitor
    );

    this.invalidationEngine = new InvalidationEngine(this.cacheManager, this.logger);

    this.changeStreamHandler = new ChangeStreamHandler(
      this.invalidationEngine,
      this.pubSub,
      this.stateManager,
      this.logger
    );

    this.interceptor = new QueryInterceptor(
      this.cacheManager,
      this.invalidationEngine,
      this.logger
    );

    this.modelProxy = new ModelProxy(
      this.interceptor,
      this.changeStreamHandler,
      this.poolManager,
      this.logger,
      config.multiDB
    );
  }

  private validateConfig(config: TransparentCacheConfig): void {
    if (!config.mongoURI) {
      throw new Error('TransparentCache: mongoURI is required');
    }

    if (!config.staticAssetDB) {
      throw new Error('TransparentCache: staticAssetDB is required');
    }

    if (config.multiDB === undefined || config.multiDB === null) {
      throw new Error('TransparentCache: multiDB flag is required (must be true or false)');
    }

    if (config.performance?.modelPercentages) {
      const total = Object.values(config.performance.modelPercentages).reduce((a, b) => a + b, 0);
      if (total > 100) {
        throw new Error('TransparentCache: modelPercentages must sum to 100 or less');
      }
    }

    // this.logger.log('Configuration validated successfully');
  }

  connect(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeConnections();
    return this.initializationPromise;
  }

  private async initializeConnections(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.stateManager.initialize();
      
      if (this.config.redisURL) {
        await this.pubSub.connect();
        this.logger.log('Caching enabled with Redis');
      } else {
        this.logger.log('Caching disabled - operating as advanced multi-DB manager');
      }

      this.isInitialized = true;
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  }

  async initialize(): Promise<void> {
    return this.connect();
  }

  wrap<T>(model: Model<T>, config?: ModelConfig): Model<T> {
    if (!this.isInitialized && !this.initializationPromise) {
      this.connect().catch((err) => {
        this.logger.error('Background initialization failed', err);
      });
    }

    return this.modelProxy.wrap(model, config);
  }

  getStats() {
    return this.cacheManager.getStats();
  }

  async clearCache(modelName?: string): Promise<void> {
    await this.cacheManager.clear(modelName);
  }

  async close(): Promise<void> {
    await this.changeStreamHandler.unwatchAll();
    await this.poolManager.closeAll();
    await this.cacheManager.close();
    await this.pubSub.close();
    await this.stateManager.close();
    this.logger.log('TransparentCache closed successfully');
  }
}

export function createTransparentCache(config: TransparentCacheConfig): TransparentCache {
  const cache = new TransparentCache(config);
  return cache;
}

export * from './types';

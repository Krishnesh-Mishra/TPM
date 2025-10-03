import { RedisOptions } from 'ioredis';

export interface TransparentCacheConfig {
  mongoURI: string;
  staticAssetDB: string;
  multiDB: boolean;
  redisURL?: string;
  redis?: RedisOptions;
  defaultTTL?: number;
  keyPrefix?: string;
  debug?: boolean;
  connectionPooling?: ConnectionPoolingConfig;
  performance?: PerformanceConfig;
}

export interface ConnectionPoolingConfig {
  maxConnectionsPerDB?: number;
  keepAliveAlgorithm?: 'adaptive' | 'fixed' | 'exponential';
  keepAliveBaseDuration?: number;
  maxIdleTime?: number;
  pubSubChannelPrefix?: string;
  streamChunkSize?: number;
}

export interface PerformanceConfig {
  maxCacheSize?: string;
  modelPercentages?: Record<string, number>;
  evictionPolicy?: 'lru' | 'lfu' | 'ttl';
}

export interface ModelConfig {
  ttl?: number;
  priority?: number;
  cacheEnabled?: boolean;
}

export interface DatabaseConnection {
  dbName: string;
  machineId: string;
  connectedAt: number;
  lastUsed: number;
  queryCount: number;
  priority: number;
  isWatching: boolean;
}

export interface PubSubMessage {
  type: 'connection_request' | 'connection_response' | 'data_stream' | 'watch_update' | 'connection_release';
  from: string;
  to?: string;
  dbName?: string;
  modelName?: string;
  query?: any;
  data?: any;
  chunkIndex?: number;
  totalChunks?: number;
  timestamp: number;
}

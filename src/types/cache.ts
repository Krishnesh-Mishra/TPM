export interface CacheEntry {
  key: string;
  value: any;
  ttl: number;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  modelName: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  total: number;
  hitRate: number;
  memoryUsage: number;
  modelStats: Record<string, ModelStats>;
}

export interface ModelStats {
  hits: number;
  misses: number;
  entries: number;
  memoryUsage: number;
}

export interface InvalidationPattern {
  modelName: string;
  operation: MongooseOperation;
  filter?: any;
  update?: any;
  affectedKeys: string[];
}

export type MongooseOperation =
  | 'find'
  | 'findOne'
  | 'findById'
  | 'findByIdAndUpdate'
  | 'findOneAndUpdate'
  | 'findByIdAndDelete'
  | 'findOneAndDelete'
  | 'updateOne'
  | 'updateMany'
  | 'deleteOne'
  | 'deleteMany'
  | 'aggregate'
  | 'bulkWrite'
  | 'insertMany'
  | 'replaceOne'
  | 'save'
  | 'create';

export interface QueryOptions {
  noCache?: boolean;
  cacheTTL?: number;
}

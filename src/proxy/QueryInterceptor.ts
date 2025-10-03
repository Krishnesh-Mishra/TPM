import { CacheManager } from '../core/CacheManager';
import { InvalidationEngine } from '../core/InvalidationEngine';
import { Logger } from '../utils/Logger';
import { QueryOptions, MongooseOperation } from '../types';

export class QueryInterceptor {
  constructor(
    private cacheManager: CacheManager,
    private invalidationEngine: InvalidationEngine,
    private logger: Logger
  ) {}

  async interceptQuery<T>(
    modelName: string,
    operation: MongooseOperation,
    query: any,
    executor: () => Promise<T>,
    options?: QueryOptions
  ): Promise<T> {
    if (options?.noCache || !this.cacheManager.isEnabled()) {
      const start = Date.now();
      const result = await executor();
      const duration = Date.now() - start;
      
      if (options?.noCache) {
        this.logger.cacheSkip(modelName, operation, duration);
      }
      
      return result;
    }

    if (this.isReadOperation(operation)) {
      const cached = await this.cacheManager.get<T>(modelName, operation, query);
      
      if (cached !== null) {
        return cached;
      }

      const result = await executor();
      await this.cacheManager.set(modelName, operation, query, result, options?.cacheTTL);
      return result;
    }

    const result = await executor();
    await this.invalidationEngine.invalidateByOperation(modelName, operation, query.filter, query.update);
    return result;
  }

  private isReadOperation(operation: MongooseOperation): boolean {
    return ['find', 'findOne', 'findById', 'aggregate'].includes(operation);
  }

  async invalidate(modelName: string, operation: MongooseOperation, filter?: any, update?: any): Promise<void> {
    await this.invalidationEngine.invalidateByOperation(modelName, operation, filter, update);
  }
}

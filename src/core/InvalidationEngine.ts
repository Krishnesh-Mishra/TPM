import { CacheManager } from './CacheManager';
import { QuerySerializer } from '../utils/QuerySerializer';
import { Logger } from '../utils/Logger';
import { MongooseOperation } from '../types';

export class InvalidationEngine {
  constructor(
    private cacheManager: CacheManager,
    private logger: Logger
  ) {}

  async invalidateByOperation(
    modelName: string,
    operation: MongooseOperation,
    filter?: any,
    update?: any
  ): Promise<void> {
    if (!this.cacheManager.isEnabled()) {
      return;
    }

    switch (operation) {
      case 'findByIdAndUpdate':
      case 'findOneAndUpdate':
      case 'updateOne':
      case 'replaceOne':
        await this.invalidateUpdate(modelName, filter, update);
        break;

      case 'updateMany':
        await this.invalidateBulkUpdate(modelName, filter);
        break;

      case 'deleteOne':
      case 'findByIdAndDelete':
      case 'findOneAndDelete':
        await this.invalidateDelete(modelName, filter);
        break;

      case 'deleteMany':
        await this.invalidateBulkDelete(modelName, filter);
        break;

      case 'create':
      case 'save':
      case 'insertMany':
        await this.invalidateInsert(modelName);
        break;

      case 'bulkWrite':
        await this.invalidateBulkWrite(modelName);
        break;

      case 'aggregate':
        break;

      default:
        this.logger.warn(`Unknown operation for invalidation: ${operation}`);
    }
  }

  private async invalidateUpdate(modelName: string, filter?: any, update?: any): Promise<void> {
    const affectedFields = update ? QuerySerializer.extractAffectedFields(update) : [];
    
    if (filter?._id || filter?.id) {
      await this.cacheManager.invalidate(modelName, `findById:*`);
    }

    if (affectedFields.length > 0) {
      for (const field of affectedFields) {
        await this.cacheManager.invalidate(modelName, `*${field}*`);
      }
    }

    await this.cacheManager.invalidate(modelName, 'find:*');
    await this.cacheManager.invalidate(modelName, 'findOne:*');
    await this.cacheManager.invalidate(modelName, 'aggregate:*');
    
    this.logger.log(`Invalidated cache for ${modelName} after update operation`);
  }

  private async invalidateBulkUpdate(modelName: string, _filter?: any): Promise<void> {
    await this.cacheManager.invalidate(modelName);
    this.logger.log(`Invalidated all cache for ${modelName} after bulk update`);
  }

  private async invalidateDelete(modelName: string, filter?: any): Promise<void> {
    if (filter?._id || filter?.id) {
      await this.cacheManager.invalidate(modelName, `findById:*${filter._id || filter.id}*`);
    }

    await this.cacheManager.invalidate(modelName, 'find:*');
    await this.cacheManager.invalidate(modelName, 'findOne:*');
    await this.cacheManager.invalidate(modelName, 'aggregate:*');
    
    this.logger.log(`Invalidated cache for ${modelName} after delete operation`);
  }

  private async invalidateBulkDelete(modelName: string, _filter?: any): Promise<void> {
    await this.cacheManager.invalidate(modelName);
    this.logger.log(`Invalidated all cache for ${modelName} after bulk delete`);
  }

  private async invalidateInsert(modelName: string): Promise<void> {
    await this.cacheManager.invalidate(modelName, 'find:*');
    await this.cacheManager.invalidate(modelName, 'aggregate:*');
    
    this.logger.log(`Invalidated cache for ${modelName} after insert operation`);
  }

  private async invalidateBulkWrite(modelName: string): Promise<void> {
    await this.cacheManager.invalidate(modelName);
    this.logger.log(`Invalidated all cache for ${modelName} after bulk write`);
  }

  async invalidateModel(modelName: string): Promise<void> {
    await this.cacheManager.invalidate(modelName);
    this.logger.log(`Invalidated all cache for ${modelName}`);
  }

  async invalidateAll(): Promise<void> {
    await this.cacheManager.clear();
    this.logger.log('Invalidated all cache');
  }
}

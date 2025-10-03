import Redis from 'ioredis';
import { KeyGenerator } from '../utils/KeyGenerator';
import { Logger } from '../utils/Logger';
import { StatsCollector } from '../monitoring/StatsCollector';
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor';

export class CacheManager {
  private redis: Redis | null = null;
  private keyGen: KeyGenerator;
  private enabled: boolean = false;

  constructor(
    redisURL: string | undefined,
    keyPrefix: string,
    private defaultTTL: number,
    private logger: Logger,
    private stats: StatsCollector,
    private perfMonitor: PerformanceMonitor
  ) {
    this.keyGen = new KeyGenerator(keyPrefix);
    
    if (redisURL) {
      this.redis = new Redis(redisURL);
      this.enabled = true;
      this.logger.log('Cache manager enabled with Redis');
    } else {
      this.logger.log('Cache manager disabled - no Redis URL provided');
    }
  }

  async get<T>(modelName: string, operation: string, query: any): Promise<T | null> {
    if (!this.enabled || !this.redis) {
      return null;
    }

    const start = Date.now();
    const key = this.keyGen.generateKey(modelName, operation, query);
    
    try {
      const cached = await this.redis.get(key);
      const duration = Date.now() - start;
      this.perfMonitor.recordQueryTime(key, duration);
      
      if (cached) {
        this.stats.recordHit(modelName);
        this.logger.cacheHit(modelName, key, duration);
        return JSON.parse(cached) as T;
      }
      
      this.stats.recordMiss(modelName);
      this.logger.cacheMiss(modelName, key, duration);
      return null;
    } catch (error) {
      this.logger.error('Cache get error', error);
      return null;
    }
  }

  async set(modelName: string, operation: string, query: any, value: any, ttl?: number): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    const key = this.keyGen.generateKey(modelName, operation, query);
    const effectiveTTL = ttl || this.defaultTTL;
    
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, effectiveTTL, serialized);
      this.stats.incrementEntries(modelName);
      this.logger.log(`Cached ${modelName} with TTL ${effectiveTTL}s`);
    } catch (error) {
      this.logger.error('Cache set error', error);
    }
  }

  async invalidate(modelName: string, pattern?: string): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    try {
      const searchPattern = this.keyGen.generatePatternKey(modelName, pattern);
      const keys = await this.redis.keys(searchPattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(`Invalidated ${keys.length} keys for ${modelName}`);
        
        for (let i = 0; i < keys.length; i++) {
          this.stats.decrementEntries(modelName);
        }
      }
    } catch (error) {
      this.logger.error('Cache invalidation error', error);
    }
  }

  async clear(modelName?: string): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    try {
      if (modelName) {
        await this.invalidate(modelName);
      } else {
        await this.redis.flushdb();
        this.logger.log('Cleared entire cache');
      }
    } catch (error) {
      this.logger.error('Cache clear error', error);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getStats() {
    return this.stats.getStats();
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

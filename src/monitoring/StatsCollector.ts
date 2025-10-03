import { CacheStats } from '../types';

export class StatsCollector {
  private stats: CacheStats;

  constructor() {
    this.stats = {
      hits: 0,
      misses: 0,
      total: 0,
      hitRate: 0,
      memoryUsage: 0,
      modelStats: {},
    };
  }

  recordHit(modelName: string, size: number = 0): void {
    this.stats.hits++;
    this.stats.total++;
    this.updateModelStats(modelName, 'hit', size);
    this.calculateHitRate();
  }

  recordMiss(modelName: string): void {
    this.stats.misses++;
    this.stats.total++;
    this.updateModelStats(modelName, 'miss');
    this.calculateHitRate();
  }

  updateMemoryUsage(bytes: number): void {
    this.stats.memoryUsage = bytes;
  }

  private updateModelStats(modelName: string, type: 'hit' | 'miss', size: number = 0): void {
    if (!this.stats.modelStats[modelName]) {
      this.stats.modelStats[modelName] = {
        hits: 0,
        misses: 0,
        entries: 0,
        memoryUsage: 0,
      };
    }

    const modelStat = this.stats.modelStats[modelName];
    if (type === 'hit') {
      modelStat.hits++;
      modelStat.memoryUsage += size;
    } else {
      modelStat.misses++;
    }
  }

  incrementEntries(modelName: string): void {
    if (!this.stats.modelStats[modelName]) {
      this.stats.modelStats[modelName] = {
        hits: 0,
        misses: 0,
        entries: 0,
        memoryUsage: 0,
      };
    }
    this.stats.modelStats[modelName].entries++;
  }

  decrementEntries(modelName: string): void {
    if (this.stats.modelStats[modelName]) {
      this.stats.modelStats[modelName].entries--;
    }
  }

  private calculateHitRate(): void {
    if (this.stats.total > 0) {
      this.stats.hitRate = (this.stats.hits / this.stats.total) * 100;
    } else {
      this.stats.hitRate = 0;
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  reset(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      total: 0,
      hitRate: 0,
      memoryUsage: 0,
      modelStats: {},
    };
  }
}

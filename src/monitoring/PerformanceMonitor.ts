export class PerformanceMonitor {
  private queryTimes: Map<string, number[]> = new Map();

  recordQueryTime(key: string, duration: number): void {
    if (!this.queryTimes.has(key)) {
      this.queryTimes.set(key, []);
    }
    
    const times = this.queryTimes.get(key)!;
    times.push(duration);
    
    if (times.length > 100) {
      times.shift();
    }
  }

  getAverageTime(key: string): number {
    const times = this.queryTimes.get(key);
    if (!times || times.length === 0) return 0;
    
    const sum = times.reduce((a, b) => a + b, 0);
    return sum / times.length;
  }

  getP95Time(key: string): number {
    const times = this.queryTimes.get(key);
    if (!times || times.length === 0) return 0;
    
    const sorted = [...times].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index] || 0;
  }

  clearMetrics(key?: string): void {
    if (key) {
      this.queryTimes.delete(key);
    } else {
      this.queryTimes.clear();
    }
  }
}

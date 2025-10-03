export class MathOptimizer {
  static calculateKeepAlive(
    queryCount: number,
    avgQueryTime: number,
    timeSinceLastQuery: number,
    algorithm: 'adaptive' | 'fixed' | 'exponential' = 'adaptive',
    baseDuration: number = 60000
  ): number {
    switch (algorithm) {
      case 'fixed':
        return baseDuration;

      case 'exponential':
        const multiplier = Math.min(queryCount / 10, 5);
        return baseDuration * Math.pow(2, multiplier);

      case 'adaptive':
      default:
        const frequency = queryCount / (timeSinceLastQuery || 1);
        const speedFactor = Math.max(0.5, Math.min(2, 100 / (avgQueryTime || 50)));
        const recencyFactor = Math.exp(-timeSinceLastQuery / 300000);
        
        const score = frequency * speedFactor * recencyFactor;
        const duration = baseDuration * (1 + Math.log10(score + 1));
        
        return Math.min(Math.max(duration, 10000), 600000);
    }
  }

  static calculateMemoryAllocation(
    totalMemory: number,
    modelPercentages: Record<string, number>
  ): Record<string, number> {
    const allocations: Record<string, number> = {};
    
    for (const [model, percentage] of Object.entries(modelPercentages)) {
      allocations[model] = (totalMemory * percentage) / 100;
    }
    
    return allocations;
  }

  static shouldEvict(
    currentSize: number,
    maxSize: number,
    threshold: number = 0.9
  ): boolean {
    return currentSize >= maxSize * threshold;
  }

  static calculatePriorityScore(
    priority: number,
    queryCount: number,
    lastUsed: number
  ): number {
    const ageFactor = Date.now() - lastUsed;
    const usageWeight = Math.log10(queryCount + 1);
    const priorityWeight = (200 - priority) / 200;
    
    return (usageWeight * 0.4) + (priorityWeight * 0.6) - (ageFactor / 1000000);
  }
}

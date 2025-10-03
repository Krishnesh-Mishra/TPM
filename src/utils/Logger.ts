export class Logger {
  constructor(private debug: boolean = false) {}

  log(message: string, ...args: any[]) {
    if (this.debug) {
      console.log(`[TransparentCache] ${message}`, ...args);
    }
  }

  cacheHit(modelName: string, key: string, duration: number) {
    if (this.debug) {
      console.log(`✅ CACHE HIT: ${modelName} - ${key} - ${duration}ms`);
    }
  }

  cacheMiss(modelName: string, key: string, duration: number) {
    if (this.debug) {
      console.log(`❌ CACHE MISS: ${modelName} - ${key} - ${duration}ms`);
    }
  }

  cacheSkip(modelName: string, key: string, duration: number) {
    if (this.debug) {
      console.log(`🚫 CACHE SKIP: ${modelName} - ${key} - ${duration}ms [noCache()]`);
    }
  }

  error(message: string, error?: any) {
    console.error(`[TransparentCache ERROR] ${message}`, error);
  }

  warn(message: string) {
    console.warn(`[TransparentCache WARN] ${message}`);
  }

  pubSub(message: string, data?: any) {
    if (this.debug) {
      console.log(`📡 PUB/SUB: ${message}`, data || '');
    }
  }

  connection(message: string, dbName?: string) {
    if (this.debug) {
      console.log(`🔌 CONNECTION: ${message}`, dbName || '');
    }
  }
}

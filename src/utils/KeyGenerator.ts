import crypto from 'crypto';

export class KeyGenerator {
  constructor(private prefix: string = 'tmc:') {}

  generateKey(modelName: string, operation: string, query: any): string {
    const serialized = this.serializeQuery(query);
    const hash = crypto.createHash('md5').update(serialized).digest('hex');
    return `${this.prefix}${modelName}:${operation}:${hash}`;
  }

  generatePatternKey(modelName: string, pattern?: string): string {
    if (pattern) {
      return `${this.prefix}${modelName}:${pattern}`;
    }
    return `${this.prefix}${modelName}:*`;
  }

  private serializeQuery(query: any): string {
    if (query === null || query === undefined) {
      return 'null';
    }

    if (typeof query === 'string' || typeof query === 'number' || typeof query === 'boolean') {
      return String(query);
    }

    if (Array.isArray(query)) {
      return `[${query.map((item) => this.serializeQuery(item)).join(',')}]`;
    }

    if (typeof query === 'object') {
      const sorted = Object.keys(query)
        .sort()
        .map((key) => `${key}:${this.serializeQuery(query[key])}`)
        .join('|');
      return `{${sorted}}`;
    }

    return String(query);
  }

  extractModelFromKey(key: string): string | null {
    const parts = key.replace(this.prefix, '').split(':');
    return parts[0] || null;
  }
}

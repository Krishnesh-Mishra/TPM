export class QuerySerializer {
  static serialize(query: any): string {
    return JSON.stringify(this.normalizeQuery(query));
  }

  static deserialize(serialized: string): any {
    try {
      return JSON.parse(serialized);
    } catch {
      return null;
    }
  }

  private static normalizeQuery(query: any): any {
    if (query === null || query === undefined) {
      return null;
    }

    if (typeof query === 'string' || typeof query === 'number' || typeof query === 'boolean') {
      return query;
    }

    if (query instanceof Date) {
      return { $date: query.toISOString() };
    }

    if (query instanceof RegExp) {
      return { $regex: query.source, $flags: query.flags };
    }

    if (Array.isArray(query)) {
      return query.map((item) => this.normalizeQuery(item));
    }

    if (typeof query === 'object') {
      const normalized: any = {};
      Object.keys(query)
        .sort()
        .forEach((key) => {
          normalized[key] = this.normalizeQuery(query[key]);
        });
      return normalized;
    }

    return query;
  }

  static extractAffectedFields(update: any): string[] {
    const fields: string[] = [];

    const traverse = (obj: any, prefix = '') => {
      if (!obj || typeof obj !== 'object') return;

      Object.keys(obj).forEach((key) => {
        if (key.startsWith('$')) {
          if (typeof obj[key] === 'object') {
            traverse(obj[key], prefix);
          }
        } else {
          const fieldPath = prefix ? `${prefix}.${key}` : key;
          fields.push(fieldPath);
          if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            traverse(obj[key], fieldPath);
          }
        }
      });
    };

    traverse(update);
    return [...new Set(fields)];
  }
}

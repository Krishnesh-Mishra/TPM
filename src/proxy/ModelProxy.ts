import { Model, Query } from 'mongoose';
import { QueryInterceptor } from './QueryInterceptor';
import { ChangeStreamHandler } from '../core/ChangeStreamHandler';
import { PoolManager } from '../pooling/PoolManager';
import { Logger } from '../utils/Logger';
import { ModelConfig, QueryOptions } from '../types';

export class ModelProxy {
  constructor(
    private interceptor: QueryInterceptor,
    private changeStreamHandler: ChangeStreamHandler,
    private poolManager: PoolManager,
    private _logger: Logger,
    private multiDB: boolean
  ) {}

  wrap<T>(model: Model<T>, config?: ModelConfig): Model<T> {
    const modelName = model.modelName;
    const self = this;

    const proxiedModel: any = new Proxy(model, {
      get(target: any, prop: string) {
        const original = target[prop];

        if (prop === 'db' && self.multiDB) {
          return (dbName: string) => {
            return self.createDBProxy(model, dbName, config);
          };
        }

        if (prop === 'watch') {
          return async () => {
            const connection = model.db as any;
            await self.changeStreamHandler.watch(modelName, model, connection);
            await self.poolManager.setWatching(connection.name, true);
            return { unwatch: () => self.changeStreamHandler.unwatch(modelName) };
          };
        }

        const readMethods = ['find', 'findOne', 'findById', 'aggregate'];
        const writeMethods = [
          'findByIdAndUpdate', 'findOneAndUpdate', 'updateOne', 'updateMany',
          'deleteOne', 'deleteMany', 'create', 'insertMany', 'bulkWrite',
          'replaceOne', 'save', 'findByIdAndDelete', 'findOneAndDelete'
        ];

        if (readMethods.includes(prop) || writeMethods.includes(prop)) {
          return function(...args: any[]) {
            const query = original.apply(target, args);
            return self.proxyQuery(query, modelName, prop, config);
          };
        }

        return typeof original === 'function' ? original.bind(target) : original;
      },
    });

    return proxiedModel;
  }

  private createDBProxy(model: any, dbName: string, config?: ModelConfig): any {
    const self = this;
    
    return new Proxy(model, {
      get(target: any, prop: string) {
        const original = target[prop];

        const readMethods = ['find', 'findOne', 'findById', 'aggregate'];
        const writeMethods = [
          'findByIdAndUpdate', 'findOneAndUpdate', 'findByIdAndDelete', 'findOneAndDelete',
          'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 
          'create', 'insertMany', 'bulkWrite', 'replaceOne', 'save'
        ];

        if (readMethods.includes(prop) || writeMethods.includes(prop)) {
          return async function(...args: any[]) {
            const connection = await self.poolManager.getConnection(dbName);
            const DBModel = connection.model(model.modelName);
            const query = (DBModel as any)[prop](...args);
            return self.proxyQuery(query, model.modelName, prop, config);
          };
        }

        return typeof original === 'function' ? original.bind(target) : original;
      },
    });
  }

  private proxyQuery(query: any, modelName: string, operation: string, config?: ModelConfig): any {
    const self = this;
    let queryOptions: QueryOptions = {};

    const proxiedQuery = new Proxy(query, {
      get(target: any, prop: string) {
        if (prop === 'noCache') {
          return () => {
            queryOptions.noCache = true;
            return proxiedQuery;
          };
        }

        if (prop === 'cacheTTL') {
          return (ttl: number) => {
            queryOptions.cacheTTL = ttl;
            return proxiedQuery;
          };
        }

        if (prop === 'exec') {
          return async () => {
            return self.interceptor.interceptQuery(
              modelName,
              operation as any,
              self.extractQueryParams(target),
              () => target.exec(),
              { ...queryOptions, cacheTTL: queryOptions.cacheTTL || config?.ttl }
            );
          };
        }

        if (prop === 'then') {
          return async (resolve: any, reject: any) => {
            try {
              const result = await self.interceptor.interceptQuery(
                modelName,
                operation as any,
                self.extractQueryParams(target),
                () => target.exec(),
                { ...queryOptions, cacheTTL: queryOptions.cacheTTL || config?.ttl }
              );
              resolve(result);
            } catch (error) {
              reject(error);
            }
          };
        }

        const original = target[prop];
        return typeof original === 'function' ? original.bind(target) : original;
      },
    });

    return proxiedQuery;
  }

  private extractQueryParams(query: Query<any, any>): any {
    return {
      filter: query.getFilter(),
      update: query.getUpdate(),
      options: query.getOptions(),
    };
  }
}

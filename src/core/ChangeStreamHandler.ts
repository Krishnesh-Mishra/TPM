import { Model, Connection } from 'mongoose';
import { InvalidationEngine } from './InvalidationEngine';
import { PubSubTransport } from '../transport/PubSubTransport';
import { StateManager } from '../storage/StateManager';
import { Logger } from '../utils/Logger';
import { PubSubMessage } from '../types';

export class ChangeStreamHandler {
  private watchedModels: Map<string, any> = new Map();
  private isWatchLeader: Map<string, boolean> = new Map();
  private leaseRenewalIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly LEASE_DURATION = 30000;
  private readonly LEASE_RENEWAL = 15000;

  constructor(
    private invalidationEngine: InvalidationEngine,
    private pubSub: PubSubTransport,
    private stateManager: StateManager,
    private logger: Logger
  ) {
    this.setupWatchUpdateHandler();
  }

  private setupWatchUpdateHandler(): void {
    this.pubSub.on('watch_update', async (msg: PubSubMessage) => {
      if (msg.modelName && msg.data) {
        await this.invalidationEngine.invalidateByOperation(
          msg.modelName,
          msg.data.operationType,
          msg.data.documentKey,
          msg.data.updateDescription
        );
        this.logger.log(`Received watch update for ${msg.modelName} from ${msg.from}`);
      }
    });
  }

  async watch(modelName: string, model: Model<any>, _connection: Connection): Promise<void> {
    if (this.watchedModels.has(modelName)) {
      return;
    }

    if (this.pubSub.isEnabled()) {
      const shouldBeLeader = await this.electWatchLeader(modelName);
      
      if (!shouldBeLeader) {
        this.logger.log(`Not watch leader for ${modelName}, relying on pub/sub`);
        return;
      }
    }

    this.isWatchLeader.set(modelName, true);
    this.logger.log(`Elected as watch leader for ${modelName}`);

    try {
      const changeStream = model.watch();

      changeStream.on('change', async (change: any) => {
        const operationType = change.operationType;
        const documentKey = change.documentKey;
        const updateDescription = change.updateDescription;

        await this.invalidationEngine.invalidateByOperation(
          modelName,
          this.mapChangeOperation(operationType),
          documentKey,
          updateDescription
        );

        if (this.pubSub.isEnabled()) {
          await this.pubSub.publish({
            type: 'watch_update',
            from: this.pubSub['machineId'],
            modelName,
            data: {
              operationType,
              documentKey,
              updateDescription,
            },
            timestamp: Date.now(),
          });
        }
      });

      changeStream.on('error', (error: Error) => {
        this.logger.error(`Change stream error for ${modelName}`, error);
        this.watchedModels.delete(modelName);
        this.isWatchLeader.delete(modelName);
      });

      this.watchedModels.set(modelName, changeStream);
      this.logger.log(`Started watching ${modelName}`);
    } catch (error) {
      this.logger.error(`Failed to start watch for ${modelName}`, error);
    }
  }

  private async electWatchLeader(modelName: string): Promise<boolean> {
    const leaseKey = `watch:lease:${modelName}`;
    const currentLease = await this.stateManager['storage'].getState<{ holder: string; expires: number }>(leaseKey);
    const now = Date.now();
    const machineId = this.stateManager.getMachineId();

    if (currentLease && currentLease.expires > now) {
      return currentLease.holder === machineId;
    }

    const newLease = {
      holder: machineId,
      expires: now + this.LEASE_DURATION
    };
    
    await this.stateManager['storage'].saveState(leaseKey, newLease);
    
    const interval = setInterval(async () => {
      const lease = await this.stateManager['storage'].getState<{ holder: string; expires: number }>(leaseKey);
      if (lease && lease.holder === machineId) {
        await this.stateManager['storage'].saveState(leaseKey, {
          holder: machineId,
          expires: Date.now() + this.LEASE_DURATION
        });
      } else {
        clearInterval(interval);
        this.leaseRenewalIntervals.delete(modelName);
      }
    }, this.LEASE_RENEWAL);
    
    this.leaseRenewalIntervals.set(modelName, interval);
    this.logger.log(`Acquired watch lease for ${modelName}`);
    
    return true;
  }

  private mapChangeOperation(changeOp: string): any {
    const mapping: Record<string, any> = {
      insert: 'create',
      update: 'updateOne',
      replace: 'replaceOne',
      delete: 'deleteOne',
    };
    return mapping[changeOp] || changeOp;
  }

  async unwatch(modelName: string): Promise<void> {
    const stream = this.watchedModels.get(modelName);
    if (stream) {
      await stream.close();
      this.watchedModels.delete(modelName);
      this.isWatchLeader.delete(modelName);
      this.logger.log(`Stopped watching ${modelName}`);
    }
  }

  async unwatchAll(): Promise<void> {
    for (const modelName of this.watchedModels.keys()) {
      await this.unwatch(modelName);
    }
  }

  isWatching(modelName: string): boolean {
    return this.watchedModels.has(modelName);
  }

  isLeader(modelName: string): boolean {
    return this.isWatchLeader.get(modelName) || false;
  }
}

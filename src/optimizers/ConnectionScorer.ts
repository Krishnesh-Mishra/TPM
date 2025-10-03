import { DatabaseConnection } from '../types';

export class ConnectionScorer {
  static scoreConnection(conn: DatabaseConnection): number {
    const age = Date.now() - conn.lastUsed;
    const lifespan = Date.now() - conn.connectedAt;
    
    const ageScore = Math.max(0, 100 - (age / 1000));
    const usageScore = Math.min(100, conn.queryCount * 2);
    const lifespanScore = Math.min(100, lifespan / 60000);
    const priorityScore = (200 - conn.priority) / 2;
    const watchBonus = conn.isWatching ? 200 : 0;
    
    return ageScore * 0.3 + usageScore * 0.3 + lifespanScore * 0.1 + priorityScore * 0.3 + watchBonus;
  }

  static selectConnectionToEvict(connections: DatabaseConnection[]): DatabaseConnection | null {
    if (connections.length === 0) return null;
    
    const nonWatchingConnections = connections.filter(c => !c.isWatching);
    
    if (nonWatchingConnections.length === 0) return null;
    
    let lowestScore = Infinity;
    let selected: DatabaseConnection | null = null;
    
    for (const conn of nonWatchingConnections) {
      const score = this.scoreConnection(conn);
      if (score < lowestScore) {
        lowestScore = score;
        selected = conn;
      }
    }
    
    return selected;
  }

  static sortByPriority(connections: DatabaseConnection[]): DatabaseConnection[] {
    return [...connections].sort((a, b) => {
      if (a.isWatching !== b.isWatching) {
        return a.isWatching ? -1 : 1;
      }
      
      const scoreA = this.scoreConnection(a);
      const scoreB = this.scoreConnection(b);
      
      return scoreB - scoreA;
    });
  }

  static shouldKeepAlive(
    conn: DatabaseConnection,
    maxIdleTime: number = 300000
  ): boolean {
    if (conn.isWatching) return true;
    
    const idleTime = Date.now() - conn.lastUsed;
    return idleTime < maxIdleTime;
  }
}

# Transparent Mongoose Cache

> Zero-config Redis caching for Mongoose with automatic invalidation and distributed connection pooling

[![npm version](https://badge.fury.io/js/transparent-mongoose-cache.svg)](https://badge.fury.io/js/transparent-mongoose-cache)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Conditional Caching**: Works with or without Redis - functions as advanced multi-DB manager without Redis, adds transparent caching when Redis URL provided
- **MongoDB State Persistence**: All cache metadata stored in MongoDB for load balancer consistency
- **Comprehensive Invalidation**: Automatic cache clearing for ALL Mongoose operations (find, findOne, findById, findByIdAndUpdate, findOneAndUpdate, updateOne, updateMany, deleteOne, deleteMany, aggregate, bulkWrite, insertMany, etc.)
- **Multi-Database Support**: Dynamic database creation and intelligent connection pooling
- **Mathematical Keep-Alive**: Adaptive, fixed, and exponential algorithms for connection management
- **Performance Monitoring**: Built-in stats collection and performance tracking
- **Query-Level Control**: `.noCache()` and `.cacheTTL()` methods for fine-grained control
- **TypeScript Support**: Full type definitions included

## Installation

```bash
npm install transparent-mongoose-cache
```

## Quick Start

```javascript
const { createTransparentCache } = require('transparent-mongoose-cache');
const mongoose = require('mongoose');

// Required configuration
const cache = createTransparentCache({
  mongoURI: 'mongodb://localhost:27017',     // REQUIRED
  staticAssetDB: 'cache-metadata',           // REQUIRED  
  multiDB: true,                             // REQUIRED
  redisURL: 'redis://localhost:6379',        // OPTIONAL - enables caching
  defaultTTL: 300,
  debug: true
});

await cache.initialize();

// Wrap your models
const User = mongoose.model('User', userSchema);
const CachedUser = cache.wrap(User);

// Use normally - caching happens automatically
const users = await CachedUser.find({ active: true });  // Cached
const user = await CachedUser.findById(userId);          // Cached

// Updates automatically invalidate cache
await CachedUser.updateOne({ _id: userId }, { name: 'John' });  // Cache cleared

// Skip cache when needed
const fresh = await CachedUser.findById(userId).noCache();

// Custom TTL
const premium = await CachedUser.find({ plan: 'premium' }).cacheTTL(3600);
```

## Configuration

### Required Parameters

```javascript
{
  mongoURI: string,      // MongoDB connection URI
  staticAssetDB: string, // Database name for storing cache metadata
  multiDB: boolean       // Enable/disable multi-database support
}
```

### Optional Parameters

```javascript
{
  redisURL: string,               // Redis URL (if not provided, caching is disabled)
  defaultTTL: number,             // Default cache TTL in seconds (default: 300)
  keyPrefix: string,              // Cache key prefix (default: 'tmc:')
  debug: boolean,                 // Enable debug logging (default: false)
  
  connectionPooling: {
    maxConnectionsPerDB: number,  // Max connections per database (default: 3)
    keepAliveAlgorithm: 'adaptive' | 'fixed' | 'exponential',
    keepAliveBaseDuration: number // Base duration in ms (default: 60000)
  },
  
  performance: {
    maxCacheSize: string,         // '2000mb' or '50%'
    modelPercentages: {           // Memory allocation per model
      User: 40,
      Post: 35,
      Comment: 25
    }
  }
}
```

## Multi-Database Support

```javascript
// Enable multi-DB mode
const cache = createTransparentCache({
  mongoURI: 'mongodb://localhost:27017',
  staticAssetDB: 'cache-metadata',
  multiDB: true,
  redisURL: 'redis://localhost:6379'
});

// Access different databases dynamically
const clientData = await User.db('client-abc').find({});
const testData = await User.db('test-2024').findById(id);
```

## Without Redis (Advanced Multi-DB Manager)

```javascript
// Works without Redis - no caching, just enhanced DB management
const cache = createTransparentCache({
  mongoURI: 'mongodb://localhost:27017',
  staticAssetDB: 'cache-metadata',
  multiDB: true
  // No redisURL - caching disabled
});

// Still provides connection pooling and multi-DB features
const User = cache.wrap(mongoose.model('User'));
const data = await User.db('dynamic-db').find({});
```

## Monitoring

```javascript
// Get cache statistics
const stats = cache.getStats();
console.log({
  hitRate: `${stats.hitRate}%`,
  totalQueries: stats.total,
  cacheSize: stats.memoryUsage,
  modelStats: stats.modelStats
});

// Clear cache
await cache.clearCache();              // Clear all
await cache.clearCache('User');        // Clear specific model
```

## Supported Operations

All Mongoose operations are fully supported with automatic cache invalidation:

**Read Operations** (cached):
- `find()`, `findOne()`, `findById()`, `aggregate()`

**Write Operations** (invalidate cache):
- `updateOne()`, `updateMany()`, `findByIdAndUpdate()`, `findOneAndUpdate()`, `replaceOne()`
- `deleteOne()`, `deleteMany()`, `findByIdAndDelete()`, `findOneAndDelete()`
- `create()`, `save()`, `insertMany()`, `bulkWrite()`

## API Reference

### `createTransparentCache(config)`
Creates and initializes a new cache instance.

### `cache.wrap(model, config?)`
Wraps a Mongoose model with caching capabilities.

### `cache.getStats()`
Returns cache statistics.

### `cache.clearCache(modelName?)`
Clears cache for specific model or all models.

### `cache.close()`
Closes all connections and cleans up resources.

## Requirements

- Node.js >= 16.0.0
- MongoDB (with replica set for change streams)
- Redis (optional - for caching)
- Mongoose ^7.0.0

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please use the GitHub issue tracker.

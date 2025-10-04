const { createTransparentCache } = require('../dist/index.js');
const mongoose = require('mongoose');

async function example() {
  const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    active: Boolean
  });

  const User = mongoose.model('User', userSchema);

  const cache = createTransparentCache({
    mongoURI: 'mongodb://localhost:27017',
    staticAssetDB: 'cache-metadata',
    multiDB: true,
    redisURL: 'redis://localhost:6379',
    defaultTTL: 300,
    debug: true,
    connectionPooling: {
      maxConnectionsPerDB: 3,
      keepAliveAlgorithm: 'adaptive'
    }
  });

  await cache.initialize();

  const CachedUser = cache.wrap(User, { ttl: 600, priority: 10 });

  const users = await CachedUser.find({ active: true });
  console.log('Found users:', users.length);

  const user = await CachedUser.findById('507f1f77bcf86cd799439011');
  console.log('Found user:', user);

  const stats = cache.getStats();
  console.log('Cache stats:', stats);

  await cache.close();
}

if (require.main === module) {
  example().catch(console.error);
}

module.exports = { example };

const { createTransparentCache } = require('../../dist/index');
const UserModel = require('./UserModel');
const PostModel = require('./PostModel');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const cache = createTransparentCache({
  mongoURI: MONGO_URI,
  staticAssetDB: 'cache-metadata',
  multiDB: true,
  redisURL: REDIS_URL,
  debug: true
});

cache.connect().catch((err) => {
  console.error('Failed to connect cache:', err.message);
});

const User = cache.wrap(UserModel , {
  cacheEnabled: true,
  priority:1,
});
const Post = cache.wrap(PostModel);

module.exports = {
  cache,
  User,
  Post
};

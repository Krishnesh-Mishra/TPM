const express = require('express');
const { cache } = require('./models');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Transparent Mongoose Cache Demo API',
    version: '1.0.0',
    features: [
      'Multi-database support with dynamic switching',
      'Automatic Redis caching (when configured)',
      'Automatic cache invalidation',
      'Query-level cache control',
      'Production-ready architecture'
    ],
    endpoints: {
      users: {
        'POST /api/users': 'Create user (requires dbName in body)',
        'GET /api/users/:dbName': 'Get all users from database',
        'GET /api/users/:dbName/:id': 'Get user by ID',
        'PUT /api/users/:dbName/:id': 'Update user',
        'DELETE /api/users/:dbName/:id': 'Delete user',
        'GET /api/users/:dbName/search/email?email=': 'Search user by email'
      },
      posts: {
        'POST /api/posts': 'Create post (requires dbName in body)',
        'GET /api/posts/:dbName': 'Get all posts from database',
        'GET /api/posts/:dbName/:id': 'Get post by ID',
        'PUT /api/posts/:dbName/:id': 'Update post',
        'DELETE /api/posts/:dbName/:id': 'Delete post',
        'PATCH /api/posts/:dbName/:id/views': 'Increment view count',
        'PATCH /api/posts/:dbName/:id/likes': 'Increment like count',
        'GET /api/posts/:dbName/category/:category': 'Get posts by category'
      },
      system: {
        'GET /api/stats': 'Get cache statistics',
        'GET /api/health': 'Health check'
      }
    },
    examples: {
      createUser: {
        method: 'POST',
        url: '/api/users',
        body: {
          dbName: 'company-a',
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
          role: 'user',
          plan: 'premium'
        }
      },
      createPost: {
        method: 'POST',
        url: '/api/posts',
        body: {
          dbName: 'company-a',
          title: 'My First Post',
          content: 'This is the content of my post...',
          author: '507f1f77bcf86cd799439011',
          category: 'technology',
          tags: ['nodejs', 'mongodb', 'caching'],
          published: true
        }
      }
    },
    documentation: 'See README.md for full API documentation'
  });
});

app.use('/api', routes);

app.get('/api/stats', async (req, res) => {
  try {
    const stats = cache.getStats();
    res.json({ 
      success: true, 
      data: stats 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      mongoConfigured: !!process.env.MONGO_URI,
      redisConfigured: !!process.env.REDIS_URL
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: 'The requested endpoint does not exist',
    availableEndpoints: 'Visit GET / for API documentation'
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║       Transparent Mongoose Cache Demo Server               ║
╚════════════════════════════════════════════════════════════╝

🚀 Server running at: http://localhost:${PORT}
📦 API Documentation: http://localhost:${PORT}/

Environment:
  • Node: ${process.version}
  • MongoDB URI: ${process.env.MONGO_URI ? '✓ Configured' : '✗ Not set (using localhost)'}
  • Redis URL: ${process.env.REDIS_URL ? '✓ Configured (caching enabled)' : '✗ Not set (caching disabled)'}

Features:
  ✓ Multi-database support
  ${process.env.REDIS_URL ? '✓' : '✗'} Automatic caching
  ✓ Cache auto-invalidation
  ✓ Production-ready structure

Tip: Set MONGO_URI and REDIS_URL environment variables for full functionality
  `);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server gracefully...');
  await cache.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, closing server gracefully...');
  await cache.close();
  process.exit(0);
});

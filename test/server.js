const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const REDIS_URL = process.env.REDIS_URL || undefined;

let cache;
let User;
let isInitialized = false;
let initError = null;

async function initializeCache() {
  try {
    const { createTransparentCache } = require('../dist/index');
    
    cache = createTransparentCache({
      mongoURI: MONGO_URI,
      staticAssetDB: 'cache-metadata',
      multiDB: true,
      redisURL: REDIS_URL,
      defaultTTL: 300,
      debug: true
    });

    await cache.initialize();

    const userSchema = new mongoose.Schema({
      name: String,
      email: String,
      active: Boolean,
      plan: String
    });

    User = cache.wrap(mongoose.model('User', userSchema));
    isInitialized = true;
    console.log('✅ Cache initialized successfully');
    return true;
  } catch (error) {
    initError = error.message;
    console.error('❌ Failed to initialize cache:', error.message);
    console.log('⚠️  MongoDB is not available. Server will run in documentation mode.');
    isInitialized = false;
    return false;
  }
}

app.post('/add-user', async (req, res) => {
  if (!isInitialized) {
    return res.status(503).json({ 
      success: false, 
      error: 'Cache not initialized. MongoDB is not available.',
      hint: 'Set MONGO_URI environment variable to a valid MongoDB connection string'
    });
  }

  try {
    const { dbName, data } = req.body;
    
    if (!dbName || !data) {
      return res.status(400).json({ 
        success: false, 
        error: 'dbName and data are required',
        example: { dbName: 'mydb', data: { name: 'John', email: 'john@example.com', active: true, plan: 'premium' } }
      });
    }

    const user = await User.db(dbName).create(data);
    res.json({ 
      success: true, 
      user,
      message: 'User created successfully in database: ' + dbName
    });
  } catch (err) {
    console.error('Error adding user:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/users/:dbName', async (req, res) => {
  if (!isInitialized) {
    return res.status(503).json({ 
      error: 'Cache not initialized. MongoDB is not available.' 
    });
  }

  try {
    const { dbName } = req.params;
    const users = await User.db(dbName).find({ active: true });
    res.json({ 
      success: true, 
      dbName,
      count: users.length, 
      users,
      cached: true
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/user/:dbName/:id', async (req, res) => {
  if (!isInitialized) {
    return res.status(503).json({ 
      error: 'Cache not initialized. MongoDB is not available.' 
    });
  }

  try {
    const { dbName, id } = req.params;
    const user = await User.db(dbName).findById(id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ 
      success: true, 
      dbName,
      user,
      cached: true
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/user/:dbName/:id', async (req, res) => {
  if (!isInitialized) {
    return res.status(503).json({ 
      error: 'Cache not initialized. MongoDB is not available.' 
    });
  }

  try {
    const { dbName, id } = req.params;
    const updateData = req.body;
    
    const user = await User.db(dbName).findByIdAndUpdate(id, updateData, { new: true });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ 
      success: true, 
      dbName,
      user, 
      message: 'User updated - cache automatically invalidated for this model'
    });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/user/:dbName/:id', async (req, res) => {
  if (!isInitialized) {
    return res.status(503).json({ 
      error: 'Cache not initialized. MongoDB is not available.' 
    });
  }

  try {
    const { dbName, id } = req.params;
    const user = await User.db(dbName).findByIdAndDelete(id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ 
      success: true, 
      dbName,
      message: 'User deleted - cache automatically invalidated for this model' 
    });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/stats', async (req, res) => {
  if (!isInitialized) {
    return res.status(503).json({ 
      error: 'Cache not initialized. MongoDB is not available.' 
    });
  }

  try {
    const stats = cache.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('📦 Attempting to initialize cache...');
  
  initializeCache().then((success) => {
    if (!success) {
      console.log('⚠️  Server is running in documentation mode');
      console.log('💡 To test full functionality, set MONGO_URI to a valid MongoDB connection');
      console.log('💡 Example: MONGO_URI=mongodb://user:pass@host:27017/dbname');
      console.log('💡 API endpoints will return 503 until MongoDB is connected');
    } else {
      console.log('✅ All systems operational');
      console.log('📚 Visit http://localhost:5000 to see available endpoints');
    }
  }).catch((err) => {
    console.error('Unexpected error during initialization:', err);
  });
});

// server.js
import express from 'express';
import mongoose from 'mongoose';
import { createTransparentCache } from '../dist/index.js';

// --- Define User schema ---
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  active: Boolean,
  plan: String
});


const app = express();
app.use(express.json());

// Transparent cache config (multiDB enabled)
const cache = createTransparentCache({
  mongoURI: 'mongodb://localhost:27017',  // Base Mongo
  staticAssetDB: 'cache-metadata',        // Metadata DB
  connectionPooling: true,            // Enable connection pooling
  multiDB: true,                          // Enable multiple DBs
  defaultTTL: 300,
  logger: {
    log: (...args) => console.log('[CACHE]', ...args),
    error: (...args) => console.error('[CACHE]', ...args)
  },
  debug: true
});

cache.initialize();



const User = cache.wrap(mongoose.model('User', userSchema));

// --- Routes ---

// Add user to DB
app.post('/add-users', async (req, res) => {
  try {
    const user = await User.db('app-data').create(req.body.data);
    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// --- Start server ---
app.listen(3000, () => {
  console.log('✅ Server running at http://localhost:3000');
});

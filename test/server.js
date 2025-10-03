// server.js
import express from 'express';
import mongoose from 'mongoose';
import { createTransparentCache } from '../dist/index.js';

const app = express();
app.use(express.json());

// Transparent cache config (multiDB enabled)
const cache = createTransparentCache({
  mongoURI: 'mongodb://localhost:27017',  // Base Mongo
  staticAssetDB: 'cache-metadata',        // Metadata DB
  multiDB: true,                          // Enable multiple DBs
  defaultTTL: 300,
  logger: {
    log: (...args) => console.log('[CACHE]', ...args),
    error: (...args) => console.error('[CACHE]', ...args)
  }
});

await cache.initialize();

// --- Define User schema ---
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  active: Boolean,
  plan: String
});


const User = cache.wrap(mongoose.model('User', userSchema));

// --- Routes ---

// Add user to DB
app.post('/add-users', async (req, res) => {
  try {
    const user = new User(req.body.data);
    await user.db(req.body.dbName).save();
    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all users
app.get('/users', async (req, res) => {
  try {
    const users = await User.db(req.body.dbName).find({ active: true });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Start server ---
app.listen(3000, () => {
  console.log('✅ Server running at http://localhost:3000');
});

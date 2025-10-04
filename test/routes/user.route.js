const express = require('express');
const router = express.Router();
const { User } = require('../models');

router.post('/', async (req, res) => {
  try {
    const { dbName, ...userData } = req.body;
    
    if (!dbName) {
      return res.status(400).json({ 
        success: false, 
        error: 'dbName is required in request body' 
      });
    }

    const user = await User.db(dbName).create(userData);
    
    res.status(201).json({ 
      success: true, 
      message: 'User created successfully',
      dbName,
      data: user 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.get('/:dbName', async (req, res) => {
  try {
    const { dbName } = req.params;
    const { active, plan, role, limit = 50, skip = 0 } = req.query;
    
    const filter = {};
    if (active !== undefined) filter.active = active === 'true';
    if (plan) filter.plan = plan;
    if (role) filter.role = role;

    const users = (await User.db(dbName)
      .find(filter))
      // .limit(parseInt(limit))
      // .skip(parseInt(skip))
      // .sort({ createdAt: -1 });
    
    res.json({ 
      success: true,
      dbName,
      count: users.length,
      data: users,
      cached: true
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.get('/:dbName/:id', async (req, res) => {
  try {
    const { dbName, id } = req.params;
    
    const user = await User.db(dbName).findById(id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    res.json({ 
      success: true,
      dbName,
      data: user,
      cached: true
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.put('/:dbName/:id', async (req, res) => {
  try {
    const { dbName, id } = req.params;
    const updateData = req.body;
    
    delete updateData.dbName;
    
    const user = await User.db(dbName).findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    res.json({ 
      success: true,
      dbName,
      message: 'User updated successfully - cache automatically invalidated',
      data: user
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.delete('/:dbName/:id', async (req, res) => {
  try {
    const { dbName, id } = req.params;
    
    const user = await User.db(dbName).findByIdAndDelete(id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    res.json({ 
      success: true,
      dbName,
      message: 'User deleted successfully - cache automatically invalidated'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.get('/:dbName/search/email', async (req, res) => {
  try {
    const { dbName } = req.params;
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'email query parameter is required' 
      });
    }

    const user = await User.db(dbName).findOne({ email });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    res.json({ 
      success: true,
      dbName,
      data: user,
      cached: true
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { Post } = require('../models');

router.post('/', async (req, res) => {
  try {
    const { dbName, ...postData } = req.body;
    
    if (!dbName) {
      return res.status(400).json({ 
        success: false, 
        error: 'dbName is required in request body' 
      });
    }

    const post = await Post.db(dbName).create(postData);
    
    res.status(201).json({ 
      success: true, 
      message: 'Post created successfully',
      dbName,
      data: post 
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
    const { published, category, author, limit = 50, skip = 0 } = req.query;
    
    const filter = {};
    if (published !== undefined) filter.published = published === 'true';
    if (category) filter.category = category;
    if (author) filter.author = author;

    const posts = await Post.db(dbName)
      .find(filter)
      .populate('author', 'name email')
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort({ publishedAt: -1, createdAt: -1 });
    
    res.json({ 
      success: true,
      dbName,
      count: posts.length,
      data: posts,
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
    
    const post = await Post.db(dbName)
      .findById(id)
      .populate('author', 'name email role');
    
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        error: 'Post not found' 
      });
    }
    
    res.json({ 
      success: true,
      dbName,
      data: post,
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
    
    const post = await Post.db(dbName).findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    ).populate('author', 'name email');
    
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        error: 'Post not found' 
      });
    }
    
    res.json({ 
      success: true,
      dbName,
      message: 'Post updated successfully - cache automatically invalidated',
      data: post
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
    
    const post = await Post.db(dbName).findByIdAndDelete(id);
    
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        error: 'Post not found' 
      });
    }
    
    res.json({ 
      success: true,
      dbName,
      message: 'Post deleted successfully - cache automatically invalidated'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.patch('/:dbName/:id/views', async (req, res) => {
  try {
    const { dbName, id } = req.params;
    
    const post = await Post.db(dbName).findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    );
    
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        error: 'Post not found' 
      });
    }
    
    res.json({ 
      success: true,
      dbName,
      message: 'View count incremented',
      views: post.views
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.patch('/:dbName/:id/likes', async (req, res) => {
  try {
    const { dbName, id } = req.params;
    
    const post = await Post.db(dbName).findByIdAndUpdate(
      id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        error: 'Post not found' 
      });
    }
    
    res.json({ 
      success: true,
      dbName,
      message: 'Like count incremented',
      likes: post.likes
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.get('/:dbName/category/:category', async (req, res) => {
  try {
    const { dbName, category } = req.params;
    const { limit = 20, skip = 0 } = req.query;
    
    const posts = await Post.db(dbName)
      .find({ category, published: true })
      .populate('author', 'name email')
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort({ publishedAt: -1 });
    
    res.json({ 
      success: true,
      dbName,
      category,
      count: posts.length,
      data: posts,
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

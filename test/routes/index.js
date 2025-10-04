const express = require('express');
const router = express.Router();
const userRoutes = require('./user.route');
const postRoutes = require('./post.route');

router.use('/users', userRoutes);
router.use('/posts', postRoutes);

module.exports = router;

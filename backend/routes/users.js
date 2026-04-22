const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Search users by username
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const users = await User.find({
      username: { $regex: q, $options: 'i' },
      _id: { $ne: req.user._id }
    }).limit(10);

    res.json(users.map(u => u.toPublic()));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user by username
router.get('/:username', auth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.toPublic());
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, displayName, password } = req.body;
    if (!username || !displayName || !password)
      return res.status(400).json({ error: 'All fields are required' });

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Username already taken' });

    const user = new User({ username, displayName, password });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({ token, user: user.toPublic() });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors)[0].message;
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username?.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(user._id);
    res.json({ token, user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json(req.user.toPublic());
});

// Update profile
router.patch('/me', auth, async (req, res) => {
  try {
    const { displayName, status } = req.body;
    if (displayName) req.user.displayName = displayName;
    if (status !== undefined) req.user.status = status;
    await req.user.save();
    res.json(req.user.toPublic());
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

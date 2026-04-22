const express = require('express');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Get all chats for current user
router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.user._id })
      .populate('participants', 'username displayName avatar isOnline lastSeen')
      .populate('admins', '_id')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'username displayName' }
      })
      .sort({ updatedAt: -1 });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create or get private chat
router.post('/private', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const other = await User.findById(userId);
    if (!other) return res.status(404).json({ error: 'User not found' });

    let chat = await Chat.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, userId], $size: 2 }
    }).populate('participants', 'username displayName avatar isOnline lastSeen')
      .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'username displayName' } });

    if (!chat) {
      chat = new Chat({ isGroup: false, participants: [req.user._id, userId] });
      await chat.save();
      chat = await Chat.findById(chat._id)
        .populate('participants', 'username displayName avatar isOnline lastSeen');
    }
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create group chat
router.post('/group', auth, async (req, res) => {
  try {
    const { name, participantIds } = req.body;
    if (!name || !participantIds || participantIds.length < 1)
      return res.status(400).json({ error: 'Name and at least one participant required' });

    const allParticipants = [...new Set([req.user._id.toString(), ...participantIds])];
    const chat = new Chat({
      isGroup: true, name,
      participants: allParticipants,
      admins: [req.user._id],
      createdBy: req.user._id
    });
    await chat.save();

    const populated = await Chat.findById(chat._id)
      .populate('participants', 'username displayName avatar isOnline lastSeen')
      .populate('admins', '_id username displayName');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add user to group
router.post('/:chatId/members', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat || !chat.isGroup) return res.status(404).json({ error: 'Group not found' });

    const isAdmin = chat.admins.map(a => a.toString()).includes(req.user._id.toString());
    if (!isAdmin) return res.status(403).json({ error: 'Only admins can add members' });

    const { userId } = req.body;
    const already = chat.participants.map(p => p.toString()).includes(userId);
    if (!already) {
      chat.participants.push(userId);
      await chat.save();
    }

    const updated = await Chat.findById(chat._id)
      .populate('participants', 'username displayName avatar isOnline lastSeen')
      .populate('admins', '_id username displayName');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove user from group
router.delete('/:chatId/members/:userId', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat || !chat.isGroup) return res.status(404).json({ error: 'Group not found' });

    const isAdmin = chat.admins.map(a => a.toString()).includes(req.user._id.toString());
    const isSelf = req.params.userId === req.user._id.toString();
    if (!isAdmin && !isSelf) return res.status(403).json({ error: 'Not authorized' });

    chat.participants = chat.participants.filter(p => p.toString() !== req.params.userId);
    await chat.save();

    const updated = await Chat.findById(chat._id)
      .populate('participants', 'username displayName avatar isOnline lastSeen')
      .populate('admins', '_id username displayName');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a chat
router.get('/:chatId/messages', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (!chat.participants.map(p => p.toString()).includes(req.user._id.toString()))
      return res.status(403).json({ error: 'Not a participant' });

    const { before, limit = 50 } = req.query;
    const query = { chat: req.params.chatId };
    if (before) query.createdAt = { $lt: new Date(before) };

    const messages = await Message.find(query)
      .populate('sender', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload media (image / video / circle)
router.post('/:chatId/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (!chat.participants.map(p => p.toString()).includes(req.user._id.toString()))
      return res.status(403).json({ error: 'Not a participant' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const f = req.file;
    const isVideo = f.mimetype.startsWith('video/');
    const isCircle = req.body.circle === 'true';

    const mediaType = isCircle ? 'circle' : isVideo ? 'video' : 'image';

    const media = {
      url: f.path,           // cloudinary secure URL
      type: mediaType,
      publicId: f.filename,
      width: f.width,
      height: f.height,
      duration: f.duration || undefined,
    };

    const message = new Message({
      sender: req.user._id,
      content: req.body.caption || '',
      chat: req.params.chatId,
      media,
      readBy: [req.user._id],
      delivered: true
    });
    await message.save();
    await message.populate('sender', 'username displayName avatar');

    chat.lastMessage = message._id;
    chat.updatedAt = new Date();
    await chat.save();

    res.json(message);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

module.exports = router;

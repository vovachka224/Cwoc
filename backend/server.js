require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const Message = require('./models/Message');
const Chat = require('./models/Chat');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');

const app = express();
const server = http.createServer(app);

// Allow multiple origins from CLIENT_URL (comma-separated) + localhost fallback
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',').map(s => s.trim());

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

const io = new Server(server, {
  cors: { ...corsOptions, methods: ['GET', 'POST'] },
  // Better for Render (no sticky sessions needed for single instance)
  transports: ['websocket', 'polling'],
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Health check for Render
app.get('/health', (_, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);

// userId -> Set of socketIds (multi-tab support)
const onlineUsers = new Map();

const addOnline = (userId, socketId) => {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
};
const removeOnline = (userId, socketId) => {
  const set = onlineUsers.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) onlineUsers.delete(userId);
};
const isOnline = (userId) => onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;

// Socket auth middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return next(new Error('User not found'));
    socket.user = user;
    next();
  } catch {
    next(new Error('Auth failed'));
  }
});

io.on('connection', async (socket) => {
  const userId = socket.user._id.toString();
  console.log(`✅ ${socket.user.username} connected [${socket.id}]`);

  addOnline(userId, socket.id);
  await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
  io.emit('user:status', { userId, isOnline: true });

  // Join all user's chat rooms
  const chats = await Chat.find({ participants: userId });
  chats.forEach(c => socket.join(c._id.toString()));

  // Send current online user IDs
  socket.emit('users:online', Array.from(onlineUsers.keys()));

  // ── Send message ──────────────────────────────────────────────────
  socket.on('message:send', async (data, callback) => {
    try {
      const { chatId, content } = data;
      if (!content?.trim()) return callback?.({ error: 'Empty message' });

      const chat = await Chat.findById(chatId);
      if (!chat) return callback?.({ error: 'Chat not found' });
      if (!chat.participants.map(p => p.toString()).includes(userId))
        return callback?.({ error: 'Not a participant' });

      const message = new Message({
        sender: userId,
        content: content.trim(),
        chat: chatId,
        readBy: [userId],
        delivered: true
      });
      await message.save();
      await message.populate('sender', 'username displayName avatar');

      chat.lastMessage = message._id;
      chat.updatedAt = new Date();
      await chat.save();

      io.to(chatId).emit('message:new', message);

      // Notify participants not currently in the room socket
      chat.participants.forEach(pid => {
        const pidStr = pid.toString();
        if (pidStr !== userId && isOnline(pidStr)) {
          onlineUsers.get(pidStr).forEach(sid => {
            io.to(sid).emit('chat:updated', { chatId, lastMessage: message });
          });
        }
      });

      callback?.({ success: true, message });
    } catch (err) {
      console.error(err);
      callback?.({ error: 'Failed to send message' });
    }
  });

  // ── Media message sent via REST — broadcast it via socket ─────────
  socket.on('message:media', async ({ chatId, messageId }) => {
    try {
      const message = await Message.findById(messageId)
        .populate('sender', 'username displayName avatar');
      if (!message) return;

      io.to(chatId).emit('message:new', message);

      const chat = await Chat.findById(chatId);
      if (!chat) return;
      chat.participants.forEach(pid => {
        const pidStr = pid.toString();
        if (pidStr !== userId && isOnline(pidStr)) {
          onlineUsers.get(pidStr).forEach(sid => {
            io.to(sid).emit('chat:updated', { chatId, lastMessage: message });
          });
        }
      });
    } catch (err) {
      console.error('media broadcast err:', err);
    }
  });

  // ── Read receipts ─────────────────────────────────────────────────
  socket.on('message:read', async ({ chatId }) => {
    try {
      await Message.updateMany(
        { chat: chatId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );
      socket.to(chatId).emit('message:read', { chatId, userId });
    } catch {}
  });

  // ── Typing ────────────────────────────────────────────────────────
  socket.on('typing:start', ({ chatId }) => {
    socket.to(chatId).emit('typing:start', {
      chatId, userId,
      username: socket.user.username,
      displayName: socket.user.displayName
    });
  });

  socket.on('typing:stop', ({ chatId }) => {
    socket.to(chatId).emit('typing:stop', { chatId, userId });
  });

  // ── Join new room ─────────────────────────────────────────────────
  socket.on('chat:join', (chatId) => socket.join(chatId));

  // ── Disconnect ────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    console.log(`❌ ${socket.user.username} disconnected [${socket.id}]`);
    removeOnline(userId, socket.id);
    if (!isOnline(userId)) {
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
      io.emit('user:status', { userId, isOnline: false, lastSeen: new Date() });
    }
  });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

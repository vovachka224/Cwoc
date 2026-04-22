# ✈ Telegraph — Telegram-like MVP Chat App

A full-stack real-time chat application with private messaging, group chats, WebSockets, and a dark Telegram-inspired UI.

---

## 🗂 Project Structure

```
telegraph/
├── backend/              # Node.js + Express + Socket.io
│   ├── models/
│   │   ├── User.js
│   │   ├── Message.js
│   │   └── Chat.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   └── chats.js
│   ├── middleware/
│   │   └── auth.js
│   ├── server.js
│   ├── .env
│   └── package.json
└── frontend/             # React
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── contexts/
    │   │   ├── AuthContext.js
    │   │   └── SocketContext.js
    │   ├── components/
    │   │   ├── ChatList.js
    │   │   └── ChatWindow.js
    │   ├── pages/
    │   │   ├── AuthPage.js
    │   │   └── MainApp.js
    │   ├── utils/
    │   │   └── api.js
    │   ├── App.js
    │   ├── App.css
    │   └── index.js
    └── package.json
```

---

## ⚙️ Prerequisites

- **Node.js** v18+ — https://nodejs.org
- **MongoDB** running locally on port 27017

### Install MongoDB (if not installed)

**macOS (Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Ubuntu/Debian:**
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongodb
```

**Windows:** Download from https://www.mongodb.com/try/download/community

---

## 🚀 Installation & Running

### 1. Backend

```bash
cd telegraph/backend
npm install
```

Edit `.env` if needed (defaults work for local MongoDB):
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/telegraph
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
```

Start the backend:
```bash
npm run dev      # with auto-reload (nodemon)
# or
npm start        # without auto-reload
```

You should see:
```
✅ MongoDB connected
🚀 Server running on port 5000
```

### 2. Frontend

Open a **new terminal**:

```bash
cd telegraph/frontend
npm install
npm start
```

The app opens at **http://localhost:3000**

---

## 🧪 Testing the App

1. Open http://localhost:3000 in **two different browser windows** (or use Incognito for the second)
2. Register two users (e.g. `alice` and `bob`)
3. In Alice's window, search for `bob` in the sidebar search
4. Click on Bob to start a private chat
5. Send messages — they appear in real-time in Bob's window
6. Notice the typing indicator as you type
7. Try creating a group: click 👥, search for users, add them, give the group a name

---

## ✨ Features

| Feature | Status |
|---|---|
| User registration & login | ✅ |
| Unique @username | ✅ |
| JWT authentication | ✅ |
| Profile (display name + status) | ✅ |
| Private messaging | ✅ |
| Real-time via WebSockets (Socket.io) | ✅ |
| Message history (MongoDB) | ✅ |
| Timestamps on messages | ✅ |
| Delivered / read receipts (✓ / ✓✓) | ✅ |
| Group chats | ✅ |
| Add/remove group members | ✅ |
| Online/offline status | ✅ |
| Typing indicator | ✅ |
| Search users by @username | ✅ |
| Telegram-dark UI | ✅ |

---

## 🛠 Tech Stack

- **Frontend:** React 18, Socket.io-client, Axios, date-fns
- **Backend:** Node.js, Express, Socket.io
- **Database:** MongoDB with Mongoose
- **Auth:** JWT + bcrypt
- **Real-time:** Socket.io (WebSockets)

---

## 🔌 API Endpoints

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| PATCH | `/api/auth/me` | Update profile |

### Users
| Method | Route | Description |
|---|---|---|
| GET | `/api/users/search?q=query` | Search users |
| GET | `/api/users/:username` | Get user by username |

### Chats
| Method | Route | Description |
|---|---|---|
| GET | `/api/chats` | Get all user chats |
| POST | `/api/chats/private` | Start/get private chat |
| POST | `/api/chats/group` | Create group |
| POST | `/api/chats/:id/members` | Add member to group |
| DELETE | `/api/chats/:id/members/:uid` | Remove group member |
| GET | `/api/chats/:id/messages` | Get message history |

### Socket.io Events
| Event | Direction | Description |
|---|---|---|
| `message:send` | Client → Server | Send a message |
| `message:new` | Server → Client | New message received |
| `message:read` | Both | Mark messages as read |
| `typing:start` | Client → Server | Started typing |
| `typing:stop` | Client → Server | Stopped typing |
| `user:status` | Server → Client | Online/offline update |
| `users:online` | Server → Client | Initial online users list |

---

## 🐛 Troubleshooting

**"MongoDB connection failed"**
→ Make sure MongoDB is running: `mongod` or `brew services start mongodb-community`

**"Cannot connect to localhost:5000"**
→ Make sure the backend is running before starting the frontend

**CORS errors**
→ The backend allows `localhost:3000` by default — don't change the frontend port

**Port already in use**
→ Change `PORT` in `.env` and update `http://localhost:5000` references in frontend `utils/api.js` and `contexts/SocketContext.js`

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import api from '../utils/api';
import { formatDistanceToNow } from 'date-fns';

function Avatar({ user, size = 40 }) {
  const initials = user?.displayName?.charAt(0).toUpperCase() || '?';
  const colors = ['#2196F3','#E91E63','#9C27B0','#FF9800','#4CAF50','#00BCD4','#FF5722','#607D8B'];
  const color = colors[(user?.username?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className="avatar" style={{ width: size, height: size, background: color }}>
      {initials}
    </div>
  );
}

export { Avatar };

export default function ChatList({ selectedChatId, onSelectChat, chats, setChats }) {
  const { user, logout } = useAuth();
  const { onlineUsers, on, off } = useSocket();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [profileEdit, setProfileEdit] = useState({ displayName: user?.displayName, status: user?.status });
  const { updateProfile } = useAuth();

  useEffect(() => {
    const handleNewMessage = (msg) => {
      setChats(prev => {
        const updated = prev.map(c =>
          c._id === msg.chat ? { ...c, lastMessage: msg, updatedAt: new Date() } : c
        );
        return updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });
    };

    const handleChatUpdated = ({ chatId, lastMessage }) => {
      setChats(prev => {
        const exists = prev.find(c => c._id === chatId);
        if (!exists) {
          api.get('/api/chats').then(res => setChats(res.data));
          return prev;
        }
        const updated = prev.map(c =>
          c._id === chatId ? { ...c, lastMessage, updatedAt: new Date() } : c
        );
        return updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });
    };

    on('message:new', handleNewMessage);
    on('chat:updated', handleChatUpdated);
    return () => {
      off('message:new', handleNewMessage);
      off('chat:updated', handleChatUpdated);
    };
  }, [on, off, setChats]);

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/api/users/search?q=${encodeURIComponent(search)}`);
        setSearchResults(res.data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const startChat = async (userId) => {
    try {
      const res = await api.post('/api/chats/private', { userId });
      const exists = chats.find(c => c._id === res.data._id);
      if (!exists) setChats(prev => [res.data, ...prev]);
      onSelectChat(res.data);
      setSearch('');
      setSearchResults([]);
    } catch {}
  };

  const createGroup = async () => {
    if (!groupName.trim() || groupMembers.length === 0) return;
    try {
      const res = await api.post('/api/chats/group', {
        name: groupName,
        participantIds: groupMembers.map(m => m._id)
      });
      setChats(prev => [res.data, ...prev]);
      onSelectChat(res.data);
      setShowNewGroup(false);
      setGroupName('');
      setGroupMembers([]);
      setSearch('');
      setSearchResults([]);
    } catch {}
  };

  const getChatName = (chat) => {
    if (chat.isGroup) return chat.name;
    const other = chat.participants?.find(p => p._id !== user._id);
    return other?.displayName || 'Unknown';
  };

  const getChatUser = (chat) => {
    if (chat.isGroup) return null;
    return chat.participants?.find(p => p._id !== user._id);
  };

  const isOnline = (chat) => {
    if (chat.isGroup) return false;
    const other = getChatUser(chat);
    return other && onlineUsers.includes(other._id);
  };

  const saveProfile = async () => {
    await updateProfile(profileEdit);
    setShowProfile(false);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <button className="menu-btn" onClick={() => setShowProfile(true)}>
          <Avatar user={user} size={36} />
        </button>
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="icon-btn" onClick={() => setShowNewGroup(!showNewGroup)} title="New Group">
          👥
        </button>
      </div>

      {/* New Group Panel */}
      {showNewGroup && (
        <div className="new-group-panel">
          <div className="panel-title">New Group</div>
          <input
            placeholder="Group name..."
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            className="group-name-input"
          />
          {groupMembers.length > 0 && (
            <div className="group-members">
              {groupMembers.map(m => (
                <span key={m._id} className="member-chip">
                  {m.displayName}
                  <button onClick={() => setGroupMembers(prev => prev.filter(x => x._id !== m._id))}>×</button>
                </span>
              ))}
            </div>
          )}
          <button className="btn-create-group" onClick={createGroup}>Create Group</button>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="search-results">
          {searchResults.map(u => (
            <div key={u._id} className="search-result-item">
              <div onClick={() => startChat(u._id)} className="search-result-main">
                <Avatar user={u} size={36} />
                <div>
                  <div className="result-name">{u.displayName}</div>
                  <div className="result-username">@{u.username}</div>
                </div>
              </div>
              {showNewGroup && (
                <button
                  className="add-to-group-btn"
                  onClick={() => {
                    if (!groupMembers.find(m => m._id === u._id))
                      setGroupMembers(prev => [...prev, u]);
                  }}
                >+</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Chat List */}
      <div className="chat-list">
        {chats.map(chat => {
          const chatUser = getChatUser(chat);
          const online = isOnline(chat);
          const lastMsg = chat.lastMessage;
          const isSelected = selectedChatId === chat._id;

          return (
            <div
              key={chat._id}
              className={`chat-item ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectChat(chat)}
            >
              <div className="chat-avatar-wrap">
                {chat.isGroup
                  ? <div className="avatar group-avatar">{chat.name?.charAt(0)}</div>
                  : <Avatar user={chatUser} size={46} />
                }
                {online && <div className="online-dot" />}
              </div>
              <div className="chat-info">
                <div className="chat-top">
                  <span className="chat-name">{getChatName(chat)}</span>
                  {lastMsg && (
                    <span className="chat-time">
                      {formatDistanceToNow(new Date(lastMsg.createdAt), { addSuffix: false })}
                    </span>
                  )}
                </div>
                <div className="chat-preview">
                  {lastMsg
                    ? `${lastMsg.sender?.displayName?.split(' ')[0] || ''}: ${lastMsg.content}`
                    : <span className="no-messages">No messages yet</span>
                  }
                </div>
              </div>
            </div>
          );
        })}
        {chats.length === 0 && !search && (
          <div className="empty-state">
            <div>🔍</div>
            <p>Search for users to start chatting</p>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {showProfile && (
        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Profile</h3>
            <div className="profile-avatar-large">
              <Avatar user={user} size={72} />
            </div>
            <div className="field">
              <label>Display Name</label>
              <input
                value={profileEdit.displayName}
                onChange={e => setProfileEdit({ ...profileEdit, displayName: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Status</label>
              <input
                value={profileEdit.status}
                onChange={e => setProfileEdit({ ...profileEdit, status: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Username</label>
              <input value={`@${user.username}`} disabled />
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={saveProfile}>Save</button>
              <button className="btn-secondary" onClick={logout}>Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import api from '../utils/api';
import { format } from 'date-fns';
import { Avatar } from './ChatList';

// ─── Media Message Renderer ────────────────────────────────────────────────
function MediaMessage({ media, content }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);

  if (!media?.url) return content ? <span className="msg-text">{content}</span> : null;

  if (media.type === 'image') {
    return (
      <div className="msg-media">
        <img
          src={media.url}
          alt="shared"
          className="msg-image"
          onClick={() => window.open(media.url, '_blank')}
        />
        {content && <p className="msg-caption">{content}</p>}
      </div>
    );
  }

  if (media.type === 'circle') {
    return (
      <div className="msg-media">
        <div className="msg-circle-wrap">
          <video
            ref={videoRef}
            src={media.url}
            className="msg-circle-video"
            playsInline
            loop
            onClick={() => {
              if (videoRef.current.paused) { videoRef.current.play(); setPlaying(true); }
              else { videoRef.current.pause(); setPlaying(false); }
            }}
          />
          {!playing && (
            <div className="circle-play-overlay">▶</div>
          )}
        </div>
        {content && <p className="msg-caption">{content}</p>}
      </div>
    );
  }

  if (media.type === 'video') {
    return (
      <div className="msg-media">
        <video
          src={media.url}
          className="msg-video"
          controls
          playsInline
          preload="metadata"
        />
        {content && <p className="msg-caption">{content}</p>}
      </div>
    );
  }

  return null;
}

// ─── Upload Preview ────────────────────────────────────────────────────────
function UploadPreview({ file, onRemove }) {
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith('video/');
  return (
    <div className="upload-preview">
      {isVideo
        ? <video src={url} className="preview-thumb" />
        : <img src={url} alt="preview" className="preview-thumb" />
      }
      <button className="preview-remove" onClick={onRemove}>×</button>
      <span className="preview-name">{file.name}</span>
    </div>
  );
}

// ─── Main ChatWindow ───────────────────────────────────────────────────────
export default function ChatWindow({ chat, onChatUpdate }) {
  const { user } = useAuth();
  const { emit, on, off, onlineUsers } = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [pendingFile, setPendingFile] = useState(null);
  const [isCircle, setIsCircle] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const fileInputRef = useRef(null);
  const circleInputRef = useRef(null);
  const textareaRef = useRef(null);

  const otherUser = !chat.isGroup
    ? chat.participants?.find(p => p._id !== user._id)
    : null;
  const isOtherOnline = otherUser && onlineUsers.includes(otherUser._id);

  // ── Load messages on chat change ──────────────────────────────────
  useEffect(() => {
    setMessages([]);
    setLoading(true);
    setTypingUsers([]);
    setPendingFile(null);
    loadMessages();
    emit('chat:join', chat._id);
    emit('message:read', { chatId: chat._id });
}, [chat._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { scrollToBottom(); }, [messages, typingUsers]);

  // ── Socket listeners ───────────────────────────────────────────────
  useEffect(() => {
    const handleNewMsg = (msg) => {
      if (msg.chat === chat._id) {
        setMessages(prev => prev.find(m => m._id === msg._id) ? prev : [...prev, msg]);
        emit('message:read', { chatId: chat._id });
      }
    };
    const handleTypingStart = ({ chatId, userId, displayName }) => {
      if (chatId === chat._id && userId !== user._id)
        setTypingUsers(prev => prev.find(t => t.userId === userId) ? prev : [...prev, { userId, displayName }]);
    };
    const handleTypingStop = ({ chatId, userId }) => {
      if (chatId === chat._id)
        setTypingUsers(prev => prev.filter(t => t.userId !== userId));
    };
    const handleReadReceipt = ({ chatId }) => {
      if (chatId === chat._id)
        setMessages(prev => prev.map(m => ({ ...m, _read: true })));
    };

    on('message:new', handleNewMsg);
    on('typing:start', handleTypingStart);
    on('typing:stop', handleTypingStop);
    on('message:read', handleReadReceipt);
    return () => {
      off('message:new', handleNewMsg);
      off('typing:start', handleTypingStart);
      off('typing:stop', handleTypingStop);
      off('message:read', handleReadReceipt);
    };
  }, [chat._id, on, off, emit, user._id]);

  const loadMessages = async () => {
    try {
      const res = await api.get(`/api/chats/${chat._id}/messages`);
      setMessages(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── Typing ────────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    setInput(e.target.value);
    // Auto-resize textarea
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emit('typing:start', { chatId: chat._id });
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      emit('typing:stop', { chatId: chat._id });
    }, 1500);
  };

  // ── Send text message ─────────────────────────────────────────────
  const sendMessage = () => {
    if (!input.trim() && !pendingFile) return;
    if (pendingFile) { sendMedia(); return; }

    clearTimeout(typingTimerRef.current);
    isTypingRef.current = false;
    emit('typing:stop', { chatId: chat._id });
    emit('message:send', { chatId: chat._id, content: input.trim() }, (res) => {
      if (res?.error) console.error(res.error);
    });
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // ── Send media ────────────────────────────────────────────────────
  const sendMedia = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', pendingFile);
      if (input.trim()) formData.append('caption', input.trim());
      if (isCircle) formData.append('circle', 'true');

      const res = await api.post(`/api/chats/${chat._id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      // Tell other clients via socket
      emit('message:media', { chatId: chat._id, messageId: res.data._id });
      // Also add to own messages
      setMessages(prev => prev.find(m => m._id === res.data._id) ? prev : [...prev, res.data]);

      setPendingFile(null);
      setIsCircle(false);
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ── Mobile: use touchend on send button to avoid virtual keyboard hiding ──
  const handleSendInteraction = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileChange = (e, circle = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setIsCircle(circle);
    e.target.value = '';
  };

  // ── Group management ───────────────────────────────────────────────
  const addMember = async (userId) => {
    try {
      const res = await api.post(`/api/chats/${chat._id}/members`, { userId });
      onChatUpdate(res.data);
      setUserSearchResults([]);
      setSearchUser('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add member');
    }
  };

  const removeMember = async (userId) => {
    try {
      const res = await api.delete(`/api/chats/${chat._id}/members/${userId}`);
      onChatUpdate(res.data);
    } catch {}
  };

  useEffect(() => {
    if (!searchUser.trim()) { setUserSearchResults([]); return; }
    const t = setTimeout(async () => {
      const res = await api.get(`/api/users/search?q=${encodeURIComponent(searchUser)}`);
      setUserSearchResults(res.data.filter(u => !chat.participants?.find(p => p._id === u._id)));
    }, 300);
    return () => clearTimeout(t);
  }, [searchUser, chat.participants]);

  // ── Message grouping ───────────────────────────────────────────────
  const groupMessages = (msgs) => {
    const groups = [];
    msgs.forEach((msg, i) => {
      const prev = msgs[i - 1];
      const sameSender = prev && prev.sender?._id === msg.sender?._id;
      const timeDiff = prev && (new Date(msg.createdAt) - new Date(prev.createdAt)) < 60000;
      if (sameSender && timeDiff) groups[groups.length - 1].push(msg);
      else groups.push([msg]);
    });
    return groups;
  };

  const messageGroups = groupMessages(messages);

  const getChatTitle = () => chat.isGroup ? chat.name : (otherUser?.displayName || 'Unknown');
  const getChatSubtitle = () => {
    if (chat.isGroup) return `${chat.participants?.length} members`;
    if (isOtherOnline) return 'online';
    if (otherUser?.lastSeen) return `last seen ${format(new Date(otherUser.lastSeen), 'MMM d, HH:mm')}`;
    return 'offline';
  };

  // Admin check — handle both populated objects and raw IDs
  const isAdmin = chat.admins?.some(a =>
    (typeof a === 'object' ? a._id : a)?.toString() === user._id
  );

  const canSend = (input.trim() || pendingFile) && !uploading;

  return (
    <div className="chat-window">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="chat-header">
        <div className="chat-header-info" onClick={() => chat.isGroup && setShowGroupInfo(true)}>
          {chat.isGroup
            ? <div className="avatar group-avatar sm">{chat.name?.charAt(0)}</div>
            : <div className="avatar-wrap-sm">
                <Avatar user={otherUser} size={38} />
                {isOtherOnline && <div className="online-dot-sm" />}
              </div>
          }
          <div>
            <div className="chat-header-name">{getChatTitle()}</div>
            <div className={`chat-header-sub ${isOtherOnline || chat.isGroup ? 'green' : ''}`}>
              {getChatSubtitle()}
            </div>
          </div>
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────────────── */}
      <div className="messages-area">
        {loading && <div className="loading-msgs">Loading…</div>}

        {messageGroups.map((group, gi) => {
          const isMe = group[0].sender?._id === user._id;
          return (
            <div key={gi} className={`msg-group ${isMe ? 'mine' : 'theirs'}`}>
              {!isMe && chat.isGroup && (
                <div className="msg-sender-name">{group[0].sender?.displayName}</div>
              )}
              {!isMe && !chat.isGroup && <Avatar user={group[0].sender} size={28} />}
              <div className="msg-bubbles">
                {group.map((msg) => (
                  <div key={msg._id} className={`msg-bubble ${isMe ? 'mine' : 'theirs'} ${msg.media ? 'media-bubble' : ''}`}>
                    {msg.media
                      ? <MediaMessage media={msg.media} content={msg.content} />
                      : <span className="msg-text">{msg.content}</span>
                    }
                    <span className="msg-meta">
                      {format(new Date(msg.createdAt), 'HH:mm')}
                      {isMe && (
                        <span className="msg-status">
                          {msg.readBy?.length > 1 ? ' ✓✓' : ' ✓'}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            <div className="typing-dots"><span /><span /><span /></div>
            <span className="typing-text">
              {typingUsers.map(t => t.displayName).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── File preview ────────────────────────────────────────────── */}
      {pendingFile && (
        <UploadPreview file={pendingFile} onRemove={() => { setPendingFile(null); setIsCircle(false); }} />
      )}

      {/* ── Upload progress ──────────────────────────────────────────── */}
      {uploading && (
        <div className="upload-progress-bar">
          <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
          <span>{uploadProgress}%</span>
        </div>
      )}

      {/* ── Input area ──────────────────────────────────────────────── */}
      <div className="chat-input-area">
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFileChange(e, false)}
        />
        <input
          ref={circleInputRef}
          type="file"
          accept="video/*"
          capture="user"
          style={{ display: 'none' }}
          onChange={(e) => handleFileChange(e, true)}
        />

        {/* Attach button */}
        <div className="attach-menu-wrap">
          <button
            className="attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Send photo or video"
            type="button"
          >
            📎
          </button>
          <button
            className="attach-btn circle-btn"
            onClick={() => circleInputRef.current?.click()}
            title="Record circle video"
            type="button"
          >
            ⊙
          </button>
        </div>

        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder={pendingFile ? 'Add a caption…' : 'Message…'}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          // Mobile: prevent iOS safari zoom
          style={{ fontSize: '16px' }}
        />

        <button
          className={`send-btn ${canSend ? 'active' : ''}`}
          onMouseDown={handleSendInteraction}
          onTouchEnd={handleSendInteraction}
          disabled={!canSend}
          type="button"
        >
          {uploading ? '…' : '➤'}
        </button>
      </div>

      {/* ── Group Info Modal ─────────────────────────────────────────── */}
      {showGroupInfo && chat.isGroup && (
        <div className="modal-overlay" onClick={() => setShowGroupInfo(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>📢 {chat.name}</h3>
            <p className="group-member-count">{chat.participants?.length} members</p>

            <div className="group-members-list">
              {chat.participants?.map(p => (
                <div key={p._id} className="group-member-row">
                  <Avatar user={p} size={32} />
                  <div className="member-info">
                    <div className="member-name">{p.displayName}</div>
                    <div className="member-username">@{p.username}</div>
                  </div>
                  {isAdmin && p._id !== user._id && (
                    <button className="remove-btn" onClick={() => removeMember(p._id)}>Remove</button>
                  )}
                </div>
              ))}
            </div>

            {isAdmin && (
              <div className="add-member-section">
                <input
                  placeholder="Search users to add…"
                  value={searchUser}
                  onChange={e => setSearchUser(e.target.value)}
                />
                {userSearchResults.map(u => (
                  <div key={u._id} className="search-result-item compact">
                    <Avatar user={u} size={28} />
                    <span>{u.displayName}</span>
                    <button onClick={() => addMember(u._id)}>Add</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

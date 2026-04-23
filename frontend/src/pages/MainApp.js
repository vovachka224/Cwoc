import React, { useState, useEffect } from 'react';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import api from '../utils/api';

export default function MainApp() {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      const res = await api.get('/api/chats');
      setChats(res.data);
    } catch {}
  };

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
  };

  const handleChatUpdate = (updatedChat) => {
    setChats(prev => prev.map(c => c._id === updatedChat._id ? updatedChat : c));
    setSelectedChat(updatedChat);
  };

  return (
    <div className="app-layout">
      <ChatList
        selectedChatId={selectedChat?._id}
        onSelectChat={handleSelectChat}
        chats={chats}
        setChats={setChats}
      />
      <div className="main-area">
        {selectedChat ? (
          <ChatWindow
            key={selectedChat._id}
            chat={selectedChat}
            onChatUpdate={handleChatUpdate}
          />
        ) : (
          <div className="welcome-screen">
            <div className="welcome-icon">✈</div>
            <h2>Welcome to Telegraph</h2>
            <p>Select a chat to start messaging or search for users to connect with.</p>
          </div>
        )}
      </div>
    </div>
  );
}
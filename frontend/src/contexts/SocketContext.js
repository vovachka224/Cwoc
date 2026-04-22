import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { BASE_URL } from '../utils/api';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!user || !token) return;

    const socket = io(BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('users:online', (users) => setOnlineUsers(users));
    socket.on('user:status', ({ userId, isOnline }) => {
      setOnlineUsers(prev =>
        isOnline
          ? prev.includes(userId) ? prev : [...prev, userId]
          : prev.filter(id => id !== userId)
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user]);

  const emit = (event, data, callback) => socketRef.current?.emit(event, data, callback);
  const on   = (event, handler) => socketRef.current?.on(event, handler);
  const off  = (event, handler) => socketRef.current?.off(event, handler);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, onlineUsers, emit, on, off }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

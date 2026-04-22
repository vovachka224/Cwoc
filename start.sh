#!/bin/bash

# Telegraph startup script
# Run from the telegraph/ root directory

echo ""
echo "✈  Telegraph Chat App"
echo "====================="
echo ""

# Check MongoDB
if ! command -v mongod &> /dev/null && ! pgrep -x mongod > /dev/null; then
  echo "⚠️  MongoDB doesn't appear to be running."
  echo "   Start it with: brew services start mongodb-community"
  echo "   or: sudo systemctl start mongodb"
  echo ""
fi

# Install dependencies if needed
if [ ! -d "backend/node_modules" ]; then
  echo "📦 Installing backend dependencies..."
  cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  cd frontend && npm install && cd ..
fi

echo "🚀 Starting backend on port 5000..."
cd backend && npm run dev &
BACKEND_PID=$!

sleep 2

echo "🎨 Starting frontend on port 3000..."
cd ../frontend && npm start &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers started!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait

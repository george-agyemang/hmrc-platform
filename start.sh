#!/bin/bash
echo "🚀 Starting HMRC Platform..."

# Kill any existing processes on our ports
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1
# ── Backend setup ─────────────────────────────────────────────
cd /workspaces/hmrc-platform/backend

# Always recreate .env with correct values
cat > .env << 'EOF'
PORT=3001
NODE_ENV=development
HMRC_CLIENT_ID=zyqLKNddsLVjFrXDFtxQhnFtoW0H
HMRC_CLIENT_SECRET=8e83198d-efea-4989-9759-cda4aef4482f
HMRC_REDIRECT_URI=https://bug-free-space-capybara-q67vp7wj7wgfxx59-3001.app.github.dev/auth/callback
HMRC_API_BASE_URL=https://test-api.service.hmrc.gov.uk
HMRC_AUTH_URL=https://test-api.service.hmrc.gov.uk/oauth/authorize
HMRC_TOKEN_URL=https://test-api.service.hmrc.gov.uk/oauth/token
JWT_SECRET=hmrc_platform_jwt_secret_key_minimum_32_chars
JWT_EXPIRY=7d
DATABASE_URL=postgresql://postgres.fpiwskpmatjyndhwbeve:SingleMan1ntheSky@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:SingleMan1ntheSky@db.fpiwskpmatjyndhwbeve.supabase.co:5432/postgres
FRONTEND_URL=https://bug-free-space-capybara-q67vp7wj7wgfxx59-3000.app.github.dev
EOF

echo "✅ Backend .env written"

# Install if needed
[ ! -d node_modules ] && npm install
npx prisma generate

# ── Frontend setup ─────────────────────────────────────────────
cd /workspaces/hmrc-platform/frontend

# Always recreate vite.config.js
cat > vite.config.js << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/auth':        { target: 'http://localhost:3001', changeOrigin: true },
      '/users':       { target: 'http://localhost:3001', changeOrigin: true },
      '/businesses':  { target: 'http://localhost:3001', changeOrigin: true },
      '/submissions': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
EOF

# Install if needed
[ ! -d node_modules ] && npm install

echo "✅ Frontend ready"
echo ""
echo "Now run in two terminals:"
echo "  Terminal 1: cd backend && npm run dev"
echo "  Terminal 2: cd frontend && npm run dev"

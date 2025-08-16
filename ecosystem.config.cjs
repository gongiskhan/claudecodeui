module.exports = {
  apps: [{
    name: 'claudecodeui',
    script: 'npm',
    args: 'run dev',
    env: {
      PORT: '3002',
      VITE_PORT: '4567',
      NODE_ENV: 'development',
      GITHUB_CLIENT_ID: 'Ov23liT5QjgC6iysXd6w',
      GITHUB_CLIENT_SECRET: 'a7d9112a4464dfec0994fd11475458040f242d94',
      GITHUB_CALLBACK_URL: 'http://100.78.142.56:4567/api/auth/github/callback',
      CLIENT_URL: 'http://100.78.142.56:4567',
      GITHUB_ALLOWED_USERS: 'gongiskhan'
    },
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    time: true
  }]
}
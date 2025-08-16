module.exports = {
  apps: [{
    name: 'claudecodeui',
    script: 'npm',
    args: 'run dev',
    env: {
      PORT: '3002',
      VITE_PORT: '4568',
      NODE_ENV: 'development'
    },
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    error_file: '/home/ggomes/.pm2/logs/claudecodeui-error.log',
    out_file: '/home/ggomes/.pm2/logs/claudecodeui-out.log',
    time: true
  }]
}

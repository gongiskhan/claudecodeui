export default {
  apps: [{
    name: 'claudecodeui',
    script: 'npm',
    args: 'run start',
    env: {
      PORT: '3456',
      VITE_PORT: '4567',
      NODE_ENV: 'production'
    },
    watch: false,
    max_memory_restart: '1G',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    merge_logs: true,
    time: true
  }]
};
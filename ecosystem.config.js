module.exports = {
  apps: [{
    name: "habibi-market-staging",
    script: "npm",
    args: "start",
    cwd: "/home/ec2-user/app",
    env: {
      NODE_ENV: "staging",
      NODE_PATH: ".",
    },
    env_file: "/home/ec2-user/app/.env",
    instances: 1,
    exec_mode: "fork",
    watch: false,
    max_memory_restart: "1G",
    log_file: "/home/ec2-user/app/logs/app.log",
    out_file: "/home/ec2-user/app/logs/out.log",
    error_file: "/home/ec2-user/app/logs/error.log",
    combine_logs: true,
  }]
};
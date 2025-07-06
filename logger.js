const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../../logs/atmosync_logs/device_activity_logs');

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const transport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, '%DATE%.log'), 
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: '2d', 
  level: 'info',
});

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(
      info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`
    )
  ),
  transports: [
    transport,
    new winston.transports.Console({ level: 'debug' }), 
  ],
});

module.exports = logger;

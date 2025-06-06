/**
 * @fileoverview Centralized logging utility for SeirChain
 * Provides structured logging with different levels and formats
 */

const winston = require('winston');
const path = require('path');

// Log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

// Add colors to Winston
winston.addColors(colors);

// Create format for development (colorized, detailed)
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Create format for production (JSON, structured)
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  levels,
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
  transports: [
    // Console transport
    new winston.transports.Console(),
    
    // File transport for errors
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// Ensure log directory exists
const fs = require('fs');
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Add request logging middleware for Express
const expressLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      type: 'request',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });
  next();
};

// Add method to create child loggers for different components
const createChildLogger = (component) => {
  return logger.child({ component });
};

module.exports = {
  logger,
  expressLogger,
  createChildLogger,
  levels
};

const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, 'microservicios_error.log');

const logger = {
    error: (serviceName, message, error) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${serviceName}] ERROR: ${message} - ${error.stack || error}\n`;
        fs.appendFileSync(logFile, logMessage);
    },
    info: (serviceName, message) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${serviceName}] INFO: ${message}\n`;
        fs.appendFileSync(logFile, logMessage);
    }
};

module.exports = logger;
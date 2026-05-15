const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_FILE = process.env.CONTRACT_RUNNER_LOG_FILE ||
                 path.join(__dirname, '../logs/audit.log');

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Hash sensitive data to avoid logging PII
 */
function hashData(data) {
    if (!data) return 'null';
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
}

/**
 * Log an API request to audit trail
 */
async function log(entry) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        appName: entry.appName || 'unknown',
        userId: entry.userId || 'unknown',
        function: entry.function || 'unknown',
        method: entry.method || 'UNKNOWN',
        endpoint: entry.endpoint || 'unknown',
        paramsHash: entry.params ? hashData(entry.params) : 'none',
        status: entry.status || 'UNKNOWN',
        statusCode: entry.statusCode || 0,
        responseTime: entry.responseTime || 0,
        error: entry.error || null,
        ip: entry.ip || 'unknown'
    };

    try {
        fs.appendFileSync(
            LOG_FILE,
            JSON.stringify(logEntry) + '\n',
            { encoding: 'utf8' }
        );
    } catch (err) {
        console.error('❌ Failed to write audit log:', err.message);
    }
}

/**
 * Get all audit logs (useful for debugging)
 */
function getLogs(limit = 100) {
    try {
        const lines = fs.readFileSync(LOG_FILE, 'utf8')
            .split('\n')
            .filter(line => line.trim())
            .slice(-limit)
            .map(line => JSON.parse(line));
        return lines;
    } catch (err) {
        console.error('Error reading audit logs:', err.message);
        return [];
    }
}

/**
 * Clear audit logs (admin only)
 */
function clearLogs() {
    try {
        fs.writeFileSync(LOG_FILE, '', { encoding: 'utf8' });
        return true;
    } catch (err) {
        console.error('Error clearing audit logs:', err.message);
        return false;
    }
}

module.exports = {
    log,
    getLogs,
    clearLogs,
    logFilePath: LOG_FILE
};

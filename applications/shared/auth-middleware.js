const jwt = require('jsonwebtoken');

/**
 * Verify JWT token from Authorization header
 * Requires: Authorization: Bearer <token>
 */
function verifyToken(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Access denied: No token provided' });
    }

    try {
        // Determine which secret to use based on the service/endpoint
        const secret = getSecretForService(req);
        const decoded = jwt.verify(token, secret);

        // Attach decoded token data to request
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token', details: error.message });
    }
}

/**
 * Extract role from JWT payload
 * Expects JWT to contain: { role: 'patient|hospital|admin|pharmacy', id: '...', ... }
 */
function getRole(req) {
    return req.user?.role || null;
}

/**
 * Extract ID from JWT payload
 */
function getUserId(req) {
    return req.user?.id || null;
}

/**
 * Get the appropriate JWT secret based on service
 * CRITICAL: All environment variables MUST be set. No fallback to hardcoded values.
 */
function getSecretForService(req) {
    const host = req.get('host') || '';

    // Check port or service type from request
    if (host.includes('3001') || process.env.SERVICE_TYPE === 'admin') {
        const secret = process.env.JWT_SECRET_ADMIN;
        if (!secret) throw new Error('CRITICAL: JWT_SECRET_ADMIN is not set in environment');
        return secret;
    }
    if (host.includes('3004') || process.env.SERVICE_TYPE === 'hospital') {
        const secret = process.env.JWT_SECRET_HOSPITAL;
        if (!secret) throw new Error('CRITICAL: JWT_SECRET_HOSPITAL is not set in environment');
        return secret;
    }
    if (host.includes('3006') || process.env.SERVICE_TYPE === 'pharmacy') {
        const secret = process.env.JWT_SECRET_PHARMACY;
        if (!secret) throw new Error('CRITICAL: JWT_SECRET_PHARMACY is not set in environment');
        return secret;
    }
    // Default to patient portal
    const secret = process.env.JWT_SECRET_PATIENT;
    if (!secret) throw new Error('CRITICAL: JWT_SECRET_PATIENT is not set in environment');
    return secret;
}

/**
 * Generate JWT token for a user
 * Used during login
 */
function generateToken(payload, options = {}) {
    const secret = getSecretForService({ get: () => options.service || '' });
    const expiresIn = options.expiresIn || '24h';

    return jwt.sign(payload, secret, { expiresIn });
}

module.exports = {
    verifyToken,
    getRole,
    getUserId,
    getSecretForService,
    generateToken
};

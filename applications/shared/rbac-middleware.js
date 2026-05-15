const { getRole, getUserId, verifyToken } = require('./auth-middleware');

/**
 * Middleware to require admin role
 * Wraps verifyToken and checks for admin role
 */
function requireAdmin() {
    return (req, res, next) => {
        // First verify token
        verifyToken(req, res, () => {
            if (getRole(req) !== 'admin') {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Admin role required'
                });
            }
            next();
        });
    };
}

/**
 * Middleware to require a specific role
 * @param {string|string[]} roles - Single role or array of allowed roles
 */
function requireRole(roles) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    return (req, res, next) => {
        // First verify token
        verifyToken(req, res, () => {
            const userRole = getRole(req);
            if (!allowedRoles.includes(userRole)) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: `Required role: ${allowedRoles.join(' or ')}`
                });
            }
            next();
        });
    };
}

/**
 * Middleware to ensure patient is accessing only their own data
 * @param {string} paramName - Name of the parameter containing patient ID (e.g., 'patientId', 'id')
 */
function requirePatient(paramName = 'patientId') {
    return (req, res, next) => {
        // First verify token
        verifyToken(req, res, () => {
            const userRole = getRole(req);
            const userId = getUserId(req);

            // Get the ID from URL params, query, or body
            const resourceId = req.params[paramName] || req.query[paramName] || req.body[paramName];

            // Allow if:
            // 1. User is admin (can access any patient data)
            // 2. User is patient and accessing their own data
            if (userRole === 'admin' || (userRole === 'patient' && userId === resourceId)) {
                return next();
            }

            return res.status(403).json({
                error: 'Access denied',
                message: 'You can only access your own patient data'
            });
        });
    };
}

/**
 * Middleware to ensure hospital is accessing authorized patient data
 * @param {string} patientIdParam - Name of the parameter containing patient ID
 * @param {string} hospitalIdParam - Name of the parameter containing hospital ID (optional)
 */
function requireHospital(patientIdParam = 'patientId', hospitalIdParam = 'hospitalId') {
    return (req, res, next) => {
        // First verify token
        verifyToken(req, res, () => {
            const userRole = getRole(req);
            const userId = getUserId(req);

            // Get IDs from request
            const resourcePatientId = req.params[patientIdParam] || req.body[patientIdParam];
            const resourceHospitalId = req.params[hospitalIdParam] || req.body[hospitalIdParam];

            // Allow if:
            // 1. User is admin
            // 2. User is hospital and the request contains matching hospital ID
            if (userRole === 'admin' || (userRole === 'hospital' && userId === resourceHospitalId)) {
                return next();
            }

            return res.status(403).json({
                error: 'Access denied',
                message: 'Hospital can only access data within their organization'
            });
        });
    };
}

/**
 * Middleware to require pharmacy role
 */
function requirePharmacy() {
    return requireRole('pharmacy');
}

/**
 * Middleware to verify that a specific entity owns/can modify a resource
 * Useful for updating prescriptions, medical records, etc.
 * @param {string} ownerIdParam - Parameter name containing owner/creator ID
 * @param {string} ownerTypeParam - Parameter name containing owner type
 */
function requireOwnerOrAdmin(ownerIdParam = 'ownerId', ownerTypeParam = 'ownerType') {
    return (req, res, next) => {
        // First verify token
        verifyToken(req, res, () => {
            const userRole = getRole(req);
            const userId = getUserId(req);

            const resourceOwnerId = req.params[ownerIdParam] || req.body[ownerIdParam];
            const resourceOwnerType = req.params[ownerTypeParam] || req.body[ownerTypeParam];

            // Allow if:
            // 1. User is admin
            // 2. User matches owner ID and role matches owner type
            if (
                userRole === 'admin' ||
                (userId === resourceOwnerId && userRole === resourceOwnerType)
            ) {
                return next();
            }

            return res.status(403).json({
                error: 'Access denied',
                message: 'Only the owner or admin can modify this resource'
            });
        });
    };
}

module.exports = {
    requireAdmin,
    requireRole,
    requirePatient,
    requireHospital,
    requirePharmacy,
    requireOwnerOrAdmin
};

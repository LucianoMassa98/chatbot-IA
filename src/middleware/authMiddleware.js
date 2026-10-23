const { OAuth2Client } = require('google-auth-library');
const logger = require('../config/logger');
const env = require('../config/env');
const { User } = require('../models');

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/**
 * Auth Middleware — Validates Google ID tokens issued by the React frontend.
 *
 * Flow:
 *   1. React frontend signs in via Google OAuth and obtains an ID token.
 *   2. React sends: Authorization: Bearer <google_id_token>
 *   3. This middleware verifies the token against Google's public keys.
 *   4. It then looks up the user by email and checks role is operador/administrador.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido.',
      });
    }

    const idToken = authHeader.split(' ')[1];

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email } = payload;

    if (!email) {
      return res.status(401).json({ success: false, message: 'Token de Google inválido.' });
    }

    // Look up staff user by email stored in metadata.googleEmail (JSONB)
    const { Op } = require('sequelize');
    const matchedUser = await User.findOne({
      where: {
        isActive: true,
        metadata: { [Op.contains]: { googleEmail: email } },
      },
    });

    if (!matchedUser || !['operador', 'administrador'].includes(matchedUser.role)) {
      logger.warn(`Unauthorized CRM access attempt from Google email: ${email}`);
      return res.status(403).json({
        success: false,
        message: 'No tenés acceso al panel de administración.',
      });
    }

    req.admin = {
      id: matchedUser.id,
      email,
      role: matchedUser.role,
      firstName: matchedUser.firstName,
    };

    logger.debug(`CRM access granted to ${email} (role: ${matchedUser.role})`);
    next();
  } catch (error) {
    logger.warn(`Auth middleware error: ${error.message}`);
    return res.status(401).json({
      success: false,
      message: 'Token de Google inválido o expirado.',
    });
  }
};

/**
 * Role guard — only allows specific roles through.
 * Usage: router.use(roleGuard('administrador'))
 */
const roleGuard = (...allowedRoles) => (req, res, next) => {
  if (!req.admin || !allowedRoles.includes(req.admin.role)) {
    return res.status(403).json({
      success: false,
      message: 'No tenés permisos para realizar esta acción.',
    });
  }
  next();
};

module.exports = { authMiddleware, roleGuard };

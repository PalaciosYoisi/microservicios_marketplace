const jwt = require('jsonwebtoken');

/**
 * Middleware de autenticación para el gateway
 * Verifica el JWT y adjunta los datos del usuario al request
 */
function autenticar(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token de autenticación requerido.' });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado.' });
  }
}

/**
 * Middleware opcional: adjunta usuario si hay token, pero no bloquea si no hay
 */
function autenticarOpcional(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // Token inválido, continuar sin usuario
    }
  }
  next();
}

module.exports = { autenticar, autenticarOpcional };

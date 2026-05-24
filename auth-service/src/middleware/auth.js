const jwt = require('jsonwebtoken');

/**
 * Middleware de autenticación JWT
 * Verifica el token en el header Authorization: Bearer <token>
 */
function autenticar(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token de autenticación requerido.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado.' });
  }
}

module.exports = { autenticar };

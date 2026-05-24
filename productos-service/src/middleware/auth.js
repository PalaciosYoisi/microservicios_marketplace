const jwt = require('jsonwebtoken');

function autenticar(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Token requerido.' });
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado.' });
  }
}

function soloRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ success: false, message: 'No autenticado.' });
    if (!roles.includes(req.usuario.rol)) return res.status(403).json({ success: false, message: 'No tienes permiso para esta acción.' });
    next();
  };
}

module.exports = { autenticar, soloRol };

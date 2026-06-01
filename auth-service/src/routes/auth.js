const express = require('express');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { autenticar } = require('../middleware/auth');

function soloAdmin(req, res, next) {
  if (!req.usuario || req.usuario.rol !== 'administrador') {
    return res.status(403).json({ success: false, message: 'Acceso restringido a administradores.' });
  }
  next();
}

// ── Multer: fotos de perfil en memoria → se guardan como base64 en MongoDB ────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes.'));
  },
});

// ── Rutas públicas ────────────────────────────────────────────────────────────
router.post('/register', ctrl.registrar);
router.post('/login', ctrl.iniciarSesion);
router.post('/logout', ctrl.cerrarSesion);
router.post('/verify', ctrl.verificarToken);

// ── Rutas autenticadas ────────────────────────────────────────────────────────
router.get('/me', autenticar, ctrl.obtenerPerfil);
router.put('/perfil', autenticar, ctrl.actualizarPerfil);
router.post('/perfil/foto', autenticar, upload.single('foto'), ctrl.subirFotoPerfil);

// ── Endpoints internos (servicio a servicio — requieren x-service-key) ────────
router.post('/internal/usuarios/bulk', ctrl.obtenerUsuariosBulk);
router.get('/internal/usuarios', ctrl.listarTodosUsuarios);

// ── Endpoints admin (requieren JWT de administrador) ──────────────────────────
router.get('/admin/usuarios', autenticar, soloAdmin, ctrl.adminListarUsuarios);
router.post('/admin/usuarios/:id/estado', autenticar, soloAdmin, ctrl.adminCambiarEstadoUsuario);

module.exports = router;

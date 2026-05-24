const express = require('express');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { autenticar } = require('../middleware/auth');

// ── Multer: fotos de perfil → frontend-service/public/uploads/perfiles/ ──────
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../../frontend-service/public/uploads/perfiles'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `perfil-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
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

module.exports = router;

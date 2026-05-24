const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/productosController');
const { autenticar, soloRol } = require('../middleware/auth');

// ── Directorios de uploads (crear si no existen) ──────────────────────────────
const DIR_PRODUCTOS = path.join(__dirname, '../../../frontend-service/public/uploads/productos');
const DIR_RESENAS   = path.join(__dirname, '../../../frontend-service/public/uploads/resenas');
fs.mkdirSync(DIR_PRODUCTOS, { recursive: true });
fs.mkdirSync(DIR_RESENAS,   { recursive: true });

// ── Multer: imágenes de productos ──────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: DIR_PRODUCTOS,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `producto-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes.'));
  },
});

// ── Multer: fotos de reseñas ──────────────────────────────────────────────────
const storageResenas = multer.diskStorage({
  destination: DIR_RESENAS,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `resena-${Date.now()}${ext}`);
  },
});
const uploadResena = multer({
  storage: storageResenas,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes.'));
  },
});

// Endpoints internos (servicio a servicio — requieren x-service-key, no JWT)
router.post('/internal/productos/bulk', ctrl.obtenerProductosBulk);
router.post('/internal/stock/reducir', ctrl.reducirStock);

// Upload de imagen de producto (autenticado como vendedor)
router.post('/vendedor/upload-imagen', autenticar, soloRol('emprendedor'), upload.single('imagen'), ctrl.subirImagenProducto);

// ── Público ───────────────────────────────────────────────────────────────────
router.get('/productos', ctrl.listarProductos);
router.get('/productos/:id', ctrl.verProducto);
router.get('/tiendas', ctrl.listarTiendas);
router.get('/tiendas/:id', ctrl.verTienda);

// ── Autenticado (cualquier rol) ───────────────────────────────────────────────
router.get('/favoritos', autenticar, ctrl.listarFavoritos);
router.post('/favoritos', autenticar, ctrl.agregarFavorito);
router.delete('/favoritos/:id', autenticar, ctrl.eliminarFavorito);
router.post('/resenas/upload-foto', autenticar, uploadResena.single('foto'), ctrl.subirFotoResena);
router.post('/resenas', autenticar, ctrl.crearResena);

// ── Vendedor ──────────────────────────────────────────────────────────────────
router.post('/tiendas', autenticar, soloRol('emprendedor'), ctrl.crearTienda);
router.get('/vendedor/productos', autenticar, soloRol('emprendedor'), ctrl.listarProductosVendedor);
router.post('/vendedor/productos', autenticar, soloRol('emprendedor'), ctrl.crearProducto);
router.put('/vendedor/productos/:id', autenticar, soloRol('emprendedor'), ctrl.actualizarProducto);
router.delete('/vendedor/productos/:id', autenticar, soloRol('emprendedor'), ctrl.eliminarProducto);
router.post('/vendedor/productos/:id/reponer-stock', autenticar, soloRol('emprendedor'), ctrl.reponerStock);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/tiendas', autenticar, soloRol('administrador'), ctrl.adminListarTiendas);
router.post('/admin/tiendas/:id/estado', autenticar, soloRol('administrador'), ctrl.adminCambiarEstadoTienda);
router.get('/admin/productos', autenticar, soloRol('administrador'), ctrl.adminListarProductos);
router.post('/admin/productos/:id/desactivar', autenticar, soloRol('administrador'), ctrl.adminDesactivarProducto);

module.exports = router;

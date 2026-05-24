const express = require('express');
const router = express.Router();
const carrito = require('../controllers/carritoController');
const pedidos = require('../controllers/pedidosController');
const { autenticar, soloRol } = require('../middleware/auth');

// ── Carrito ───────────────────────────────────────────────────────────────────
router.get('/carrito', autenticar, carrito.obtenerCarrito);
router.post('/carrito/agregar', autenticar, carrito.agregarAlCarrito);
router.put('/carrito/:id', autenticar, carrito.actualizarCarrito);
router.delete('/carrito/:id', autenticar, carrito.eliminarDelCarrito);
router.delete('/carrito', autenticar, carrito.vaciarCarrito);

// ── Checkout ──────────────────────────────────────────────────────────────────
router.post('/checkout/procesar', autenticar, pedidos.procesarPago);

// ── Comprador ─────────────────────────────────────────────────────────────────
router.get('/comprador/pedidos', autenticar, pedidos.listarPedidosComprador);
router.get('/comprador/pedidos/:id', autenticar, pedidos.verPedidoComprador);
router.post('/comprador/pedidos/:id/marcar-recibido', autenticar, pedidos.marcarRecibido);
router.get('/comprador/mis-vendedores', autenticar, pedidos.getMisVendedores);
router.get('/comprador/direcciones', autenticar, pedidos.listarDirecciones);
router.post('/comprador/direcciones', autenticar, pedidos.crearDireccion);
router.delete('/comprador/direcciones/:id', autenticar, pedidos.eliminarDireccion);
router.get('/comprador/metodos-pago', autenticar, pedidos.listarMetodosPago);
router.post('/comprador/metodos-pago', autenticar, pedidos.crearMetodoPago);
router.delete('/comprador/metodos-pago/:id', autenticar, pedidos.eliminarMetodoPago);

// ── Vendedor ──────────────────────────────────────────────────────────────────
router.get('/vendedor/pedidos', autenticar, soloRol('emprendedor'), pedidos.listarPedidosVendedor);
router.post('/vendedor/pedidos/:id/procesar', autenticar, soloRol('emprendedor'), pedidos.procesarPedidoVendedor);
router.post('/vendedor/pedidos/:id/marcar-enviado', autenticar, soloRol('emprendedor'), pedidos.marcarEnviado);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/pedidos', autenticar, soloRol('administrador'), pedidos.adminListarPedidos);

module.exports = router;

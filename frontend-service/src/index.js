require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3005;

// Servir archivos estáticos (CSS, JS, imágenes)
app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/js', express.static(path.join(__dirname, '../public/js')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));
app.use('/img', express.static(path.join(__dirname, '../public/images')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Placeholder para imágenes no encontradas
app.get('/img/no-image.png', (req, res) => {
  res.type('svg').sendFile(path.join(__dirname, '../public/images/no-image.svg'));
});

// Rutas de páginas HTML
const pagesDir = path.join(__dirname, '../public/pages');

app.get('/', (req, res) => res.sendFile(path.join(pagesDir, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(pagesDir, 'login.html')));
app.get('/marketplace', (req, res) => res.sendFile(path.join(pagesDir, 'marketplace.html')));
app.get('/producto/:id', (req, res) => res.sendFile(path.join(pagesDir, 'detalle_producto.html')));
app.get('/tienda/:id', (req, res) => res.sendFile(path.join(pagesDir, 'detalle_tienda.html')));
app.get('/carrito', (req, res) => res.sendFile(path.join(pagesDir, 'carrito.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(pagesDir, 'checkout.html')));
app.get('/confirmacion-compra', (req, res) => res.sendFile(path.join(pagesDir, 'confirmacion_compra.html')));
app.get('/favoritos', (req, res) => res.sendFile(path.join(pagesDir, 'favoritos.html')));
app.get('/comprador/dashboard', (req, res) => res.sendFile(path.join(pagesDir, 'comprador_dashboard.html')));
app.get('/vendedor/dashboard', (req, res) => res.sendFile(path.join(pagesDir, 'vendedor_dashboard.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(pagesDir, 'admin_dashboard.html')));
app.get('/mensajes', (req, res) => res.sendFile(path.join(pagesDir, 'mensajes.html')));
app.get('/notificaciones', (req, res) => res.sendFile(path.join(pagesDir, 'notificaciones.html')));
app.get('/reportes', (req, res) => res.sendFile(path.join(pagesDir, 'reportes.html')));

app.get('/health', (req, res) => res.json({ service: 'frontend-service', status: 'ok', port: PORT }));

app.listen(PORT, () => console.log(`[frontend-service] Corriendo en http://localhost:${PORT}`));

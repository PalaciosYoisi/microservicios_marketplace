require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Configuración ─────────────────────────────────────────────────────────────
const SERVICES = {
  auth:           process.env.AUTH_SERVICE_URL           || 'http://localhost:3001',
  productos:      process.env.PRODUCTOS_SERVICE_URL      || 'http://localhost:3002',
  pedidos:        process.env.PEDIDOS_SERVICE_URL        || 'http://localhost:3003',
  notificaciones: process.env.NOTIFICACIONES_SERVICE_URL || 'http://localhost:3004',
  reportes:       process.env.REPORTES_SERVICE_URL       || 'http://localhost:3006',
  frontend:       process.env.FRONTEND_SERVICE_URL       || 'http://localhost:3005',
};

// ── Middlewares globales ──────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Health checks del gateway (antes de cualquier proxy) ──────────────────────
app.get('/gateway/health', (req, res) => {
  res.json({
    service: 'api-gateway',
    status: 'ok',
    port: PORT,
    timestamp: new Date().toISOString(),
    services: SERVICES,
  });
});

app.get('/gateway/services', async (req, res) => {
  const resultados = {};
  const serviciosBackend = Object.entries(SERVICES).filter(([n]) => n !== 'frontend');

  await Promise.allSettled(
    serviciosBackend.map(async ([nombre, url]) => {
      const inicio = Date.now();
      try {
        const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
        const data = await r.json();
        resultados[nombre] = { ...data, url, latencia_ms: Date.now() - inicio };
      } catch (err) {
        resultados[nombre] = { status: 'offline', url, error: err.message, latencia_ms: Date.now() - inicio };
      }
    })
  );

  const todosOk = Object.values(resultados).every(r => r.status === 'ok');
  return res.status(todosOk ? 200 : 207).json({
    gateway: 'ok',
    timestamp: new Date().toISOString(),
    resumen: {
      total: Object.keys(resultados).length,
      online: Object.values(resultados).filter(r => r.status === 'ok').length,
      offline: Object.values(resultados).filter(r => r.status !== 'ok').length,
    },
    servicios: resultados,
  });
});

// ── Helper para crear proxy con manejo de errores ─────────────────────────────
function makeProxy(target, pathFilter, pathRewrite) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter,
    pathRewrite,
    on: {
      error: (err, req, res) => {
        console.error(`[gateway] Error proxy → ${target}:`, err.message);
        if (!res.headersSent) {
          res.status(502).json({ success: false, message: `Servicio no disponible: ${err.message}` });
        }
      },
    },
  });
}

// ── Rutas de proxy ────────────────────────────────────────────────────────────
// NOTA: usamos pathFilter (no app.use con path) para que Express no elimine
// el prefijo del URL antes de que el pathRewrite lo procese.

// Auth Service: /api/auth/** → auth-service /auth/**
app.use(makeProxy(
  SERVICES.auth,
  '/api/auth',
  { '^/api/auth': '/auth' }
));

// Productos Service
app.use(makeProxy(
  SERVICES.productos,
  [
    '/api/productos',
    '/api/tiendas',
    '/api/favoritos',
    '/api/resenas',
    '/api/vendedor/productos',
    '/api/vendedor/upload-imagen',
    '/api/admin/tiendas',
    '/api/admin/productos',
  ],
  { '^/api': '' }
));

// Pedidos Service
app.use(makeProxy(
  SERVICES.pedidos,
  [
    '/api/carrito',
    '/api/checkout',
    '/api/comprador',
    '/api/vendedor/pedidos',
    '/api/admin/pedidos',
  ],
  { '^/api': '' }
));

// Notificaciones Service
app.use(makeProxy(
  SERVICES.notificaciones,
  [
    '/api/notificaciones',
    '/api/mensajes',
    '/api/mensajes-usuarios',
  ],
  { '^/api': '' }
));

// Reportes Service (microservicio independiente)
app.use(makeProxy(
  SERVICES.reportes,
  ['/api/reportes'],
  { '^/api': '' }
));

// Frontend Service: todo lo demás (sin pathRewrite)
app.use(makeProxy(SERVICES.frontend, undefined, undefined));

// ── Inicio ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[api-gateway] Corriendo en http://localhost:${PORT}`);
  console.log('[api-gateway] Servicios registrados:');
  Object.entries(SERVICES).forEach(([name, url]) => console.log(`  ${name}: ${url}`));
});

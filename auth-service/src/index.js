require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/auth', authRoutes);

// Health check — reporta estado real de la BD
app.get('/health', (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  res.status(dbOk ? 200 : 200).json({
    service: 'auth-service',
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk ? 'connected' : 'disconnected',
    port: PORT,
  });
});

// ── Arrancar HTTP primero, luego conectar BD ──────────────────────────────────
app.listen(PORT, () =>
  console.log(`[auth-service] HTTP escuchando en http://localhost:${PORT}`)
);

function conectarMongo() {
  mongoose
    .connect(process.env.MONGO_URI, {
      directConnection: true,
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => console.log('[auth-service] Conectado a MongoDB'))
    .catch(err => {
      console.error('[auth-service] MongoDB no disponible:', err.message, '— reintentando en 5 s…');
      setTimeout(conectarMongo, 5000);
    });
}
conectarMongo();

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const routes = require('./routes/index');

const app  = express();
const PORT = process.env.PORT || 3006;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', routes);

app.get('/health', (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  res.json({
    service: 'reportes-service',
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk ? 'connected' : 'disconnected',
    port: PORT,
  });
});

app.listen(PORT, () =>
  console.log(`[reportes-service] HTTP escuchando en http://localhost:${PORT}`)
);

function conectarMongo() {
  mongoose
    .connect(process.env.MONGO_URI, {
      directConnection: true,
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => console.log('[reportes-service] Conectado a MongoDB'))
    .catch(err => {
      console.error('[reportes-service] MongoDB no disponible:', err.message, '— reintentando en 5 s…');
      setTimeout(conectarMongo, 5000);
    });
}
conectarMongo();

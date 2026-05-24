/**
 * db-init.js — Inicializa las 4 bases de datos de EmprendeMarket
 *
 * Una base de datos por servicio (patrón microservicios):
 *   emprendemarket_auth          → auth-service
 *   emprendemarket_productos     → productos-service
 *   emprendemarket_pedidos       → pedidos-service
 *   emprendemarket_notificaciones → notificaciones-service
 *
 * Uso: node db-init.js
 */

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const BASE_URI = 'mongodb://127.0.0.1:27017';

// ── Esquema por base de datos ─────────────────────────────────────────────────

const DATABASES = {

  emprendemarket_auth: {
    usuarios: [
      { key: { correo: 1 },   options: { unique: true, name: 'idx_correo' } },
      { key: { cedula: 1 },   options: { unique: true, sparse: true, name: 'idx_cedula' } },
      { key: { rol: 1 },      options: { name: 'idx_rol' } },
      { key: { estado: 1 },   options: { name: 'idx_estado' } },
    ],
  },

  emprendemarket_productos: {
    tiendas: [
      { key: { id_propietario: 1 }, options: { name: 'idx_propietario' } },
      { key: { estado: 1 },         options: { name: 'idx_estado' } },
      { key: { categoria: 1 },      options: { name: 'idx_categoria' } },
    ],
    productos: [
      { key: { id_tienda: 1 },      options: { name: 'idx_tienda' } },
      { key: { categoria: 1 },      options: { name: 'idx_categoria' } },
      { key: { estado: 1 },         options: { name: 'idx_estado' } },
      { key: { nombre_producto: 'text', descripcion: 'text' }, options: { name: 'idx_texto_busqueda' } },
    ],
    productos_imagenes: [
      { key: { id_producto: 1 }, options: { name: 'idx_producto' } },
    ],
    resenas: [
      { key: { id_producto: 1 },  options: { name: 'idx_producto' } },
      { key: { id_comprador: 1 }, options: { name: 'idx_comprador' } },
    ],
    favoritos: [
      { key: { id_usuario: 1 }, options: { name: 'idx_usuario' } },
      { key: { id_usuario: 1, id_producto: 1 }, options: { unique: true, name: 'idx_usuario_producto' } },
    ],
    promociones: [
      { key: { id_tienda: 1 },   options: { name: 'idx_tienda' } },
      { key: { id_producto: 1 }, options: { name: 'idx_producto' } },
      { key: { estado: 1 },      options: { name: 'idx_estado' } },
    ],
  },

  emprendemarket_pedidos: {
    carrito: [
      { key: { id_usuario: 1 },  options: { name: 'idx_usuario' } },
      { key: { id_producto: 1 }, options: { name: 'idx_producto' } },
    ],
    pedidos: [
      { key: { id_comprador: 1 },  options: { name: 'idx_comprador' } },
      { key: { estado: 1 },        options: { name: 'idx_estado' } },
      { key: { fecha_pedido: -1 }, options: { name: 'idx_fecha' } },
    ],
    detalles_pedido: [
      { key: { id_pedido: 1 },   options: { name: 'idx_pedido' } },
      { key: { id_producto: 1 }, options: { name: 'idx_producto' } },
    ],
    direcciones: [
      { key: { id_usuario: 1 }, options: { name: 'idx_usuario' } },
    ],
    metodos_pago: [
      { key: { id_usuario: 1 }, options: { name: 'idx_usuario' } },
    ],
  },

  emprendemarket_notificaciones: {
    notificaciones: [
      { key: { id_usuario: 1 },    options: { name: 'idx_usuario' } },
      { key: { leida: 1 },         options: { name: 'idx_leida' } },
      { key: { fecha_creacion: -1 }, options: { name: 'idx_fecha' } },
    ],
    mensajes: [
      { key: { id_conversacion: 1 }, options: { name: 'idx_conversacion' } },
      { key: { id_remitente: 1 },    options: { name: 'idx_remitente' } },
      { key: { id_destinatario: 1 }, options: { name: 'idx_destinatario' } },
    ],
    reportes_productos: [
      { key: { id_producto: 1 },   options: { name: 'idx_producto' } },
      { key: { id_reportante: 1 }, options: { name: 'idx_reportante' } },
      { key: { estado: 1 },        options: { name: 'idx_estado' } },
    ],
  },

};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function initDatabase(client, dbName, collections) {
  const db = client.db(dbName);
  const existing = new Set((await db.listCollections().toArray()).map(c => c.name));

  for (const [colName, indexes] of Object.entries(collections)) {
    if (!existing.has(colName)) {
      await db.createCollection(colName);
      console.log(`  [${dbName}] Colección creada: ${colName}`);
    }
    const col = db.collection(colName);
    for (const { key, options } of indexes) {
      try {
        await col.createIndex(key, options);
      } catch (e) {
        if (!e.message.includes('already exists')) throw e;
      }
    }
  }
  console.log(`  [${dbName}] Listo.`);
  return db;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function init() {
  const client = new MongoClient(BASE_URI);

  try {
    await client.connect();
    console.log(`[db-init] Conectado a MongoDB en ${BASE_URI}\n`);

    // Inicializar las 4 bases de datos
    for (const [dbName, collections] of Object.entries(DATABASES)) {
      console.log(`[db-init] Inicializando base de datos: ${dbName}`);
      await initDatabase(client, dbName, collections);
    }

    // Insertar administrador por defecto en emprendemarket_auth
    console.log('\n[db-init] Verificando usuario administrador...');
    const authDb = client.db('emprendemarket_auth');
    const usuariosCol = authDb.collection('usuarios');
    const adminExiste = await usuariosCol.findOne({ rol: 'administrador' });

    if (!adminExiste) {
      const hash = await bcrypt.hash('admin123', 10);
      await usuariosCol.insertOne({
        id_usuario: 1,
        cedula: '0000000001',
        nombre: 'Administrador',
        apellido: 'Sistema',
        correo: 'admin@emprendemarket.com',
        contrasena: hash,
        rol: 'administrador',
        estado: 'activo',
        fecha_registro: new Date(),
        ultimo_acceso: new Date(),
      });
      console.log('[db-init] Admin creado → correo: admin@emprendemarket.com  contraseña: admin123');
    } else {
      console.log('[db-init] Administrador ya existe.');
    }

    console.log('\n[db-init] ✓ Inicialización completada.');
    console.log('\nBases de datos creadas:');
    for (const dbName of Object.keys(DATABASES)) {
      console.log(`  • ${dbName}`);
    }
  } catch (err) {
    console.error('[db-init] Error:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

init();

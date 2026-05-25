/**
 * seed_productos.js
 * Inserta los productos del CSV en las tiendas activas.
 * Ejecutar DESPUÉS de aprobar las tiendas en el panel de admin.
 *
 * Uso:
 *   cd scripts
 *   node seed_productos.js
 */

'use strict';

const path     = require('path');
const fs       = require('fs');
const mongoose = require('mongoose');

const MONGO_PROD = 'mongodb://127.0.0.1:27017/emprendemarket_productos';

const tiendaSchema   = new mongoose.Schema({}, { collection: 'tiendas',   strict: false });
const productoSchema = new mongoose.Schema({}, { collection: 'productos',  strict: false });

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (values[i] || '').trim(); });
    return obj;
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Convierte "S:8;M:10;L:7" → [{nombre:"S",stock:8},{nombre:"M",stock:10},...]
 * Cadena vacía → []
 */
function parseTallas(str) {
  if (!str) return [];
  return str.split(';').map(part => {
    const [nombre, stock] = part.split(':');
    return { nombre: nombre.trim(), stock: parseInt(stock) || 0 };
  });
}

async function siguienteId(Model, campo) {
  const ultimo = await Model.findOne().sort({ [campo]: -1 }).lean();
  return ultimo ? (ultimo[campo] || 0) + 1 : 1;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱  EmprendeMarket — Seed de Productos\n');

  const csvPath = path.join(__dirname, 'productos.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('❌  No se encontró productos.csv en', csvPath);
    process.exit(1);
  }

  const filas = parseCsv(csvPath);
  console.log(`📄  CSV leído: ${filas.length} productos\n`);

  const conn = mongoose.createConnection(MONGO_PROD);
  await new Promise((res, rej) => { conn.once('open', res); conn.once('error', rej); });
  console.log('✅  Conectado a emprendemarket_productos\n');

  const Tienda   = conn.model('Tienda',   tiendaSchema);
  const Producto = conn.model('Producto', productoSchema);

  // Cargar todas las tiendas activas en un mapa nombre→tienda
  const tiendas = await Tienda.find().lean();
  const tiendaMap = {};
  tiendas.forEach(t => { tiendaMap[t.nombre_tienda] = t; });

  let creados = 0;
  let omitidos = 0;
  let advertencias = 0;

  for (const fila of filas) {
    const nombreTienda = fila['tienda_nombre'];
    const tienda = tiendaMap[nombreTienda];

    if (!tienda) {
      console.warn(`⚠️   Tienda no encontrada: "${nombreTienda}" — producto "${fila['nombre_producto']}" omitido`);
      omitidos++;
      continue;
    }

    const estadoTienda = (tienda.estado || '').toLowerCase();
    if (!['activa', 'activo'].includes(estadoTienda)) {
      console.warn(`⚠️   Tienda "${nombreTienda}" está en estado "${tienda.estado}" (no activa) — producto omitido`);
      advertencias++;
      omitidos++;
      continue;
    }

    // Verificar si ya existe ese producto en esa tienda
    const existe = await Producto.findOne({
      id_tienda: tienda.id_tienda,
      nombre_producto: fila['nombre_producto'],
    }).lean();

    if (existe) {
      console.log(`⚠️   Ya existe: "${fila['nombre_producto']}" en "${nombreTienda}"`);
      omitidos++;
      continue;
    }

    const idProducto = await siguienteId(Producto, 'id_producto');
    const tallas = parseTallas(fila['tallas']);

    await Producto.create({
      id_producto:       idProducto,
      id_tienda:         tienda.id_tienda,
      nombre_producto:   fila['nombre_producto'],
      descripcion:       fila['descripcion'],
      precio:            parseFloat(fila['precio']) || 0,
      stock:             parseInt(fila['stock'])    || 0,
      categoria:         fila['categoria'],
      imagen_url:        fila['imagen_url'],
      tallas,
      fecha_publicacion: new Date(),
      estado:            'activo',
    });

    console.log(`✅  [${nombreTienda}] ${fila['nombre_producto']} — $${Number(fila['precio']).toLocaleString('es-CO')}`);
    creados++;
  }

  console.log(`\n📊  Resumen: ${creados} productos creados, ${omitidos} omitidos.`);
  if (advertencias > 0) {
    console.log(`⚠️   ${advertencias} productos omitidos por tienda no activa. Aprueba las tiendas primero.`);
  }
  console.log('\n🎉  ¡Listo! Visita http://localhost:3000/marketplace para ver los productos.\n');

  await conn.close();
}

main().catch(err => { console.error('❌  Error:', err.message); process.exit(1); });

/**
 * seed_tiendas.js
 * Crea 10 usuarios emprendedores + sus tiendas (estado: pendiente).
 * Después ve al panel de admin y apruébalas.
 *
 * Uso:
 *   cd scripts
 *   npm install          ← solo la primera vez
 *   node seed_tiendas.js
 */

'use strict';

const path     = require('path');
const fs       = require('fs');
const bcrypt   = require('bcryptjs');
const mongoose = require('mongoose');

// ── Conexiones ────────────────────────────────────────────────────────────────
const MONGO_AUTH     = 'mongodb://127.0.0.1:27017/emprendemarket_auth';
const MONGO_PROD     = 'mongodb://127.0.0.1:27017/emprendemarket_productos';

// ── Esquemas mínimos ──────────────────────────────────────────────────────────
const usuarioSchema = new mongoose.Schema({}, { collection: 'usuarios', strict: false });
const tiendaSchema  = new mongoose.Schema({}, { collection: 'tiendas',  strict: false });

// ── Parsear CSV simple (soporta campos entre comillas con comas internas) ─────
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

async function siguienteId(Model, campo) {
  const ultimo = await Model.findOne().sort({ [campo]: -1 }).lean();
  return ultimo ? (ultimo[campo] || 0) + 1 : 1;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱  EmprendeMarket — Seed de Tiendas\n');

  const csvPath = path.join(__dirname, 'tiendas.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('❌  No se encontró tiendas.csv en', csvPath);
    process.exit(1);
  }

  const filas = parseCsv(csvPath);
  console.log(`📄  CSV leído: ${filas.length} tiendas\n`);

  // Conexión a auth DB
  const connAuth = mongoose.createConnection(MONGO_AUTH);
  await new Promise((res, rej) => {
    connAuth.once('open', res);
    connAuth.once('error', rej);
  });
  console.log('✅  Conectado a emprendemarket_auth');

  // Conexión a productos DB
  const connProd = mongoose.createConnection(MONGO_PROD);
  await new Promise((res, rej) => {
    connProd.once('open', res);
    connProd.once('error', rej);
  });
  console.log('✅  Conectado a emprendemarket_productos\n');

  const Usuario = connAuth.model('Usuario', usuarioSchema);
  const Tienda  = connProd.model('Tienda',  tiendaSchema);

  let creados = 0;
  let omitidos = 0;

  for (const fila of filas) {
    const correo = fila['propietario_correo'];

    // Verificar si el usuario ya existe
    const existe = await Usuario.findOne({ correo }).lean();
    if (existe) {
      console.log(`⚠️   Omitido (ya existe): ${correo}`);
      omitidos++;
      continue;
    }

    // Hash de contraseña
    const hash = await bcrypt.hash(fila['propietario_contrasena'], 10);

    // Crear usuario
    const idUsuario = await siguienteId(Usuario, 'id_usuario');
    await Usuario.create({
      id_usuario:     idUsuario,
      nombre:         fila['propietario_nombre'],
      apellido:       fila['propietario_apellido'],
      correo,
      cedula:         fila['propietario_cedula'],
      contrasena:     hash,
      rol:            'emprendedor',
      estado:         'activo',
      ultimo_acceso:  new Date(),
    });

    // Crear tienda
    const idTienda = await siguienteId(Tienda, 'id_tienda');
    await Tienda.create({
      id_tienda:         idTienda,
      id_propietario:    idUsuario,
      nombre_tienda:     fila['nombre_tienda'],
      descripcion:       fila['descripcion'],
      categoria:         fila['categoria'],
      horario_atencion:  fila['horario_atencion'],
      telefono_contacto: fila['telefono_contacto'],
      logo_url:          fila['logo_url'],
      fecha_creacion:    new Date(),
      estado:            'pendiente',
    });

    console.log(`✅  Creado: ${fila['nombre_tienda']} (id_tienda: ${idTienda}) — ${correo} (id_usuario: ${idUsuario})`);
    creados++;
  }

  console.log(`\n📊  Resumen: ${creados} creados, ${omitidos} omitidos.`);
  console.log('\n👉  Ahora inicia sesión como admin en http://localhost:3000/admin/dashboard');
  console.log('    ve a la sección "Tiendas" y aprueba las tiendas pendientes.');
  console.log('    Luego ejecuta: node seed_productos.js\n');

  await connAuth.close();
  await connProd.close();
}

main().catch(err => { console.error('❌  Error:', err.message); process.exit(1); });

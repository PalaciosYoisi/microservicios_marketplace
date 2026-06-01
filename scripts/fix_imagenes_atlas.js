/**
 * fix_imagenes_atlas.js
 * Sincroniza las imagen_url de productos en MongoDB Atlas usando el CSV como fuente.
 * También reemplaza URLs vacías/nulas con placeholders por categoría.
 *
 * Uso:
 *   node scripts/fix_imagenes_atlas.js
 */

'use strict';

const path     = require('path');
const fs       = require('fs');
const mongoose = require('mongoose');

const MONGO_ATLAS = 'mongodb+srv://yoisiyarlenisp_db_user:lw372kuG3fzkdOyE@cluster0.vydkhbh.mongodb.net/emprendemarket_productos?appName=Cluster0';

const tiendaSchema   = new mongoose.Schema({}, { collection: 'tiendas',   strict: false });
const productoSchema = new mongoose.Schema({}, { collection: 'productos',  strict: false });

// Imágenes de respaldo por categoría (Unsplash CDN, sin auth)
const PLACEHOLDER_POR_CATEGORIA = {
  'Ropa':                'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80',
  'Ropa Infantil':       'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=600&q=80',
  'Zapatos / Calzado':   'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
  'Bolsos y Accesorios': 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80',
  'Deportes':            'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=600&q=80',
  'Artesanías':          'https://images.unsplash.com/photo-1481931098730-318b6f776db0?w=600&q=80',
  'Alimentos':           'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&q=80',
  'Tecnología':          'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
  'Hogar':               'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
  'General':             'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&q=80',
};
const PLACEHOLDER_DEFAULT = 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&q=80';

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

function urlValida(url) {
  return url && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes('localhost');
}

async function main() {
  console.log('\n🖼️  Fix Imágenes — EmprendeMarket Atlas\n');

  await mongoose.connect(MONGO_ATLAS);
  console.log('✅  Conectado a MongoDB Atlas\n');

  const Tienda   = mongoose.model('Tienda',   tiendaSchema);
  const Producto = mongoose.model('Producto', productoSchema);

  // ── 1. Sincronizar desde CSV ─────────────────────────────────────────────────
  const csvPath = path.join(__dirname, 'productos.csv');
  if (fs.existsSync(csvPath)) {
    console.log('📄  Leyendo CSV y sincronizando imagen_url...\n');
    const filas = parseCsv(csvPath);

    const tiendas = await Tienda.find().lean();
    const tiendaMap = {};
    tiendas.forEach(t => { tiendaMap[t.nombre_tienda] = t; });

    let actualizados = 0;
    let sinCambios   = 0;

    for (const fila of filas) {
      const tienda = tiendaMap[fila['tienda_nombre']];
      if (!tienda || !urlValida(fila['imagen_url'])) continue;

      const result = await Producto.updateOne(
        {
          id_tienda:       tienda.id_tienda,
          nombre_producto: fila['nombre_producto'],
        },
        { $set: { imagen_url: fila['imagen_url'] } }
      );

      if (result.modifiedCount > 0) {
        console.log(`  ✔  [${fila['tienda_nombre']}] ${fila['nombre_producto']}`);
        actualizados++;
      } else {
        sinCambios++;
      }
    }
    console.log(`\n  → ${actualizados} actualizados desde CSV, ${sinCambios} sin cambios.\n`);
  }

  // ── 2. Productos sin imagen válida → placeholder por categoría ────────────────
  console.log('🔍  Buscando productos sin imagen válida...\n');
  const sinImagen = await Producto.find({
    $or: [
      { imagen_url: null },
      { imagen_url: '' },
      { imagen_url: { $exists: false } },
      { imagen_url: /^(?!https?:\/\/)/ },
    ],
  }).lean();

  console.log(`  → ${sinImagen.length} productos sin imagen válida.\n`);

  let reparados = 0;
  for (const prod of sinImagen) {
    const placeholder = PLACEHOLDER_POR_CATEGORIA[prod.categoria] || PLACEHOLDER_DEFAULT;
    await Producto.updateOne(
      { _id: prod._id },
      { $set: { imagen_url: placeholder } }
    );
    console.log(`  🖼  [${prod.categoria || 'General'}] ${prod.nombre_producto} → placeholder`);
    reparados++;
  }

  console.log(`\n📊  Resumen:`);
  console.log(`  • ${reparados} productos reparados con placeholder por categoría`);
  console.log('\n🎉  ¡Listo!\n');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌  Error:', err.message);
  process.exit(1);
});

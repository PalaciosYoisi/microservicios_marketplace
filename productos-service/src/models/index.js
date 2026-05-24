const mongoose = require('mongoose');

// ── Tienda ──────────────────────────────────────────────────────────────────
const tiendaSchema = new mongoose.Schema({
  id_tienda: Number,
  id_propietario: Number,
  nombre_tienda: String,
  descripcion: String,
  categoria: String,
  fecha_creacion: Date,
  estado: String,
  horario_atencion: String,
  telefono_contacto: String,
}, { collection: 'tiendas', strict: false, timestamps: false });

// ── Producto ─────────────────────────────────────────────────────────────────
const productoSchema = new mongoose.Schema({
  id_producto:       Number,
  id_tienda:         Number,
  nombre_producto:   String,
  descripcion:       String,
  precio:            Number,
  stock:             Number,
  categoria:         String,
  tallas:            { type: Array, default: [] }, // Soporta [{nombre, stock}] o [String] (compat)
  fecha_publicacion: Date,
  estado:            String,
  imagen_url:        String,
}, { collection: 'productos', strict: false, timestamps: false });

// ── Imagen de producto ────────────────────────────────────────────────────────
const productoImagenSchema = new mongoose.Schema({
  id_imagen: Number,
  id_producto: Number,
  url_imagen: String,
  es_principal: Boolean,
}, { collection: 'productos_imagenes', strict: false, timestamps: false });

// ── Reseña ────────────────────────────────────────────────────────────────────
const resenaSchema = new mongoose.Schema({
  id_resena:        Number,
  id_producto:      Number,
  id_comprador:     Number,
  nombre_comprador: String,
  calificacion:     Number,
  comentario:       String,
  foto_url:         String,
  fecha_resena:     Date,
  estado:           String,
}, { collection: 'resenas', strict: false, timestamps: false });

// ── Favorito ──────────────────────────────────────────────────────────────────
const favoritoSchema = new mongoose.Schema({
  id_favorito: Number,
  id_usuario: Number,
  id_producto: Number,
  fecha_agregado: Date,
}, { collection: 'favoritos', strict: false, timestamps: false });

// ── Promoción ─────────────────────────────────────────────────────────────────
const promocionSchema = new mongoose.Schema({
  id_promocion: Number,
  id_tienda: Number,
  id_producto: Number,
  tipo: String,
  valor: Number,
  fecha_inicio: Date,
  fecha_fin: Date,
  estado: String,
}, { collection: 'promociones', strict: false, timestamps: false });

module.exports = {
  Tienda: mongoose.model('Tienda', tiendaSchema),
  Producto: mongoose.model('Producto', productoSchema),
  ProductoImagen: mongoose.model('ProductoImagen', productoImagenSchema),
  Resena: mongoose.model('Resena', resenaSchema),
  Favorito: mongoose.model('Favorito', favoritoSchema),
  Promocion: mongoose.model('Promocion', promocionSchema),
};

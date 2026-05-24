const mongoose = require('mongoose');

/**
 * Modelo de Usuario - conecta con la colección 'usuarios' existente en MongoDB
 * Compatible con el esquema del proyecto Laravel original
 */
const usuarioSchema = new mongoose.Schema({
  id_usuario: { type: Number },
  cedula: { type: String },
  nombre: { type: String },
  apellido: { type: String },
  correo: { type: String },
  contrasena: { type: String },
  rol: { type: String }, // 'comprador', 'emprendedor', 'administrador'
  estado: { type: String, default: 'activo' },
  ultimo_acceso: { type: Date },
  foto_perfil: { type: String },
}, {
  collection: 'usuarios',
  strict: false, // Permite campos adicionales del esquema original
  timestamps: false,
});

module.exports = mongoose.model('Usuario', usuarioSchema);

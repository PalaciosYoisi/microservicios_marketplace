const mongoose = require('mongoose');

const reporteSchema = new mongoose.Schema({
  id_reporte:        Number,
  id_reportante:     Number,
  usuario_nombre:    String,
  rol_usuario:       String,
  // Destinatario
  tipo_destinatario: { type: String, default: 'admin' }, // 'admin' | 'vendedor' | 'ambos'
  id_tienda:         Number,
  nombre_tienda:     String,
  id_destinatario:   Number,   // id_propietario del vendedor si aplica
  // Contenido
  motivo:            String,
  descripcion:       String,
  // Ref adicional
  id_producto:       Number,
  // Estado
  estado:            { type: String, default: 'pendiente' },
  respuesta_admin:   String,   // respuesta del administrador
  fecha_creacion:    Date,
  fecha_actualizacion: Date,
}, { collection: 'reportes', strict: false, timestamps: false });

module.exports = {
  Reporte: mongoose.model('Reporte', reporteSchema),
};

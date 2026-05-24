const mongoose = require('mongoose');

const notificacionSchema = new mongoose.Schema({
  id_notificacion: Number,
  id_usuario:      Number,
  titulo:          String,
  mensaje:         String,
  tipo:            String,
  leida:           { type: Boolean, default: false },
  fecha_creacion:  Date,
}, { collection: 'notificaciones', strict: false, timestamps: false });

const mensajeSchema = new mongoose.Schema({
  id_mensaje:       Number,
  id_remitente:     Number,
  id_destinatario:  Number,
  contenido:        String,
  fecha_envio:      Date,
  leido:            { type: Boolean, default: false },
  id_conversacion:  String,
}, { collection: 'mensajes', strict: false, timestamps: false });

module.exports = {
  Notificacion: mongoose.model('Notificacion', notificacionSchema),
  Mensaje:      mongoose.model('Mensaje', mensajeSchema),
};

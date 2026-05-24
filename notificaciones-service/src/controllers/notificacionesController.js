const { Notificacion, Mensaje } = require('../models/index');

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const INTERNAL_KEY_NOTIF = process.env.INTERNAL_SERVICE_KEY || '';

async function fetchUsuariosBulk(ids) {
  try {
    const r = await fetch(`${AUTH_URL}/auth/internal/usuarios/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-service-key': INTERNAL_KEY_NOTIF },
      body: JSON.stringify({ ids }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await r.json();
    return data.usuarios || [];
  } catch (_) { return []; }
}

async function fetchTodosUsuarios() {
  try {
    const r = await fetch(`${AUTH_URL}/auth/internal/usuarios`, {
      method: 'GET',
      headers: { 'x-service-key': INTERNAL_KEY_NOTIF },
      signal: AbortSignal.timeout(5000),
    });
    const data = await r.json();
    return data.usuarios || [];
  } catch (_) { return []; }
}

async function siguienteId(Model, campo) {
  const ultimo = await Model.findOne().sort({ [campo]: -1 });
  return ultimo ? (ultimo[campo] || 0) + 1 : 1;
}

// ── Endpoint interno (servicio a servicio) ────────────────────────────────────

async function crearNotificacionInterna(req, res) {
  const serviceKey = req.headers['x-service-key'];
  if (!serviceKey || serviceKey !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(401).json({ success: false, message: 'No autorizado.' });
  }
  try {
    const { id_usuario, titulo, mensaje, tipo } = req.body;
    if (!id_usuario || !titulo || !mensaje) {
      return res.status(422).json({ success: false, message: 'Faltan campos requeridos.' });
    }
    const nuevoId = await siguienteId(Notificacion, 'id_notificacion');
    const notif = new Notificacion({
      id_notificacion: nuevoId,
      id_usuario: parseInt(id_usuario),
      titulo,
      mensaje,
      tipo: tipo || 'sistema',
      leida: false,
      fecha_creacion: new Date(),
    });
    await notif.save();
    return res.status(201).json({ success: true });
  } catch (err) {
    console.error('[notificaciones-service] crearNotificacionInterna:', err);
    return res.status(500).json({ success: false, message: 'Error al crear notificación.' });
  }
}

// ── Notificaciones ────────────────────────────────────────────────────────────

async function listarNotificaciones(req, res) {
  try {
    const notificaciones = await Notificacion.find({ id_usuario: req.usuario.id }).sort({ fecha_creacion: -1 });
    return res.json({ success: true, notificaciones });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener notificaciones.' });
  }
}

async function contarNoLeidas(req, res) {
  try {
    const count = await Notificacion.countDocuments({ id_usuario: req.usuario.id, leida: false });
    return res.json({ success: true, count });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al contar notificaciones.' });
  }
}

async function marcarLeida(req, res) {
  try {
    await Notificacion.updateOne(
      { id_notificacion: parseInt(req.params.id), id_usuario: req.usuario.id },
      { $set: { leida: true } }
    );
    return res.json({ success: true, message: 'Notificación marcada como leída.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al actualizar notificación.' });
  }
}

async function marcarTodasLeidas(req, res) {
  try {
    await Notificacion.updateMany({ id_usuario: req.usuario.id }, { $set: { leida: true } });
    return res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al actualizar notificaciones.' });
  }
}

async function eliminarNotificacion(req, res) {
  try {
    await Notificacion.deleteOne({ id_notificacion: parseInt(req.params.id), id_usuario: req.usuario.id });
    return res.json({ success: true, message: 'Notificación eliminada.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al eliminar notificación.' });
  }
}

// ── Mensajes ──────────────────────────────────────────────────────────────────

async function listarConversaciones(req, res) {
  try {
    const userId = req.usuario.id;
    // Obtener todos los mensajes donde el usuario es remitente o destinatario
    const mensajes = await Mensaje.find({
      $or: [{ id_remitente: userId }, { id_destinatario: userId }]
    }).sort({ fecha_envio: -1 });

    // Agrupar por conversación
    const conversacionesMap = {};
    for (const msg of mensajes) {
      const convId = msg.id_conversacion || `${Math.min(msg.id_remitente, msg.id_destinatario)}-${Math.max(msg.id_remitente, msg.id_destinatario)}`;
      if (!conversacionesMap[convId]) {
        conversacionesMap[convId] = { id_conversacion: convId, ultimo_mensaje: msg, no_leidos: 0 };
      }
      if (!msg.leido && msg.id_destinatario === userId) {
        conversacionesMap[convId].no_leidos++;
      }
    }

    // Enriquecer con datos de usuario
    const conversaciones = Object.values(conversacionesMap);
    const otroUsuarioIds = conversaciones.map(c => {
      const msg = c.ultimo_mensaje;
      return msg.id_remitente === userId ? msg.id_destinatario : msg.id_remitente;
    });

    const usuarios = await fetchUsuariosBulk(otroUsuarioIds);
    const usuariosMap = Object.fromEntries(usuarios.map(u => [u.id_usuario, u]));

    const conversacionesEnriquecidas = conversaciones.map(c => {
      const msg = c.ultimo_mensaje;
      const otroId = msg.id_remitente === userId ? msg.id_destinatario : msg.id_remitente;
      return { ...c, otro_usuario: usuariosMap[otroId] || null };
    });

    return res.json({ success: true, conversaciones: conversacionesEnriquecidas });
  } catch (err) {
    console.error('[notificaciones-service] listarConversaciones:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener conversaciones.' });
  }
}

async function verConversacion(req, res) {
  try {
    const mensajes = await Mensaje.find({ id_conversacion: req.params.id }).sort({ fecha_envio: 1 });
    // Marcar como leídos
    await Mensaje.updateMany(
      { id_conversacion: req.params.id, id_destinatario: req.usuario.id },
      { $set: { leido: true } }
    );
    return res.json({ success: true, mensajes });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener mensajes.' });
  }
}

async function enviarMensaje(req, res) {
  try {
    const { id_destinatario, contenido } = req.body;
    if (!id_destinatario || !contenido) {
      return res.status(422).json({ success: false, message: 'Destinatario y contenido son obligatorios.' });
    }

    const userId = req.usuario.id;
    const destId = parseInt(id_destinatario);
    const convId = `${Math.min(userId, destId)}-${Math.max(userId, destId)}`;

    const nuevoId = await siguienteId(Mensaje, 'id_mensaje');
    const mensaje = new Mensaje({
      id_mensaje: nuevoId,
      id_remitente: userId,
      id_destinatario: destId,
      contenido: contenido.trim(),
      fecha_envio: new Date(),
      leido: false,
      id_conversacion: convId,
    });

    await mensaje.save();
    return res.status(201).json({ success: true, message: 'Mensaje enviado.', mensaje });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al enviar mensaje.' });
  }
}

async function obtenerUsuariosDisponibles(req, res) {
  try {
    const todos = await fetchTodosUsuarios();
    const usuarios = todos.filter(u => u.id_usuario !== req.usuario.id);
    return res.json({ success: true, usuarios });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener usuarios.' });
  }
}

module.exports = {
  crearNotificacionInterna,
  listarNotificaciones, contarNoLeidas, marcarLeida, marcarTodasLeidas, eliminarNotificacion,
  listarConversaciones, verConversacion, enviarMensaje, obtenerUsuariosDisponibles,
};

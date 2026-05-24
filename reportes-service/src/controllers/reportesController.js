const { Reporte } = require('../models/index');

const AUTH_URL     = process.env.AUTH_SERVICE_URL           || 'http://localhost:3001';
const NOTIF_URL    = process.env.NOTIFICACIONES_SERVICE_URL || 'http://localhost:3004';
const PROD_URL     = process.env.PRODUCTOS_SERVICE_URL      || 'http://localhost:3002';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY       || '';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function siguienteId(Model, campo) {
  const ultimo = await Model.findOne().sort({ [campo]: -1 });
  return ultimo ? (ultimo[campo] || 0) + 1 : 1;
}

async function enviarNotificacion(id_usuario, titulo, mensaje, tipo = 'reporte') {
  if (!id_usuario) return;
  try {
    await fetch(`${NOTIF_URL}/internal/notificaciones`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-service-key': INTERNAL_KEY },
      body:    JSON.stringify({ id_usuario, titulo, mensaje, tipo }),
      signal:  AbortSignal.timeout(4000),
    });
  } catch (err) {
    console.error('[reportes-service] Error enviando notificación:', err.message);
  }
}

async function getAdminIds() {
  try {
    const r = await fetch(`${AUTH_URL}/auth/internal/usuarios`, {
      headers: { 'x-service-key': INTERNAL_KEY },
      signal:  AbortSignal.timeout(4000),
    });
    const data = await r.json();
    return (data.usuarios || [])
      .filter(u => u.rol === 'administrador')
      .map(u => u.id_usuario);
  } catch {
    return [];
  }
}

/**
 * Obtiene el id_propietario de una tienda.
 */
async function getPropietarioTienda(id_tienda) {
  try {
    const r = await fetch(`${PROD_URL}/tiendas/${id_tienda}`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = await r.json();
    return data.tienda?.id_propietario || null;
  } catch (_) { return null; }
}

// ── Controladores ─────────────────────────────────────────────────────────────

/**
 * GET /reportes
 * Admin: todos. Emprendedor: enviados + recibidos. Otros: solo los propios.
 */
async function listarReportes(req, res) {
  try {
    let filtro;
    if (req.usuario.rol === 'administrador') {
      filtro = {};
    } else if (req.usuario.rol === 'emprendedor') {
      // El vendedor ve los que envió Y los que le dirigieron
      filtro = { $or: [
        { id_reportante:   req.usuario.id },
        { id_destinatario: req.usuario.id },
      ]};
    } else {
      filtro = { id_reportante: req.usuario.id };
    }
    const reportes = await Reporte.find(filtro).sort({ fecha_creacion: -1 });
    return res.json({ success: true, reportes });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener reportes.' });
  }
}

/**
 * POST /reportes
 */
async function crearReporte(req, res) {
  try {
    const { motivo, descripcion, id_tienda, nombre_tienda, tipo_destinatario } = req.body;
    if (!motivo) {
      return res.status(422).json({ success: false, message: 'El motivo es obligatorio.' });
    }

    const u         = req.usuario;
    const nuevoId   = await siguienteId(Reporte, 'id_reporte');
    const destTipo  = tipo_destinatario || 'admin'; // 'admin' | 'vendedor' | 'ambos'

    // Resolver id del propietario del vendedor si aplica
    let idPropietarioVendedor = null;
    let nombreTiendaFinal     = nombre_tienda || '';
    if ((destTipo === 'vendedor' || destTipo === 'ambos') && id_tienda) {
      idPropietarioVendedor = await getPropietarioTienda(parseInt(id_tienda));
    }

    const reporte = new Reporte({
      id_reporte:         nuevoId,
      id_reportante:      u.id,
      usuario_nombre:     `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.correo,
      rol_usuario:        u.rol,
      tipo_destinatario:  destTipo,
      id_tienda:          id_tienda   ? parseInt(id_tienda) : null,
      nombre_tienda:      nombreTiendaFinal,
      id_destinatario:    idPropietarioVendedor,
      motivo,
      descripcion:        descripcion || '',
      estado:             'pendiente',
      fecha_creacion:     new Date(),
    });
    await reporte.save();

    const nombreReportante = reporte.usuario_nombre || `Usuario #${u.id}`;
    const rolLabel = { comprador: 'Comprador', emprendedor: 'Vendedor', administrador: 'Admin' }[u.rol] || u.rol;
    const destLabel = nombreTiendaFinal ? `tienda "${nombreTiendaFinal}"` : 'la plataforma';

    // Notificar según destino
    if (destTipo === 'admin' || destTipo === 'ambos') {
      const adminIds = await getAdminIds();
      for (const adminId of adminIds) {
        await enviarNotificacion(
          adminId,
          '📋 Nuevo reporte recibido',
          `${nombreReportante} (${rolLabel}) reportó sobre ${destLabel}: "${motivo}".`,
          'reporte'
        );
      }
    }

    if ((destTipo === 'vendedor' || destTipo === 'ambos') && idPropietarioVendedor) {
      await enviarNotificacion(
        idPropietarioVendedor,
        '⚠️ Has recibido un reporte',
        `Un comprador ha enviado un reporte sobre tu tienda: "${motivo}". El equipo de EmprendeMarket revisará el caso.`,
        'reporte'
      );
    }

    return res.status(201).json({ success: true, message: 'Reporte enviado exitosamente.', reporte });
  } catch (err) {
    console.error('[reportes-service] crearReporte:', err);
    return res.status(500).json({ success: false, message: 'Error al crear el reporte.' });
  }
}

/**
 * POST /reportes/:id/estado
 * Admin: cambia estado y puede añadir respuesta.
 */
async function actualizarEstadoReporte(req, res) {
  try {
    if (req.usuario.rol !== 'administrador') {
      return res.status(403).json({ success: false, message: 'Acción no permitida.' });
    }
    const { estado, respuesta } = req.body;
    if (!estado) return res.status(422).json({ success: false, message: 'Estado requerido.' });

    const reporte = await Reporte.findOne({ id_reporte: parseInt(req.params.id) });
    if (!reporte) {
      return res.status(404).json({ success: false, message: 'Reporte no encontrado.' });
    }

    const update = { estado, fecha_actualizacion: new Date() };
    if (respuesta) update.respuesta_admin = respuesta;
    await Reporte.updateOne({ _id: reporte._id }, { $set: update });

    // Notificar al reportante
    const estadoTextos = {
      en_revision: 'en revisión — estamos investigando tu caso',
      atendido:    'atendido — se tomaron las medidas necesarias',
      cerrado:     'cerrado',
      rechazado:   'rechazado — no se encontraron incumplimientos',
    };
    const textoEstado = estadoTextos[estado] || estado;
    const respuestaMsg = respuesta ? ` Respuesta: "${respuesta}"` : '';

    await enviarNotificacion(
      reporte.id_reportante,
      '🔔 Actualización en tu reporte',
      `Tu reporte sobre "${reporte.motivo}" fue marcado como ${textoEstado}.${respuestaMsg}`,
      'reporte'
    );

    return res.json({ success: true, message: 'Estado del reporte actualizado.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al actualizar el reporte.' });
  }
}

module.exports = { listarReportes, crearReporte, actualizarEstadoReporte };

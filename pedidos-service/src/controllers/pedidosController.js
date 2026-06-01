const { Carrito, Pedido, DetallePedido, Direccion, MetodoPago } = require('../models/index');

const NOTIF_URL    = process.env.NOTIFICACIONES_SERVICE_URL || 'http://localhost:3004';
const PROD_URL     = process.env.PRODUCTOS_SERVICE_URL      || 'http://localhost:3002';
const AUTH_URL     = process.env.AUTH_SERVICE_URL           || 'http://localhost:3001';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY       || '';

// ── Helpers internos ──────────────────────────────────────────────────────────

async function fetchProductosBulk(ids) {
  try {
    const r = await fetch(`${PROD_URL}/internal/productos/bulk`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-service-key': INTERNAL_KEY },
      body:    JSON.stringify({ ids }),
      signal:  AbortSignal.timeout(5000),
    });
    const data = await r.json();
    return data.productos || [];
  } catch (_) { return []; }
}

async function reducirStockProductos(items) {
  try {
    await fetch(`${PROD_URL}/internal/stock/reducir`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-service-key': INTERNAL_KEY },
      body:    JSON.stringify({ items }),
      signal:  AbortSignal.timeout(5000),
    });
  } catch (_) { /* No bloquea el flujo */ }
}

/**
 * Envía una notificación a un usuario.
 */
async function notificar(id_usuario, titulo, mensaje, tipo = 'pedido') {
  if (!id_usuario) return;
  try {
    await fetch(`${NOTIF_URL}/internal/notificaciones`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-service-key': INTERNAL_KEY },
      body:    JSON.stringify({ id_usuario, titulo, mensaje, tipo }),
      signal:  AbortSignal.timeout(4000),
    });
  } catch (_) { /* No bloquea el flujo principal */ }
}

/**
 * Obtiene el id_propietario de una tienda desde productos-service.
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

async function siguienteId(Model, campo) {
  const ultimo = await Model.findOne().sort({ [campo]: -1 });
  return ultimo ? (ultimo[campo] || 0) + 1 : 1;
}

const ESTADO_LABEL = {
  procesando: 'en preparación',
  enviado:    'enviado',
  entregado:  'entregado',
  cancelado:  'cancelado',
};

// ── Checkout ──────────────────────────────────────────────────────────────────

/**
 * POST /checkout/procesar
 */
async function procesarPago(req, res) {
  try {
    const { direccion_envio, telefono, metodo_pago, transaccion_id } = req.body;

    if (!direccion_envio || !metodo_pago) {
      return res.status(422).json({ success: false, message: 'Dirección y método de pago son obligatorios.' });
    }

    const items = await Carrito.find({ id_usuario: req.usuario.id });
    if (!items.length) return res.status(400).json({ success: false, message: 'El carrito está vacío.' });

    const productoIds = items.map(i => i.id_producto);
    const productos   = await fetchProductosBulk(productoIds);
    const productosMap = Object.fromEntries(productos.map(p => [String(p.id_producto), p]));

    let subtotal = 0;
    const detalles = items.map(item => {
      const prod   = productosMap[String(item.id_producto)];
      const precio = prod ? prod.precio : (item.precio_unitario || 0);
      const sub    = precio * item.cantidad;
      subtotal += sub;
      return {
        id_producto:     item.id_producto,
        nombre_producto: prod ? prod.nombre_producto : 'Producto',
        imagen_url:      prod?.imagen_url || '',
        id_tienda:       prod?.tienda?.id_tienda    || null,
        nombre_tienda:   prod?.tienda?.nombre_tienda || '',
        cantidad:        item.cantidad,
        talla:           item.talla || null,
        precio_unitario: precio,
        subtotal:        sub,
      };
    });

    const costoEnvio = subtotal > 100000 ? 0 : 8000;
    const total      = subtotal + costoEnvio;

    const nuevoId = await siguienteId(Pedido, 'id_pedido');
    const pedido  = new Pedido({
      id_pedido:      nuevoId,
      id_comprador:   req.usuario.id,
      nombre_comprador: `${req.usuario.nombre || ''} ${req.usuario.apellido || ''}`.trim(),
      fecha_pedido:   new Date(),
      total, subtotal,
      envio:          costoEnvio,
      direccion_envio,
      telefono:       telefono || '',
      estado:         'pendiente',
      metodo_pago,
      transaccion_id: transaccion_id || `TXN-${Date.now()}`,
      detalles,
    });

    await pedido.save();
    await reducirStockProductos(items.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad })));
    await Carrito.deleteMany({ id_usuario: req.usuario.id });

    // Notificar al comprador
    notificar(
      req.usuario.id,
      '🎉 ¡Pedido confirmado!',
      `Tu pedido #${pedido.id_pedido} fue recibido. Total: $${total.toLocaleString('es-CO')}. Estado: pendiente.`,
      'pedido'
    );

    // Notificar a los vendedores involucrados (agrupado por tienda)
    const tiendasNotificadas = new Set();
    for (const det of detalles) {
      if (det.id_tienda && !tiendasNotificadas.has(det.id_tienda)) {
        tiendasNotificadas.add(det.id_tienda);
        const idPropietario = await getPropietarioTienda(det.id_tienda);
        if (idPropietario) {
          notificar(
            idPropietario,
            '📦 Nuevo pedido recibido',
            `Tienes un nuevo pedido #${pedido.id_pedido} de ${pedido.nombre_comprador || 'un comprador'}. Total: $${total.toLocaleString('es-CO')}.`,
            'pedido'
          );
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: '¡Pedido realizado exitosamente!',
      pedido:  { id_pedido: pedido.id_pedido, total, estado: 'pendiente' },
    });
  } catch (err) {
    console.error('[pedidos-service] procesarPago:', err);
    return res.status(500).json({ success: false, message: 'Error al procesar el pago.' });
  }
}

// ── Comprador ─────────────────────────────────────────────────────────────────

async function listarPedidosComprador(req, res) {
  try {
    const pedidos = await Pedido.find({ id_comprador: req.usuario.id }).sort({ fecha_pedido: -1 });
    return res.json({ success: true, pedidos });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener pedidos.' });
  }
}

async function verPedidoComprador(req, res) {
  try {
    const pedido = await Pedido.findOne({ id_pedido: parseInt(req.params.id), id_comprador: req.usuario.id });
    if (!pedido) return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
    return res.json({ success: true, pedido });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener el pedido.' });
  }
}

async function marcarRecibido(req, res) {
  try {
    const pedido = await Pedido.findOne({ id_pedido: parseInt(req.params.id), id_comprador: req.usuario.id });
    if (!pedido) return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });

    await Pedido.updateOne({ _id: pedido._id }, { $set: { estado: 'entregado', fecha_recibido: new Date() } });

    // Notificar a los vendedores del pedido
    const tiendasNotificadas = new Set();
    for (const det of (pedido.detalles || [])) {
      if (det.id_tienda && !tiendasNotificadas.has(det.id_tienda)) {
        tiendasNotificadas.add(det.id_tienda);
        const idPropietario = await getPropietarioTienda(det.id_tienda);
        if (idPropietario) {
          notificar(
            idPropietario,
            '✅ Pedido entregado confirmado',
            `El comprador confirmó haber recibido el pedido #${pedido.id_pedido}. ¡Venta completada!`,
            'pedido'
          );
        }
      }
    }

    // Notificar al comprador
    notificar(
      req.usuario.id,
      '🎉 ¡Gracias por tu compra!',
      `Confirmaste la recepción del pedido #${pedido.id_pedido}. ¡No olvides dejar una reseña!`,
      'pedido'
    );

    return res.json({
      success:  true,
      message:  '¡Pedido recibido! Puedes dejar una reseña ahora.',
      detalles: pedido.detalles || [],
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al actualizar el pedido.' });
  }
}

/**
 * GET /comprador/mis-vendedores
 * Devuelve las tiendas únicas de los pedidos del comprador (para el formulario de reportes).
 */
async function getMisVendedores(req, res) {
  try {
    const pedidos = await Pedido.find({ id_comprador: req.usuario.id });
    const tiendasMap = {};
    const productoIdsFallback = [];

    for (const ped of pedidos) {
      for (const det of (ped.detalles || [])) {
        if (det.id_tienda) {
          if (!tiendasMap[det.id_tienda]) {
            tiendasMap[det.id_tienda] = {
              id_tienda:     det.id_tienda,
              nombre_tienda: det.nombre_tienda || `Tienda #${det.id_tienda}`,
            };
          }
        } else if (det.id_producto) {
          productoIdsFallback.push(det.id_producto);
        }
      }
    }

    // Para pedidos viejos sin id_tienda, buscar la tienda desde productos-service
    if (productoIdsFallback.length > 0) {
      const prods = await fetchProductosBulk([...new Set(productoIdsFallback)]);
      for (const prod of prods) {
        const tid = prod.id_tienda;
        if (tid && !tiendasMap[tid]) {
          tiendasMap[tid] = {
            id_tienda:     tid,
            nombre_tienda: prod.tienda?.nombre_tienda || `Tienda #${tid}`,
          };
        }
      }
    }

    return res.json({ success: true, vendedores: Object.values(tiendasMap) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener vendedores.' });
  }
}

// ── Vendedor ──────────────────────────────────────────────────────────────────

async function listarPedidosVendedor(req, res) {
  try {
    const pedidos = await Pedido.find().sort({ fecha_pedido: -1 });
    return res.json({ success: true, pedidos });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener pedidos.' });
  }
}

async function procesarPedidoVendedor(req, res) {
  try {
    const pedido = await Pedido.findOne({ id_pedido: parseInt(req.params.id) });
    if (!pedido) return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });

    await Pedido.updateOne({ _id: pedido._id }, { $set: { estado: 'procesando' } });

    // Notificar al comprador
    notificar(
      pedido.id_comprador,
      '🔄 Pedido en preparación',
      `Tu pedido #${pedido.id_pedido} está siendo preparado por el vendedor. ¡Pronto llegará a ti!`,
      'pedido'
    );

    return res.json({ success: true, message: 'Pedido en procesamiento.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al procesar el pedido.' });
  }
}

async function marcarEnviado(req, res) {
  try {
    const { numero_guia } = req.body;
    const pedido = await Pedido.findOne({ id_pedido: parseInt(req.params.id) });
    if (!pedido) return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });

    await Pedido.updateOne({ _id: pedido._id }, { $set: { estado: 'enviado', numero_guia: numero_guia || '' } });

    // Notificar al comprador
    const guiaMsg = numero_guia ? ` Número de guía: ${numero_guia}.` : '';
    notificar(
      pedido.id_comprador,
      '🚚 ¡Tu pedido fue enviado!',
      `Tu pedido #${pedido.id_pedido} está en camino.${guiaMsg} Estará llegando pronto.`,
      'pedido'
    );

    return res.json({ success: true, message: 'Pedido marcado como enviado.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al actualizar el pedido.' });
  }
}

// ── Direcciones ───────────────────────────────────────────────────────────────

async function listarDirecciones(req, res) {
  try {
    const direcciones = await Direccion.find({ id_usuario: req.usuario.id });
    return res.json({ success: true, direcciones });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener direcciones.' });
  }
}

async function crearDireccion(req, res) {
  try {
    const nuevoId = await siguienteId(Direccion, 'id_direccion');
    const dir = new Direccion({ id_direccion: nuevoId, id_usuario: req.usuario.id, ...req.body });
    await dir.save();
    return res.status(201).json({ success: true, message: 'Dirección creada.', direccion: dir });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al crear dirección.' });
  }
}

async function eliminarDireccion(req, res) {
  try {
    await Direccion.deleteOne({ id_direccion: parseInt(req.params.id), id_usuario: req.usuario.id });
    return res.json({ success: true, message: 'Dirección eliminada.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al eliminar dirección.' });
  }
}

// ── Métodos de pago ───────────────────────────────────────────────────────────

async function listarMetodosPago(req, res) {
  try {
    const metodos = await MetodoPago.find({ id_usuario: req.usuario.id });
    const metodosSeguros = metodos.map(m => ({
      ...m.toObject(),
      numero_tarjeta: m.numero_tarjeta ? `****${m.numero_tarjeta.slice(-4)}` : null,
    }));
    return res.json({ success: true, metodos: metodosSeguros });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener métodos de pago.' });
  }
}

async function crearMetodoPago(req, res) {
  try {
    const nuevoId = await siguienteId(MetodoPago, 'id_metodo');
    const metodo = new MetodoPago({ id_metodo: nuevoId, id_usuario: req.usuario.id, ...req.body });
    await metodo.save();
    return res.status(201).json({ success: true, message: 'Método de pago agregado.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al crear método de pago.' });
  }
}

async function eliminarMetodoPago(req, res) {
  try {
    await MetodoPago.deleteOne({ id_metodo: parseInt(req.params.id), id_usuario: req.usuario.id });
    return res.json({ success: true, message: 'Método de pago eliminado.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al eliminar método de pago.' });
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

async function adminListarPedidos(req, res) {
  try {
    const pedidos = await Pedido.find().sort({ fecha_pedido: -1 });
    return res.json({ success: true, pedidos });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener pedidos.' });
  }
}

module.exports = {
  procesarPago,
  listarPedidosComprador, verPedidoComprador, marcarRecibido, getMisVendedores,
  listarPedidosVendedor, procesarPedidoVendedor, marcarEnviado,
  listarDirecciones, crearDireccion, eliminarDireccion,
  listarMetodosPago, crearMetodoPago, eliminarMetodoPago,
  adminListarPedidos,
};

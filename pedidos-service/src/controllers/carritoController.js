const { Carrito } = require('../models/index');

const PROD_URL = process.env.PRODUCTOS_SERVICE_URL || 'http://localhost:3002';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '';

async function fetchProductosBulk(ids) {
  const r = await fetch(`${PROD_URL}/internal/productos/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-service-key': INTERNAL_KEY },
    body: JSON.stringify({ ids }),
    signal: AbortSignal.timeout(5000),
  });
  const data = await r.json();
  return data.productos || [];
}

async function fetchProducto(id) {
  const productos = await fetchProductosBulk([id]);
  return productos[0] || null;
}

async function siguienteId(Model, campo) {
  const ultimo = await Model.findOne().sort({ [campo]: -1 });
  return ultimo ? (ultimo[campo] || 0) + 1 : 1;
}

/**
 * GET /carrito
 */
async function obtenerCarrito(req, res) {
  try {
    const items = await Carrito.find({ id_usuario: req.usuario.id });
    const productoIds = items.map(i => i.id_producto);
    const productos = productoIds.length ? await fetchProductosBulk(productoIds) : [];
    const productosMap = Object.fromEntries(productos.map(p => [p.id_producto, p]));

    const itemsEnriquecidos = items.map(item => ({
      ...item.toObject(),
      producto: productosMap[item.id_producto] || null,
      subtotal: (item.precio_unitario || 0) * (item.cantidad || 1),
    }));

    const total = itemsEnriquecidos.reduce((sum, i) => sum + i.subtotal, 0);
    return res.json({ success: true, items: itemsEnriquecidos, total, cantidad: items.length });
  } catch (err) {
    console.error('[pedidos-service] obtenerCarrito:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener el carrito.' });
  }
}

/**
 * POST /carrito/agregar
 */
async function agregarAlCarrito(req, res) {
  try {
    const { id_producto, cantidad = 1, talla } = req.body;
    if (!id_producto) return res.status(422).json({ success: false, message: 'id_producto es requerido.' });

    const producto = await fetchProducto(parseInt(id_producto));
    if (!producto) return res.status(404).json({ success: false, message: 'Producto no encontrado.' });

    const estadoProd = (producto.estado || '').toLowerCase();
    if (!['activo', 'disponible'].includes(estadoProd)) {
      return res.status(400).json({ success: false, message: 'El producto no está disponible.' });
    }

    // Buscar item existente (misma talla si aplica)
    const filtroExistente = { id_usuario: req.usuario.id, id_producto: parseInt(id_producto) };
    if (talla) filtroExistente.talla = talla;
    const itemExistente = await Carrito.findOne(filtroExistente);
    if (itemExistente) {
      const nuevaCantidad = itemExistente.cantidad + parseInt(cantidad);
      await Carrito.updateOne({ _id: itemExistente._id }, { $set: { cantidad: nuevaCantidad } });
      return res.json({ success: true, message: 'Cantidad actualizada en el carrito.' });
    }

    const nuevoId = await siguienteId(Carrito, 'id_carrito');
    await new Carrito({
      id_carrito:      nuevoId,
      id_usuario:      req.usuario.id,
      id_producto:     parseInt(id_producto),
      cantidad:        parseInt(cantidad),
      precio_unitario: producto.precio,
      talla:           talla || null,
      fecha_agregado:  new Date(),
    }).save();

    return res.status(201).json({ success: true, message: 'Producto agregado al carrito.' });
  } catch (err) {
    console.error('[pedidos-service] agregarAlCarrito:', err);
    return res.status(500).json({ success: false, message: 'Error al agregar al carrito.' });
  }
}

/**
 * PUT /carrito/:id
 */
async function actualizarCarrito(req, res) {
  try {
    const { cantidad } = req.body;
    if (!cantidad || parseInt(cantidad) < 1) {
      return res.status(422).json({ success: false, message: 'La cantidad debe ser mayor a 0.' });
    }

    const item = await Carrito.findOne({ id_carrito: parseInt(req.params.id), id_usuario: req.usuario.id });
    if (!item) return res.status(404).json({ success: false, message: 'Item no encontrado en el carrito.' });

    await Carrito.updateOne({ _id: item._id }, { $set: { cantidad: parseInt(cantidad) } });
    return res.json({ success: true, message: 'Carrito actualizado.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al actualizar el carrito.' });
  }
}

/**
 * DELETE /carrito/:id
 */
async function eliminarDelCarrito(req, res) {
  try {
    await Carrito.deleteOne({ id_carrito: parseInt(req.params.id), id_usuario: req.usuario.id });
    return res.json({ success: true, message: 'Producto eliminado del carrito.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al eliminar del carrito.' });
  }
}

/**
 * DELETE /carrito
 */
async function vaciarCarrito(req, res) {
  try {
    await Carrito.deleteMany({ id_usuario: req.usuario.id });
    return res.json({ success: true, message: 'Carrito vaciado.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al vaciar el carrito.' });
  }
}

module.exports = { obtenerCarrito, agregarAlCarrito, actualizarCarrito, eliminarDelCarrito, vaciarCarrito };

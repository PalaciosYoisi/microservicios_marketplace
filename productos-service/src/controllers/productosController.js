const { Producto, Tienda, ProductoImagen, Resena, Favorito, Promocion } = require('../models/index');

const AUTH_URL   = process.env.AUTH_SERVICE_URL           || 'http://localhost:3001';
const NOTIF_URL  = process.env.NOTIFICACIONES_SERVICE_URL || 'http://localhost:3004';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY     || '';

async function enviarNotificacion(id_usuario, titulo, mensaje, tipo = 'tienda') {
  try {
    await fetch(`${NOTIF_URL}/internal/notificaciones`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-service-key': INTERNAL_KEY },
      body:    JSON.stringify({ id_usuario, titulo, mensaje, tipo }),
      signal:  AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.error('[productos-service] Error enviando notificación:', err.message);
  }
}

async function fetchUsuariosBulk(ids) {
  try {
    const r = await fetch(`${AUTH_URL}/auth/internal/usuarios/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-service-key': INTERNAL_KEY },
      body: JSON.stringify({ ids }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await r.json();
    return data.usuarios || [];
  } catch (_) { return []; }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function buscarProducto(id) {
  const numId = parseInt(id);
  return await Producto.findOne({ $or: [{ id_producto: numId }, { id_producto: String(id) }] });
}

async function siguienteId(Model, campo) {
  const ultimo = await Model.findOne().sort({ [campo]: -1 });
  return ultimo ? (ultimo[campo] || 0) + 1 : 1;
}

// ── Marketplace público ───────────────────────────────────────────────────────

/**
 * GET /productos
 * Lista productos activos con filtros opcionales
 */
async function listarProductos(req, res) {
  try {
    const { categoria, buscar, tienda, pagina = 1, limite = 12 } = req.query;
    const filtro = { estado: { $in: ['activo', 'Activo', 'disponible'] } };

    if (categoria) filtro.categoria = { $regex: categoria, $options: 'i' };
    if (buscar) filtro.nombre_producto = { $regex: buscar, $options: 'i' };
    if (tienda) filtro.id_tienda = parseInt(tienda);

    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    const [productos, total] = await Promise.all([
      Producto.find(filtro).skip(skip).limit(parseInt(limite)).sort({ fecha_publicacion: -1 }),
      Producto.countDocuments(filtro),
    ]);

    // Enriquecer con datos de tienda
    const tiendaIds = [...new Set(productos.map(p => p.id_tienda))];
    const tiendas = await Tienda.find({ id_tienda: { $in: tiendaIds } });
    const tiendasMap = Object.fromEntries(tiendas.map(t => [t.id_tienda, t]));

    const productosEnriquecidos = productos.map(p => ({
      ...p.toObject(),
      tienda: tiendasMap[p.id_tienda] || null,
    }));

    return res.json({
      success: true,
      productos: productosEnriquecidos,
      paginacion: { total, pagina: parseInt(pagina), limite: parseInt(limite), paginas: Math.ceil(total / parseInt(limite)) },
    });
  } catch (err) {
    console.error('[productos-service] listarProductos:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener productos.' });
  }
}

/**
 * GET /productos/:id
 * Detalle de un producto
 */
async function verProducto(req, res) {
  try {
    const producto = await buscarProducto(req.params.id);
    if (!producto) return res.status(404).json({ success: false, message: 'Producto no encontrado.' });

    const [tienda, imagenes, resenas] = await Promise.all([
      Tienda.findOne({ id_tienda: producto.id_tienda }),
      ProductoImagen.find({ id_producto: producto.id_producto }),
      Resena.find({ id_producto: producto.id_producto, estado: { $in: ['aprobada', 'activa', 'Aprobada'] } }).sort({ fecha_resena: -1 }).limit(10),
    ]);

    // Calcular calificación promedio
    const calificacionPromedio = resenas.length
      ? (resenas.reduce((sum, r) => sum + (r.calificacion || 0), 0) / resenas.length).toFixed(1)
      : 0;

    return res.json({
      success: true,
      producto: { ...producto.toObject(), tienda, imagenes, resenas, calificacion_promedio: parseFloat(calificacionPromedio) },
    });
  } catch (err) {
    console.error('[productos-service] verProducto:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener el producto.' });
  }
}

// ── Tiendas ───────────────────────────────────────────────────────────────────

/**
 * GET /tiendas
 */
async function listarTiendas(req, res) {
  try {
    const tiendas = await Tienda.find({ estado: { $in: ['activa', 'Activa', 'activo'] } }).sort({ fecha_creacion: -1 });
    return res.json({ success: true, tiendas });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener tiendas.' });
  }
}

/**
 * GET /tiendas/:id
 */
async function verTienda(req, res) {
  try {
    const tienda = await Tienda.findOne({ id_tienda: parseInt(req.params.id) });
    if (!tienda) return res.status(404).json({ success: false, message: 'Tienda no encontrada.' });

    const productos = await Producto.find({ id_tienda: tienda.id_tienda, estado: { $in: ['activo', 'Activo'] } });
    return res.json({ success: true, tienda: { ...tienda.toObject(), productos } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener la tienda.' });
  }
}

/**
 * POST /tiendas
 * Crear tienda (solo emprendedores)
 */
async function crearTienda(req, res) {
  try {
    const { nombre_tienda, descripcion, categoria, horario_atencion, telefono_contacto } = req.body;

    if (!nombre_tienda) return res.status(422).json({ success: false, message: 'El nombre de la tienda es obligatorio.' });

    // Verificar que no tenga tienda ya
    const tiendaExistente = await Tienda.findOne({ id_propietario: req.usuario.id });
    if (tiendaExistente) return res.status(409).json({ success: false, message: 'Ya tienes una tienda registrada.' });

    const nuevoId = await siguienteId(Tienda, 'id_tienda');

    const tienda = new Tienda({
      id_tienda: nuevoId,
      id_propietario: req.usuario.id,
      nombre_tienda: nombre_tienda.trim(),
      descripcion: descripcion || '',
      categoria: categoria || 'General',
      fecha_creacion: new Date(),
      estado: 'pendiente',
      horario_atencion: horario_atencion || '',
      telefono_contacto: telefono_contacto || '',
    });

    await tienda.save();
    return res.status(201).json({ success: true, message: 'Tienda creada exitosamente. Pendiente de aprobación.', tienda });
  } catch (err) {
    console.error('[productos-service] crearTienda:', err);
    return res.status(500).json({ success: false, message: 'Error al crear la tienda.' });
  }
}

// ── Gestión de productos (vendedor) ──────────────────────────────────────────

/**
 * GET /vendedor/productos
 */
async function listarProductosVendedor(req, res) {
  try {
    const tienda = await Tienda.findOne({ id_propietario: req.usuario.id });
    if (!tienda) return res.json({ success: true, productos: [], tienda: null });

    const productos = await Producto.find({ id_tienda: tienda.id_tienda }).sort({ fecha_publicacion: -1 });
    return res.json({ success: true, productos, tienda });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener productos.' });
  }
}

/**
 * POST /vendedor/productos
 */
async function crearProducto(req, res) {
  try {
    const tienda = await Tienda.findOne({ id_propietario: req.usuario.id });
    if (!tienda) return res.status(404).json({ success: false, message: 'No tienes una tienda registrada.' });

    const estadoTienda = (tienda.estado || '').toLowerCase();
    if (!['activa', 'activo'].includes(estadoTienda)) {
      return res.status(403).json({ success: false, message: 'Tu tienda debe estar aprobada para publicar productos.' });
    }

    const { nombre_producto, descripcion, precio, stock, categoria, imagen_url, tallas } = req.body;
    if (!nombre_producto || precio === undefined || precio === null || precio === '') {
      return res.status(422).json({ success: false, message: 'Nombre y precio son obligatorios.' });
    }

    const nuevoId = await siguienteId(Producto, 'id_producto');

    const producto = new Producto({
      id_producto:       nuevoId,
      id_tienda:         tienda.id_tienda,
      nombre_producto:   nombre_producto.trim(),
      descripcion:       descripcion || '',
      precio:            parseFloat(precio),
      stock:             parseInt(stock) || 0,
      categoria:         categoria || 'General',
      tallas:            Array.isArray(tallas) ? tallas : [],
      fecha_publicacion: new Date(),
      estado:            'activo',
      imagen_url:        imagen_url || '',
    });

    await producto.save();
    return res.status(201).json({ success: true, message: 'Producto creado exitosamente.', producto });
  } catch (err) {
    console.error('[productos-service] crearProducto:', err);
    return res.status(500).json({ success: false, message: 'Error al crear el producto.' });
  }
}

/**
 * PUT /vendedor/productos/:id
 */
async function actualizarProducto(req, res) {
  try {
    const tienda = await Tienda.findOne({ id_propietario: req.usuario.id });
    if (!tienda) return res.status(404).json({ success: false, message: 'Tienda no encontrada.' });

    const producto = await buscarProducto(req.params.id);
    if (!producto || String(producto.id_tienda) !== String(tienda.id_tienda)) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado o no pertenece a tu tienda.' });
    }

    const { nombre_producto, descripcion, precio, stock, categoria, imagen_url, tallas } = req.body;
    const actualizacion = {};
    if (nombre_producto) actualizacion.nombre_producto = nombre_producto.trim();
    if (descripcion !== undefined) actualizacion.descripcion = descripcion;
    if (precio !== undefined && precio !== '') actualizacion.precio = parseFloat(precio);
    if (stock !== undefined) actualizacion.stock = parseInt(stock);
    if (categoria) actualizacion.categoria = categoria;
    if (imagen_url !== undefined) actualizacion.imagen_url = imagen_url;
    if (tallas !== undefined) actualizacion.tallas = Array.isArray(tallas) ? tallas : [];

    await Producto.updateOne({ _id: producto._id }, { $set: actualizacion });
    return res.json({ success: true, message: 'Producto actualizado exitosamente.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al actualizar el producto.' });
  }
}

/**
 * DELETE /vendedor/productos/:id
 */
async function eliminarProducto(req, res) {
  try {
    const tienda = await Tienda.findOne({ id_propietario: req.usuario.id });
    if (!tienda) return res.status(404).json({ success: false, message: 'Tienda no encontrada.' });

    const producto = await buscarProducto(req.params.id);
    if (!producto || producto.id_tienda !== tienda.id_tienda) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    }

    await Producto.updateOne({ _id: producto._id }, { $set: { estado: 'inactivo' } });
    return res.json({ success: true, message: 'Producto eliminado exitosamente.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al eliminar el producto.' });
  }
}

/**
 * POST /vendedor/productos/:id/reponer-stock
 */
async function reponerStock(req, res) {
  try {
    const tienda = await Tienda.findOne({ id_propietario: req.usuario.id });
    const producto = await buscarProducto(req.params.id);
    if (!producto || String(producto.id_tienda) !== String(tienda?.id_tienda)) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    }

    const cantidad = parseInt(req.body.cantidad) || 0;
    await Producto.updateOne({ _id: producto._id }, { $inc: { stock: cantidad } });
    return res.json({ success: true, message: `Stock actualizado. Nuevo stock: ${producto.stock + cantidad}` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al reponer stock.' });
  }
}

// ── Favoritos ─────────────────────────────────────────────────────────────────

async function listarFavoritos(req, res) {
  try {
    const favoritos = await Favorito.find({ id_usuario: req.usuario.id });
    const productoIds = favoritos.map(f => f.id_producto);
    const productos = await Producto.find({ id_producto: { $in: productoIds } });
    return res.json({ success: true, favoritos: productos });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener favoritos.' });
  }
}

async function agregarFavorito(req, res) {
  try {
    const { id_producto } = req.body;
    const existe = await Favorito.findOne({ id_usuario: req.usuario.id, id_producto: parseInt(id_producto) });
    if (existe) return res.status(409).json({ success: false, message: 'El producto ya está en favoritos.' });

    const nuevoId = await siguienteId(Favorito, 'id_favorito');
    await new Favorito({ id_favorito: nuevoId, id_usuario: req.usuario.id, id_producto: parseInt(id_producto), fecha_agregado: new Date() }).save();
    return res.status(201).json({ success: true, message: 'Producto agregado a favoritos.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al agregar favorito.' });
  }
}

async function eliminarFavorito(req, res) {
  try {
    await Favorito.deleteOne({ id_usuario: req.usuario.id, id_producto: parseInt(req.params.id) });
    return res.json({ success: true, message: 'Producto eliminado de favoritos.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al eliminar favorito.' });
  }
}

// ── Reseñas ───────────────────────────────────────────────────────────────────

async function crearResena(req, res) {
  try {
    const { id_producto, calificacion, comentario, foto_url } = req.body;
    if (!id_producto || !calificacion) {
      return res.status(422).json({ success: false, message: 'Producto y calificación son obligatorios.' });
    }

    const nuevoId = await siguienteId(Resena, 'id_resena');
    const nombreComprador = req.usuario.nombre
      ? `${req.usuario.nombre} ${req.usuario.apellido || ''}`.trim()
      : `Comprador #${req.usuario.id}`;

    const resena = new Resena({
      id_resena:        nuevoId,
      id_producto:      parseInt(id_producto),
      id_comprador:     req.usuario.id,
      nombre_comprador: nombreComprador,
      calificacion:     parseInt(calificacion),
      comentario:       comentario || '',
      foto_url:         foto_url   || '',
      fecha_resena:     new Date(),
      estado:           'aprobada',
    });
    await resena.save();
    return res.status(201).json({ success: true, message: 'Reseña enviada exitosamente. ¡Gracias!', resena });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al crear la reseña.' });
  }
}

/**
 * POST /resenas/upload-foto
 * Sube foto de reseña y devuelve la URL.
 */
async function subirFotoResena(req, res) {
  try {
    if (!req.file) return res.status(422).json({ success: false, message: 'No se recibió ningún archivo.' });
    const url = `/uploads/resenas/${req.file.filename}`;
    return res.json({ success: true, url });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al subir la foto.' });
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

async function adminListarTiendas(req, res) {
  try {
    const tiendas = await Tienda.find().sort({ fecha_creacion: -1 });
    const propietarioIds = [...new Set(tiendas.map(t => t.id_propietario))];
    const usuarios = await fetchUsuariosBulk(propietarioIds);
    const usuariosMap = Object.fromEntries(usuarios.map(u => [u.id_usuario, u]));

    const tiendasEnriquecidas = tiendas.map(t => ({
      ...t.toObject(),
      propietario: usuariosMap[t.id_propietario] || null,
    }));
    return res.json({ success: true, tiendas: tiendasEnriquecidas });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener tiendas.' });
  }
}

async function adminCambiarEstadoTienda(req, res) {
  try {
    const { estado } = req.body;
    const tienda = await Tienda.findOne({ id_tienda: parseInt(req.params.id) });
    if (!tienda) return res.status(404).json({ success: false, message: 'Tienda no encontrada.' });

    await Tienda.updateOne({ _id: tienda._id }, { $set: { estado } });

    // Notificar al propietario de la tienda
    const mensajesEstado = {
      activa:     { titulo: '✅ ¡Tu tienda fue aprobada!',   mensaje: `Tu tienda "${tienda.nombre_tienda}" ha sido aprobada. Ya puedes publicar productos.` },
      rechazada:  { titulo: '❌ Tu tienda fue rechazada',    mensaje: `Tu tienda "${tienda.nombre_tienda}" ha sido rechazada. Contacta al administrador para más información.` },
      suspendida: { titulo: '⚠️ Tu tienda fue suspendida',  mensaje: `Tu tienda "${tienda.nombre_tienda}" ha sido suspendida. Contacta al administrador.` },
    };
    const notif = mensajesEstado[estado];
    if (notif) {
      await enviarNotificacion(tienda.id_propietario, notif.titulo, notif.mensaje, 'tienda');
    }

    return res.json({ success: true, message: `Tienda ${estado} exitosamente.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al cambiar estado de la tienda.' });
  }
}

async function adminListarProductos(req, res) {
  try {
    const productos = await Producto.find().sort({ fecha_publicacion: -1 });
    return res.json({ success: true, productos });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener productos.' });
  }
}

async function adminDesactivarProducto(req, res) {
  try {
    const producto = await buscarProducto(req.params.id);
    if (!producto) return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    await Producto.updateOne({ _id: producto._id }, { $set: { estado: 'inactivo' } });
    return res.json({ success: true, message: 'Producto desactivado.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al desactivar producto.' });
  }
}

// ── Upload de imágenes de producto ───────────────────────────────────────────

async function subirImagenProducto(req, res) {
  try {
    if (!req.file) return res.status(422).json({ success: false, message: 'No se recibió ningún archivo.' });
    const url = `/uploads/productos/${req.file.filename}`;
    return res.json({ success: true, url });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al subir la imagen.' });
  }
}

// ── Endpoints internos (servicio a servicio) ──────────────────────────────────

function validarClaveInterna(req, res) {
  const key = req.headers['x-service-key'];
  if (!key || key !== process.env.INTERNAL_SERVICE_KEY) {
    res.status(401).json({ success: false, message: 'No autorizado.' });
    return false;
  }
  return true;
}

async function obtenerProductosBulk(req, res) {
  if (!validarClaveInterna(req, res)) return;
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(422).json({ success: false, message: 'ids debe ser un arreglo.' });
    const productos = await Producto.find({ id_producto: { $in: ids.map(Number) } });
    return res.json({ success: true, productos });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
}

async function reducirStock(req, res) {
  if (!validarClaveInterna(req, res)) return;
  try {
    const { items } = req.body; // [{ id_producto, cantidad }]
    if (!Array.isArray(items)) return res.status(422).json({ success: false, message: 'items debe ser un arreglo.' });
    for (const item of items) {
      await Producto.updateOne({ id_producto: Number(item.id_producto) }, { $inc: { stock: -Number(item.cantidad) } });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al reducir stock.' });
  }
}

module.exports = {
  listarProductos, verProducto,
  listarTiendas, verTienda, crearTienda,
  listarProductosVendedor, crearProducto, actualizarProducto, eliminarProducto, reponerStock,
  listarFavoritos, agregarFavorito, eliminarFavorito,
  crearResena, subirFotoResena,
  adminListarTiendas, adminCambiarEstadoTienda, adminListarProductos, adminDesactivarProducto,
  subirImagenProducto,
  obtenerProductosBulk, reducirStock,
};

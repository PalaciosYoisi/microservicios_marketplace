const mongoose = require('mongoose');

const carritoSchema = new mongoose.Schema({
  id_carrito: Number,
  id_usuario: Number,
  id_producto: Number,
  cantidad: Number,
  precio_unitario: Number,
  fecha_agregado: Date,
}, { collection: 'carrito', strict: false, timestamps: false });

const pedidoSchema = new mongoose.Schema({
  id_pedido: Number,
  id_comprador: Number,
  fecha_pedido: Date,
  fecha_recibido: Date,
  total: Number,
  subtotal: Number,
  envio: Number,
  direccion_envio: String,
  telefono: String,
  estado: String,
  metodo_pago: String,
  transaccion_id: String,
  numero_guia: String,
  detalles: Array,
}, { collection: 'pedidos', strict: false, timestamps: false });

const detallePedidoSchema = new mongoose.Schema({
  id_detalle: Number,
  id_pedido: Number,
  id_producto: Number,
  cantidad: Number,
  precio_unitario: Number,
  subtotal: Number,
}, { collection: 'detalles_pedido', strict: false, timestamps: false });

const direccionSchema = new mongoose.Schema({
  id_direccion: Number,
  id_usuario: Number,
  nombre_destinatario: String,
  direccion: String,
  ciudad: String,
  departamento: String,
  codigo_postal: String,
  telefono: String,
  es_principal: Boolean,
}, { collection: 'direcciones', strict: false, timestamps: false });

const metodoPagoSchema = new mongoose.Schema({
  id_metodo: Number,
  id_usuario: Number,
  tipo: String,
  numero_tarjeta: String,
  nombre_titular: String,
  fecha_vencimiento: String,
  es_principal: Boolean,
}, { collection: 'metodos_pago', strict: false, timestamps: false });

module.exports = {
  Carrito: mongoose.model('Carrito', carritoSchema),
  Pedido: mongoose.model('Pedido', pedidoSchema),
  DetallePedido: mongoose.model('DetallePedido', detallePedidoSchema),
  Direccion: mongoose.model('Direccion', direccionSchema),
  MetodoPago: mongoose.model('MetodoPago', metodoPagoSchema),
};

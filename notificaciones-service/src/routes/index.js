const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notificacionesController');
const { autenticar } = require('../middleware/auth');

// Endpoint interno (servicio a servicio, sin auth de usuario)
router.post('/internal/notificaciones', ctrl.crearNotificacionInterna);

// Notificaciones del usuario
router.get('/notificaciones',                      autenticar, ctrl.listarNotificaciones);
router.get('/notificaciones/no-leidas',            autenticar, ctrl.contarNoLeidas);
router.post('/notificaciones/:id/marcar-leida',    autenticar, ctrl.marcarLeida);
router.post('/notificaciones/marcar-todas-leidas', autenticar, ctrl.marcarTodasLeidas);
router.delete('/notificaciones/:id',               autenticar, ctrl.eliminarNotificacion);

// Mensajes
router.get('/mensajes',          autenticar, ctrl.listarConversaciones);
router.get('/mensajes/:id',      autenticar, ctrl.verConversacion);
router.post('/mensajes/enviar',  autenticar, ctrl.enviarMensaje);
router.get('/mensajes-usuarios', autenticar, ctrl.obtenerUsuariosDisponibles);

module.exports = router;

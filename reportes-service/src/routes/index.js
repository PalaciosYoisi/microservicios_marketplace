const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/reportesController');
const { autenticar } = require('../middleware/auth');

router.get('/reportes',            autenticar, ctrl.listarReportes);
router.post('/reportes',           autenticar, ctrl.crearReporte);
router.post('/reportes/:id/estado', autenticar, ctrl.actualizarEstadoReporte);

module.exports = router;

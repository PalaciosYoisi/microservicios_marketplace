const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

/**
 * Genera un JWT para el usuario autenticado
 */
function generarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id_usuario || usuario._id,
      correo: usuario.correo,
      rol: usuario.rol,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Normaliza el rol del usuario a un formato estándar
 */
function normalizarRol(rol) {
  const r = (rol || '').toLowerCase().trim();
  if (['administrador', 'admin', 'administrator'].includes(r)) return 'administrador';
  if (['emprendedor', 'vendedor'].includes(r)) return 'emprendedor';
  return 'comprador';
}

/**
 * Determina la URL de redirección según el rol
 */
function getRedirectPorRol(rol) {
  switch (normalizarRol(rol)) {
    case 'administrador': return '/admin/dashboard';
    case 'emprendedor':   return '/vendedor/dashboard';
    default:              return '/marketplace';
  }
}

/**
 * POST /auth/register
 * Registra un nuevo usuario
 */
async function registrar(req, res) {
  try {
    const { nombre, apellido, correo, cedula, contrasena, rol } = req.body;

    // Validaciones básicas
    const errores = {};
    if (!nombre || nombre.trim().length < 2) errores.nombre = ['El nombre debe tener al menos 2 caracteres.'];
    if (!apellido || apellido.trim().length < 2) errores.apellido = ['El apellido debe tener al menos 2 caracteres.'];
    if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.correo = ['El correo electrónico no es válido.'];
    if (!cedula || cedula.trim().length < 5) errores.cedula = ['La cédula debe tener al menos 5 caracteres.'];
    if (!contrasena || contrasena.length < 6) errores.contrasena = ['La contraseña debe tener al menos 6 caracteres.'];
    if (!rol || !['comprador', 'emprendedor'].includes(rol)) errores.rol = ['El rol seleccionado no es válido.'];

    if (Object.keys(errores).length > 0) {
      return res.status(422).json({ success: false, message: 'Por favor, corrige los errores en el formulario.', errors: errores });
    }

    const correoNorm = correo.trim().toLowerCase();

    // Verificar duplicados
    const correoExistente = await Usuario.findOne({ correo: correoNorm });
    if (correoExistente) {
      return res.status(409).json({ success: false, message: 'Este correo electrónico ya está registrado.', errors: { correo: ['El correo electrónico ya está en uso.'] } });
    }

    const cedulaExistente = await Usuario.findOne({ cedula: cedula.trim() });
    if (cedulaExistente) {
      return res.status(409).json({ success: false, message: 'Esta cédula ya está registrada.', errors: { cedula: ['La cédula ya está en uso.'] } });
    }

    // Generar nuevo ID
    const ultimoUsuario = await Usuario.findOne().sort({ id_usuario: -1 });
    const nuevoId = ultimoUsuario ? (ultimoUsuario.id_usuario + 1) : 1;

    // Encriptar contraseña
    const hash = await bcrypt.hash(contrasena, 12);

    // Crear usuario
    const usuario = new Usuario({
      id_usuario: nuevoId,
      cedula: cedula.trim(),
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      correo: correoNorm,
      contrasena: hash,
      rol: rol,
      estado: 'activo',
      ultimo_acceso: null,
    });

    await usuario.save();

    const token = generarToken(usuario);

    return res.status(201).json({
      success: true,
      message: '¡Registro exitoso! Bienvenido a EmprendeMarket.',
      token,
      usuario: {
        id: usuario.id_usuario,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
      },
      redirect: getRedirectPorRol(usuario.rol),
    });

  } catch (err) {
    console.error('[auth-service] Error en registro:', err);
    return res.status(500).json({ success: false, message: 'Ocurrió un error al registrar. Por favor, intenta de nuevo.' });
  }
}

/**
 * POST /auth/login
 * Inicia sesión y devuelve JWT
 */
async function iniciarSesion(req, res) {
  try {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
      return res.status(422).json({ success: false, message: 'Por favor, completa todos los campos.' });
    }

    const correoNorm = correo.trim().toLowerCase();

    // Buscar usuario (compatible con datos existentes)
    let usuario = await Usuario.findOne({ correo: correoNorm });
    if (!usuario) usuario = await Usuario.findOne({ correo: correo.trim() });

    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Las credenciales proporcionadas son incorrectas.' });
    }

    const rolNorm = normalizarRol(usuario.rol);
    const estadoNorm = (usuario.estado || '').toLowerCase().trim();

    // Verificar estado (admins siempre pueden entrar)
    if (rolNorm !== 'administrador' && estadoNorm !== 'activo') {
      const msg = estadoNorm === 'inactivo'
        ? 'Tu cuenta está inactiva. Contacta al administrador.'
        : 'Tu cuenta está suspendida. Contacta al administrador.';
      return res.status(403).json({ success: false, message: msg });
    }

    // Verificar contraseña
    const contrasenaAlmacenada = usuario.contrasena || usuario.Contrasena || usuario.password || '';
    let passwordValida = false;

    // Intentar bcrypt primero
    if (contrasenaAlmacenada.startsWith('$2y$') || contrasenaAlmacenada.startsWith('$2a$') || contrasenaAlmacenada.startsWith('$2b$')) {
      // bcrypt de PHP usa $2y$, Node usa $2b$ — son compatibles
      const hashCompatible = contrasenaAlmacenada.replace(/^\$2y\$/, '$2b$');
      passwordValida = await bcrypt.compare(contrasena, hashCompatible);
    }

    // Fallback: comparación directa (usuarios con contraseña sin encriptar)
    if (!passwordValida) {
      passwordValida = (contrasena === contrasenaAlmacenada) || (contrasena === contrasenaAlmacenada.trim());
      if (passwordValida) {
        // Actualizar a bcrypt
        const nuevoHash = await bcrypt.hash(contrasena, 12);
        await Usuario.updateOne({ _id: usuario._id }, { $set: { contrasena: nuevoHash } });
      }
    }

    if (!passwordValida) {
      return res.status(401).json({ success: false, message: 'Las credenciales proporcionadas son incorrectas.' });
    }

    // Actualizar último acceso
    await Usuario.updateOne({ _id: usuario._id }, { $set: { ultimo_acceso: new Date() } });

    const token = generarToken({ ...usuario.toObject(), rol: rolNorm });

    return res.status(200).json({
      success: true,
      message: '¡Bienvenido de vuelta!',
      token,
      usuario: {
        id: usuario.id_usuario,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: rolNorm,
        foto_perfil: usuario.foto_perfil || null,
      },
      redirect: getRedirectPorRol(rolNorm),
    });

  } catch (err) {
    console.error('[auth-service] Error en login:', err);
    return res.status(500).json({ success: false, message: 'Ocurrió un error al iniciar sesión. Por favor, intenta de nuevo.' });
  }
}

/**
 * POST /auth/logout
 * El logout en JWT es del lado del cliente (eliminar token)
 */
function cerrarSesion(req, res) {
  return res.status(200).json({ success: true, message: 'Sesión cerrada correctamente.', redirect: '/login' });
}

/**
 * GET /auth/me
 * Devuelve datos del usuario autenticado (requiere token)
 */
async function obtenerPerfil(req, res) {
  try {
    const usuario = await Usuario.findOne({ id_usuario: req.usuario.id }).select('-contrasena -Contrasena -password');
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

    return res.status(200).json({ success: true, usuario });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener perfil.' });
  }
}

/**
 * POST /auth/verify
 * Verifica un token JWT (usado por el gateway)
 */
function verificarToken(req, res) {
  const { token } = req.body;
  if (!token) return res.status(400).json({ valid: false, message: 'Token requerido.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.status(200).json({ valid: true, usuario: decoded });
  } catch (err) {
    return res.status(401).json({ valid: false, message: 'Token inválido o expirado.' });
  }
}

// ── Perfil del usuario ────────────────────────────────────────────────────────

/**
 * PUT /auth/perfil
 * Actualiza datos del perfil del usuario autenticado
 */
async function actualizarPerfil(req, res) {
  try {
    const { nombre, apellido, cedula, telefono, bio, foto_perfil } = req.body;
    const cambios = {};
    if (nombre)      cambios.nombre      = nombre.trim();
    if (apellido)    cambios.apellido    = apellido.trim();
    if (cedula)      cambios.cedula      = cedula.trim();
    if (telefono !== undefined) cambios.telefono = telefono;
    if (bio !== undefined)      cambios.bio      = bio;
    if (foto_perfil !== undefined) cambios.foto_perfil = foto_perfil;

    if (!Object.keys(cambios).length) {
      return res.status(422).json({ success: false, message: 'No hay datos para actualizar.' });
    }

    await Usuario.updateOne({ id_usuario: req.usuario.id }, { $set: cambios });
    const actualizado = await Usuario.findOne({ id_usuario: req.usuario.id }).select('-contrasena -Contrasena -password');
    return res.json({ success: true, message: 'Perfil actualizado correctamente.', usuario: actualizado });
  } catch (err) {
    console.error('[auth-service] actualizarPerfil:', err);
    return res.status(500).json({ success: false, message: 'Error al actualizar el perfil.' });
  }
}

/**
 * POST /auth/perfil/foto
 * Sube o actualiza la foto de perfil (requiere multer)
 */
async function subirFotoPerfil(req, res) {
  try {
    if (!req.file) return res.status(422).json({ success: false, message: 'No se recibió ningún archivo.' });
    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    await Usuario.updateOne({ id_usuario: req.usuario.id }, { $set: { foto_perfil: base64 } });
    return res.json({ success: true, message: 'Foto de perfil actualizada.', url: base64 });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al subir la foto.' });
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

async function obtenerUsuariosBulk(req, res) {
  if (!validarClaveInterna(req, res)) return;
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(422).json({ success: false, message: 'ids debe ser un arreglo.' });
    const usuarios = await Usuario.find({ id_usuario: { $in: ids.map(Number) } })
      .select('-contrasena -Contrasena -password');
    return res.json({ success: true, usuarios });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
}

async function listarTodosUsuarios(req, res) {
  if (!validarClaveInterna(req, res)) return;
  try {
    const usuarios = await Usuario.find({}).select('-contrasena -Contrasena -password');
    return res.json({ success: true, usuarios });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
}

// ── Endpoints admin (requieren JWT de administrador) ──────────────────────────

async function adminListarUsuarios(req, res) {
  try {
    const { rol, estado, buscar } = req.query;
    const filtro = {};
    if (rol)    filtro.rol = rol;
    if (estado) filtro.estado = estado;
    if (buscar) {
      const re = { $regex: buscar, $options: 'i' };
      filtro.$or = [{ nombre: re }, { apellido: re }, { correo: re }, { cedula: re }];
    }
    const usuarios = await Usuario.find(filtro)
      .select('-contrasena -Contrasena -password')
      .sort({ id_usuario: 1 });
    return res.json({ success: true, usuarios });
  } catch (err) {
    console.error('[auth-service] adminListarUsuarios:', err);
    return res.status(500).json({ success: false, message: 'Error al listar usuarios.' });
  }
}

async function adminCambiarEstadoUsuario(req, res) {
  try {
    const { estado } = req.body;
    if (!['activo', 'suspendido', 'inactivo'].includes(estado)) {
      return res.status(422).json({ success: false, message: 'Estado no válido.' });
    }
    const id = parseInt(req.params.id);
    const usuario = await Usuario.findOne({ id_usuario: id });
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    if (usuario.rol === 'administrador') {
      return res.status(403).json({ success: false, message: 'No se puede modificar el estado de un administrador.' });
    }
    await Usuario.updateOne({ id_usuario: id }, { $set: { estado } });
    return res.json({ success: true, message: `Usuario ${estado === 'suspendido' ? 'suspendido' : 'activado'} correctamente.` });
  } catch (err) {
    console.error('[auth-service] adminCambiarEstadoUsuario:', err);
    return res.status(500).json({ success: false, message: 'Error al cambiar estado del usuario.' });
  }
}

module.exports = { registrar, iniciarSesion, cerrarSesion, obtenerPerfil, verificarToken, actualizarPerfil, subirFotoPerfil, obtenerUsuariosBulk, listarTodosUsuarios, adminListarUsuarios, adminCambiarEstadoUsuario };

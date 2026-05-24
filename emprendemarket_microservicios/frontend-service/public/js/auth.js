/**
 * auth.js — Utilidades de autenticación compartidas entre páginas
 * Maneja JWT en localStorage y protección de rutas
 */

const API = 'http://localhost:3000/api';

function getToken() {
  return localStorage.getItem('token');
}

function getUsuario() {
  try {
    return JSON.parse(localStorage.getItem('usuario') || 'null');
  } catch {
    return null;
  }
}

function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = '/pages/login.html';
}

/**
 * Protege una página: redirige al login si no hay token
 * @param {string[]} rolesPermitidos - roles que pueden acceder (vacío = cualquier autenticado)
 */
function protegerPagina(rolesPermitidos = []) {
  const token = getToken();
  const usuario = getUsuario();

  if (!token || !usuario) {
    window.location.href = '/pages/login.html';
    return null;
  }

  if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(usuario.rol)) {
    // Redirigir al dashboard correcto
    if (usuario.rol === 'administrador') window.location.href = '/pages/admin_dashboard.html';
    else if (usuario.rol === 'emprendedor') window.location.href = '/pages/vendedor_dashboard.html';
    else window.location.href = '/marketplace';
    return null;
  }

  return usuario;
}

/**
 * Hace una petición autenticada al API
 * @param {string} endpoint - La ruta de la API (ej: /api/pedidos)
 */
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const targetUrl = endpoint.startsWith('http') ? endpoint : `${API}${endpoint.replace('/api', '')}`;
  const res = await fetch(targetUrl, { ...options, headers });

  // Si el token expiró, redirigir al login
  if (res.status === 401) {
    cerrarSesion();
    return null;
  }

  return res;
}

/**
 * Renderiza el navbar con datos del usuario autenticado
 */
function renderNavbarUsuario(containerId) {
  const usuario = getUsuario();
  const container = document.getElementById(containerId);
  if (!container || !usuario) return;

  container.innerHTML = `
    <div class="d-flex alignq-items-center gap-3">
      <span class="fw-medium text-dark">${usuario.nombre} ${usuario.apellido}</span>
      <span class="badge bg-secondary text-dark">${usuario.rol}</span>
      <button class="btn btn-outline-secondary btn-sm" onclick="cerrarSesion()">
        <span class="material-symbols-outlined icon-sm">logout</span> Salir
      </button>
    </div>
  `;
}

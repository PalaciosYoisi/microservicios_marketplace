/**
 * auth.js — Utilidades de autenticación compartidas entre páginas
 * Maneja JWT en localStorage y protección de rutas
 */

const API = '/api';

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
  window.location.href = '/login';
}

/**
 * Protege una página: redirige al login si no hay token
 * @param {string[]} rolesPermitidos - roles que pueden acceder (vacío = cualquier autenticado)
 */
function protegerPagina(rolesPermitidos = []) {
  const token = getToken();
  const usuario = getUsuario();

  if (!token || !usuario) {
    window.location.href = '/login';
    return null;
  }

  if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(usuario.rol)) {
    if (usuario.rol === 'administrador') window.location.href = '/admin/dashboard';
    else if (usuario.rol === 'emprendedor') window.location.href = '/vendedor/dashboard';
    else window.location.href = '/comprador/dashboard';
    return null;
  }

  return usuario;
}

/**
 * Hace una petición autenticada al API.
 * - Auto-detecta FormData y omite Content-Type (el browser lo pone con el boundary correcto).
 * - Captura errores de red y los devuelve como null en lugar de lanzar.
 * @param {string} endpoint
 * @param {RequestInit} options
 * @returns {Response|null}
 */
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;

  // Para FormData NO ponemos Content-Type — el browser lo agrega con el boundary.
  const baseHeaders = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  // Las opciones.headers pueden sobreescribir los defaults (pero ya no se necesita headers:{})
  const headers = { ...baseHeaders, ...(options.headers || {}) };

  // Normaliza la URL: si ya tiene /api no lo duplica
  const targetUrl = endpoint.startsWith('http')
    ? endpoint
    : `${API}${endpoint.replace(/^\/api/, '')}`;

  try {
    const res = await fetch(targetUrl, { ...options, headers });

    if (res.status === 401) {
      cerrarSesion();
      return null;
    }

    return res;
  } catch (err) {
    console.error('[apiFetch] Error de red:', err.message, '→', targetUrl);
    return null;
  }
}

/**
 * Renderiza el navbar con datos del usuario autenticado
 */
function renderNavbarUsuario(containerId) {
  const usuario = getUsuario();
  const container = document.getElementById(containerId);
  if (!container) {
    // Si no hay container, al menos seteamos el texto si hay un span de nombre
    return;
  }
  if (!usuario) {
    container.innerHTML = `<a href="/login" class="btn btn-primary btn-sm">Ingresar</a>`;
    return;
  }

  const dashLink = usuario.rol === 'emprendedor'
    ? '/vendedor/dashboard'
    : usuario.rol === 'administrador'
    ? '/admin/dashboard'
    : '/comprador/dashboard';

  const rolLabel = usuario.rol === 'emprendedor' ? 'Vendedor'
    : usuario.rol === 'administrador' ? 'Admin' : 'Comprador';

  container.innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <span class="fw-medium text-dark small d-none d-md-inline">${usuario.nombre}</span>
      <a href="${dashLink}" class="btn btn-outline-primary btn-sm" title="Mi panel">
        <span class="material-symbols-outlined icon-sm">dashboard</span>
        <span class="d-none d-md-inline ms-1">${rolLabel}</span>
      </a>
      <button class="btn btn-outline-secondary btn-sm" onclick="cerrarSesion()" title="Cerrar sesión">
        <span class="material-symbols-outlined icon-sm">logout</span>
      </button>
    </div>
  `;
}

const usuario = protegerPagina(['administrador']);
if (usuario) {
  document.getElementById('nombreUsuario').textContent = `${usuario.nombre} ${usuario.apellido}`;
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
    let backdrop = document.getElementById('sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sidebar-backdrop';
      backdrop.className = 'sidebar-backdrop';
      backdrop.addEventListener('click', closeMobileSidebar);
      document.body.appendChild(backdrop);
    }
    backdrop.classList.toggle('active', sidebar.classList.contains('mobile-open'));
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('mobile-open');
  const bd = document.getElementById('sidebar-backdrop');
  if (bd) bd.classList.remove('active');
}

function mostrarSeccion(sec) {
  ['dashboard', 'tiendas', 'productos', 'pedidos', 'reportes', 'usuarios', 'perfil'].forEach(s => {
    const el = document.getElementById(`sec-${s}`);
    if (el) el.classList.add('d-none');
  });
  const target = document.getElementById(`sec-${sec}`);
  if (target) target.classList.remove('d-none');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  if (sec === 'tiendas')   cargarTiendas();
  if (sec === 'productos') cargarProductos();
  if (sec === 'pedidos')   cargarPedidos();
  if (sec === 'reportes')  cargarReportesAdmin();
  if (sec === 'usuarios')  cargarUsuarios();
  if (sec === 'perfil')    cargarPerfilA();
}

// ── Perfil del admin ──────────────────────────────────────────────────────────
let fotoPendingA = null;
let pedidosDataAdmin = [];

async function cargarPerfilA() {
  const res = await apiFetch(`${API}/auth/me`);
  if (!res) return;
  const data = await res.json();
  if (!data.success) return;
  const u = data.usuario;
  document.getElementById('perfilNombreA').value   = u.nombre   || '';
  document.getElementById('perfilApellidoA').value = u.apellido || '';
  document.getElementById('perfilCorreoA').value   = u.correo   || '';
  document.getElementById('perfilTelefonoA').value = u.telefono || '';
  const img = document.getElementById('fotoActualA');
  if (u.foto_perfil) { img.src = u.foto_perfil; img.classList.remove('d-none'); }
}

function previsualizarFotoA(input) {
  const file = input.files[0];
  if (!file) return;
  fotoPendingA = file;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('fotoActualA');
    img.src = e.target.result;
    img.classList.remove('d-none');
  };
  reader.readAsDataURL(file);
}

async function guardarPerfilA(e) {
  e.preventDefault();
  const alertEl = document.getElementById('perfilAlertA');
  alertEl.classList.add('d-none');

  if (fotoPendingA) {
    const fd = new FormData();
    fd.append('foto', fotoPendingA);
    await apiFetch(`${API}/auth/perfil/foto`, { method: 'POST', body: fd, headers: {} });
    fotoPendingA = null;
  }

  const res = await apiFetch(`${API}/auth/perfil`, {
    method: 'PUT',
    body: JSON.stringify({
      nombre:   document.getElementById('perfilNombreA').value,
      apellido: document.getElementById('perfilApellidoA').value,
      telefono: document.getElementById('perfilTelefonoA').value,
    }),
  });
  if (!res) return;
  const data = await res.json();
  alertEl.className = `alert alert-${data.success ? 'success' : 'danger'}`;
  alertEl.textContent = data.message;
  alertEl.classList.remove('d-none');
  if (data.success) {
    document.getElementById('nombreUsuario').textContent = `${data.usuario.nombre} ${data.usuario.apellido}`;
    toast('Perfil actualizado correctamente', 'success');
  }
}

function toast(msg, tipo = 'success') {
  const el = document.getElementById('toast');
  el.className = `alert alert-${tipo} position-fixed bottom-0 end-0 m-3 shadow-strong`;
  el.textContent = msg;
  el.classList.remove('d-none');
  setTimeout(() => el.classList.add('d-none'), 3000);
}

function estadoBadge(estado) {
  const map = {
    activa: 'bg-success', activo: 'bg-success',
    pendiente: 'bg-warning text-dark',
    rechazada: 'bg-danger', suspendida: 'bg-danger',
    inactivo: 'bg-secondary', inactiva: 'bg-secondary',
    procesando: 'bg-info text-dark', enviado: 'bg-primary',
    entregado: 'bg-success', cancelado: 'bg-danger',
  };
  return map[(estado || '').toLowerCase()] || 'bg-secondary';
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

async function cargarDashboard() {
  try {
    const [resTiendas, resProd, resPed] = await Promise.all([
      apiFetch(`${API}/admin/tiendas`),
      apiFetch(`${API}/admin/productos`),
      apiFetch(`${API}/admin/pedidos`),
    ]);
    if (!resTiendas || !resProd || !resPed) return;

    const [dataTiendas, dataProd, dataPed] = await Promise.all([
      resTiendas.json(), resProd.json(), resPed.json(),
    ]);

    const tiendas   = dataTiendas.tiendas || [];
    const pendientes = tiendas.filter(t => (t.estado || '').toLowerCase() === 'pendiente');

    document.getElementById('statTiendas').textContent   = tiendas.length;
    document.getElementById('statPendientes').textContent = pendientes.length;
    document.getElementById('statProductos').textContent  = (dataProd.productos || []).length;
    document.getElementById('statPedidos').textContent    = (dataPed.pedidos || []).length;

    renderTiendasPendientes(pendientes);
  } catch (err) {
    console.error('Error cargando dashboard admin:', err);
  }
}

function renderTiendasPendientes(tiendas) {
  const container = document.getElementById('tiendas-pendientes-lista');
  if (!tiendas.length) {
    container.innerHTML = `<div class="text-center py-4 text-muted">
      <span class="material-symbols-outlined icon-lg">check_circle</span>
      <p class="mt-2">No hay tiendas pendientes de aprobación</p>
    </div>`;
    return;
  }

  container.innerHTML = `<div class="table-responsive">
    <table class="table table-hover mb-0">
      <thead class="table-light">
        <tr><th>Tienda</th><th>Propietario</th><th>Categoría</th><th>Fecha</th><th>Acciones</th></tr>
      </thead>
      <tbody>
        ${tiendas.map(t => `
          <tr>
            <td class="fw-medium">${t.nombre_tienda}</td>
            <td>${t.propietario ? `${t.propietario.nombre} ${t.propietario.apellido}` : '—'}</td>
            <td><span class="badge bg-secondary">${t.categoria || '—'}</span></td>
            <td class="small text-muted">${t.fecha_creacion ? new Date(t.fecha_creacion).toLocaleDateString('es-CO') : '—'}</td>
            <td>
              <button class="btn btn-info btn-sm me-1" onclick="verDetalleTienda('${t.id_tienda}')">
                <span class="material-symbols-outlined icon-sm">visibility</span>
              </button>
              <button class="btn btn-success btn-sm me-1" onclick="cambiarEstadoTienda('${t.id_tienda}', 'activa')">
                <span class="material-symbols-outlined icon-sm">check</span> Aprobar
              </button>
              <button class="btn btn-danger btn-sm" onclick="cambiarEstadoTienda('${t.id_tienda}', 'rechazada')">
                <span class="material-symbols-outlined icon-sm">close</span> Rechazar
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

// ── Tiendas ───────────────────────────────────────────────────────────────────

let todasLasTiendas = [];

async function cargarTiendas() {
  const container = document.getElementById('lista-tiendas');
  container.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;

  const res = await apiFetch(`${API}/admin/tiendas`);
  if (!res) return;
  const data = await res.json();
  todasLasTiendas = data.tiendas || [];

  if (!todasLasTiendas.length) {
    container.innerHTML = `<div class="text-center py-5 text-muted">No hay tiendas registradas.</div>`;
    return;
  }

  container.innerHTML = `<div class="table-responsive">
    <table class="table table-hover align-middle">
      <thead class="table-light">
        <tr><th>ID</th><th>Nombre</th><th>Propietario</th><th>Categoría</th><th>Estado</th><th>Acciones</th></tr>
      </thead>
      <tbody>
        ${todasLasTiendas.map(t => {
          const estado = (t.estado || '').toLowerCase();
          return `
          <tr>
            <td class="text-muted small">#${t.id_tienda}</td>
            <td class="fw-medium">${t.nombre_tienda}</td>
            <td>${t.propietario ? `${t.propietario.nombre} ${t.propietario.apellido}` : '—'}</td>
            <td><span class="badge bg-secondary">${t.categoria || '—'}</span></td>
            <td><span class="badge ${estadoBadge(t.estado)}">${t.estado}</span></td>
            <td>
              <button class="btn btn-info btn-sm me-1" onclick="verDetalleTienda('${t.id_tienda}')" title="Ver detalle">
                <span class="material-symbols-outlined icon-sm">visibility</span>
              </button>
              ${estado === 'pendiente' ? `
                <button class="btn btn-success btn-sm me-1" onclick="cambiarEstadoTienda('${t.id_tienda}', 'activa')">Aprobar</button>
                <button class="btn btn-danger btn-sm" onclick="cambiarEstadoTienda('${t.id_tienda}', 'rechazada')">Rechazar</button>
              ` : ''}
              ${estado === 'activa' || estado === 'activo' ? `
                <button class="btn btn-warning btn-sm" onclick="cambiarEstadoTienda('${t.id_tienda}', 'suspendida')">Suspender</button>
              ` : ''}
              ${estado === 'suspendida' ? `
                <button class="btn btn-success btn-sm" onclick="cambiarEstadoTienda('${t.id_tienda}', 'activa')">Activar</button>
              ` : ''}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

// ── Modal detalle tienda ──────────────────────────────────────────────────────

function verDetalleTienda(id) {
  // Buscar en el cache local primero
  let t = todasLasTiendas.find(x => String(x.id_tienda) === String(id));

  if (!t) {
    // Si venimos del dashboard, cargar desde API
    apiFetch(`${API}/admin/tiendas`).then(async r => {
      if (!r) return;
      const d = await r.json();
      todasLasTiendas = d.tiendas || [];
      t = todasLasTiendas.find(x => String(x.id_tienda) === String(id));
      if (t) _mostrarModalTienda(t);
    });
    return;
  }
  _mostrarModalTienda(t);
}

function _mostrarModalTienda(t) {
  const estado = (t.estado || '').toLowerCase();
  const prop = t.propietario || {};

  // Datos de la tienda
  document.getElementById('modalTiendaNombre').textContent  = t.nombre_tienda || '—';
  document.getElementById('modalTiendaEstado').className    = `badge ${estadoBadge(t.estado)}`;
  document.getElementById('modalTiendaEstado').textContent  = t.estado || '—';
  document.getElementById('modalTiendaCategoria').textContent   = t.categoria || '—';
  document.getElementById('modalTiendaDescripcion').textContent = t.descripcion || 'Sin descripción';
  document.getElementById('modalTiendaTelefono').textContent    = t.telefono_contacto || '—';
  document.getElementById('modalTiendaHorario').textContent     = t.horario_atencion || '—';
  document.getElementById('modalTiendaFecha').textContent       = t.fecha_creacion
    ? new Date(t.fecha_creacion).toLocaleDateString('es-CO')
    : '—';

  // Datos del propietario
  document.getElementById('modalPropNombre').textContent   = `${prop.nombre || ''} ${prop.apellido || ''}`.trim() || '—';
  document.getElementById('modalPropCorreo').textContent   = prop.correo  || '—';
  document.getElementById('modalPropCedula').textContent   = prop.cedula  || '—';
  document.getElementById('modalPropTelefono').textContent = prop.telefono || '—';

  // Botones de acción en el modal
  const actionsEl = document.getElementById('modalTiendaAcciones');
  actionsEl.innerHTML = '';

  if (estado === 'pendiente') {
    actionsEl.innerHTML = `
      <button class="btn btn-success me-2" onclick="cambiarEstadoTienda('${t.id_tienda}', 'activa'); bootstrap.Modal.getInstance(document.getElementById('modalDetalleTienda')).hide();">
        <span class="material-symbols-outlined icon-sm me-1">check</span>Aprobar tienda
      </button>
      <button class="btn btn-danger" onclick="cambiarEstadoTienda('${t.id_tienda}', 'rechazada'); bootstrap.Modal.getInstance(document.getElementById('modalDetalleTienda')).hide();">
        <span class="material-symbols-outlined icon-sm me-1">close</span>Rechazar tienda
      </button>`;
  } else if (estado === 'activa' || estado === 'activo') {
    actionsEl.innerHTML = `
      <button class="btn btn-warning" onclick="cambiarEstadoTienda('${t.id_tienda}', 'suspendida'); bootstrap.Modal.getInstance(document.getElementById('modalDetalleTienda')).hide();">
        <span class="material-symbols-outlined icon-sm me-1">block</span>Suspender tienda
      </button>`;
  } else if (estado === 'suspendida') {
    actionsEl.innerHTML = `
      <button class="btn btn-success" onclick="cambiarEstadoTienda('${t.id_tienda}', 'activa'); bootstrap.Modal.getInstance(document.getElementById('modalDetalleTienda')).hide();">
        <span class="material-symbols-outlined icon-sm me-1">check_circle</span>Activar tienda
      </button>`;
  }

  new bootstrap.Modal(document.getElementById('modalDetalleTienda')).show();
}

async function cambiarEstadoTienda(id, estado) {
  const etiquetas = { activa: 'aprobar', rechazada: 'rechazar', suspendida: 'suspender' };
  const etiqueta  = etiquetas[estado] || 'cambiar';
  if (!confirm(`¿${etiqueta} esta tienda?`)) return;

  const res = await apiFetch(`${API}/admin/tiendas/${id}/estado`, {
    method: 'POST',
    body: JSON.stringify({ estado }),
  });
  if (!res) return;
  const data = await res.json();
  toast(data.message, data.success ? 'success' : 'danger');
  if (data.success) {
    cargarDashboard();
    const secTiendas = document.getElementById('sec-tiendas');
    if (secTiendas && !secTiendas.classList.contains('d-none')) cargarTiendas();
  }
}

// ── Productos ─────────────────────────────────────────────────────────────────

async function cargarProductos() {
  const res = await apiFetch(`${API}/admin/productos`);
  if (!res) return;
  const data = await res.json();
  const container = document.getElementById('lista-productos');

  if (!data.productos?.length) {
    container.innerHTML = `<div class="text-center py-5 text-muted">No hay productos registrados.</div>`;
    return;
  }

  container.innerHTML = `<div class="table-responsive">
    <table class="table table-hover">
      <thead class="table-light">
        <tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Categoría</th><th>Estado</th><th>Acciones</th></tr>
      </thead>
      <tbody>
        ${data.productos.map(p => `
          <tr>
            <td class="text-muted small">#${p.id_producto}</td>
            <td class="fw-medium">${p.nombre_producto}</td>
            <td>$${Number(p.precio).toLocaleString('es-CO')}</td>
            <td><span class="${(p.stock || 0) < 5 ? 'text-warning fw-bold' : ''}">${p.stock ?? '—'}</span></td>
            <td><span class="badge bg-secondary">${p.categoria || '—'}</span></td>
            <td><span class="badge ${estadoBadge(p.estado)}">${p.estado}</span></td>
            <td>
              ${(p.estado || '').toLowerCase() === 'activo' ? `
                <button class="btn btn-danger btn-sm" onclick="desactivarProducto('${p.id_producto}')">
                  <span class="material-symbols-outlined icon-sm">block</span> Desactivar
                </button>
              ` : '<span class="text-muted small">Inactivo</span>'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

async function desactivarProducto(id) {
  if (!confirm('¿Desactivar este producto?')) return;
  const res = await apiFetch(`${API}/admin/productos/${id}/desactivar`, { method: 'POST' });
  if (!res) return;
  const data = await res.json();
  toast(data.message, data.success ? 'success' : 'danger');
  if (data.success) cargarProductos();
}

// ── Pedidos ───────────────────────────────────────────────────────────────────

async function cargarPedidos() {
  const res = await apiFetch(`${API}/admin/pedidos`);
  if (!res) return;
  const data = await res.json();
  pedidosDataAdmin = data.pedidos || [];
  const container  = document.getElementById('lista-pedidos');

  if (!pedidosDataAdmin.length) {
    container.innerHTML = `<div class="text-center py-5 text-muted">
      <span class="material-symbols-outlined icon-xl">receipt_long</span>
      <p class="mt-2">No hay pedidos registrados.</p>
    </div>`;
    return;
  }

  container.innerHTML = `<div class="table-responsive">
    <table class="table table-hover align-middle">
      <thead class="table-light">
        <tr><th>ID</th><th>Comprador</th><th>Productos</th><th>Fecha</th><th>Total</th><th>Estado</th><th></th></tr>
      </thead>
      <tbody>
        ${pedidosDataAdmin.map(p => {
          const detalles = p.detalles || [];
          const resumen  = detalles.length
            ? detalles.slice(0, 2).map(d => d.nombre_producto || 'Producto').join(', ') + (detalles.length > 2 ? ' +' + (detalles.length - 2) + ' más' : '')
            : '—';
          const fecha = p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString('es-CO') : '—';
          return `
          <tr>
            <td class="text-muted small fw-medium">#${p.id_pedido}</td>
            <td>
              <div class="fw-medium small">${p.nombre_comprador || '—'}</div>
              <div class="text-muted" style="font-size:.72rem">#${p.id_comprador}</div>
            </td>
            <td class="small text-muted text-truncate" style="max-width:180px">${resumen}</td>
            <td class="small text-muted">${fecha}</td>
            <td class="fw-medium text-primary">$${Number(p.total || 0).toLocaleString('es-CO')}</td>
            <td><span class="badge ${estadoBadge(p.estado)}">${p.estado}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary rounded-3"
                      onclick="verDetallePedidoAdmin(${p.id_pedido})" title="Ver detalles">
                <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle">visibility</span>
              </button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

function verDetallePedidoAdmin(id) {
  const p = pedidosDataAdmin.find(x => x.id_pedido === id);
  if (p) verDetallePedido(p, 'admin');
}

function initModalDetallePedido() {
  if (document.getElementById('modalDetallePedido')) return;
  const div = document.createElement('div');
  div.innerHTML = `
  <div class="modal fade" id="modalDetallePedido" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content border-0" style="border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.18)">
        <div class="modal-header border-0" style="padding:1.4rem 1.5rem .8rem">
          <div class="flex-grow-1">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="material-symbols-outlined text-primary" style="font-size:22px">receipt_long</span>
              <h5 class="modal-title fw-bold mb-0" id="mdp-titulo">Pedido</h5>
              <span id="mdp-badge" class="badge">—</span>
            </div>
            <div class="text-muted small mt-1" id="mdp-fecha">—</div>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body p-0">
          <div class="px-4 py-3 border-bottom" style="background:#f8fafc">
            <div id="mdp-timeline" class="d-flex align-items-start"></div>
          </div>
          <div id="mdp-info-wrap" class="px-4 py-3 border-bottom">
            <div class="small text-uppercase fw-semibold text-muted mb-3" style="letter-spacing:.06em">Información</div>
            <div id="mdp-info" class="d-flex flex-column gap-2"></div>
          </div>
          <div class="px-4 py-3">
            <div class="small text-uppercase fw-semibold text-muted mb-3" style="letter-spacing:.06em">Productos</div>
            <div id="mdp-productos" class="d-flex flex-column gap-2"></div>
          </div>
          <div class="px-4 py-3 border-top" style="background:#f8fafc">
            <div id="mdp-resumen"></div>
          </div>
        </div>
        <div class="modal-footer border-0 d-flex gap-2 justify-content-end" id="mdp-footer" style="padding:.8rem 1.5rem"></div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(div.firstElementChild);
}

function verDetallePedido(pedido, contexto) {
  initModalDetallePedido();

  const PASOS = [
    { key: 'pendiente',  label: 'Recibido',   icon: 'schedule' },
    { key: 'procesando', label: 'Preparando',  icon: 'inventory' },
    { key: 'enviado',    label: 'En camino',   icon: 'local_shipping' },
    { key: 'entregado',  label: 'Entregado',   icon: 'done_all' },
  ];
  const estadoActual = (pedido.estado || '').toLowerCase();
  const cancelado    = estadoActual === 'cancelado';
  const idxActual    = PASOS.findIndex(p => p.key === estadoActual);

  document.getElementById('mdp-titulo').textContent = 'Pedido #' + pedido.id_pedido;
  document.getElementById('mdp-fecha').textContent  = pedido.fecha_pedido
    ? 'Realizado el ' + new Date(pedido.fecha_pedido).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  const badge = document.getElementById('mdp-badge');
  badge.className   = 'badge ' + estadoBadge(pedido.estado);
  badge.textContent = pedido.estado || '—';

  const tlEl = document.getElementById('mdp-timeline');
  if (cancelado) {
    tlEl.innerHTML = `<div class="d-flex align-items-center gap-2 text-danger py-1 fw-medium">
      <span class="material-symbols-outlined">cancel</span>Pedido cancelado
    </div>`;
  } else {
    tlEl.innerHTML = PASOS.map((paso, i) => {
      const done   = i <= idxActual;
      const active = i === idxActual;
      const dotBg  = done  ? 'var(--primary)' : '#fff';
      const dotBd  = (done || active) ? 'var(--primary)' : '#dee2e6';
      const dotClr = done  ? '#fff' : (active ? 'var(--primary)' : '#adb5bd');
      const lblClr = (done || active) ? 'var(--primary)' : '#adb5bd';
      const lineL  = i > 0
        ? '<div style="position:absolute;top:16px;left:0;right:50%;height:2px;background:' + (i <= idxActual ? 'var(--primary)' : '#dee2e6') + ';z-index:0"></div>'
        : '';
      const lineR  = i < PASOS.length - 1
        ? '<div style="position:absolute;top:16px;left:50%;right:0;height:2px;background:' + (i < idxActual ? 'var(--primary)' : '#dee2e6') + ';z-index:0"></div>'
        : '';
      return '<div class="flex-fill d-flex flex-column align-items-center position-relative">' +
        lineL + lineR +
        '<div class="rounded-circle d-flex align-items-center justify-content-center" style="width:34px;height:34px;background:' + dotBg + ';border:2px solid ' + dotBd + ';position:relative;z-index:1;flex-shrink:0">' +
        '<span class="material-symbols-outlined" style="font-size:16px;color:' + dotClr + '">' + paso.icon + '</span>' +
        '</div>' +
        '<div class="mt-1 text-center" style="font-size:.65rem;color:' + lblClr + ';font-weight:' + (active ? 700 : 500) + ';line-height:1.3">' + paso.label + '</div>' +
        '</div>';
    }).join('');
  }

  const infoWrap = document.getElementById('mdp-info-wrap');
  let infoHtml = '';
  if (contexto !== 'comprador' && (pedido.nombre_comprador || pedido.id_comprador)) {
    infoHtml += '<div class="d-flex align-items-center gap-2">' +
      '<div class="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style="width:36px;height:36px">' +
      '<span class="material-symbols-outlined text-secondary" style="font-size:18px">person</span></div>' +
      '<div><div class="fw-medium small">' + (pedido.nombre_comprador || 'Comprador') + '</div>' +
      '<div class="text-muted" style="font-size:.72rem">ID #' + pedido.id_comprador + '</div></div></div>';
  }
  if (pedido.direccion_envio) {
    infoHtml += '<div class="d-flex align-items-center gap-2">' +
      '<div class="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style="width:36px;height:36px">' +
      '<span class="material-symbols-outlined text-secondary" style="font-size:18px">location_on</span></div>' +
      '<div class="small">' + pedido.direccion_envio + (pedido.telefono ? ' &nbsp;·&nbsp; Tel: ' + pedido.telefono : '') + '</div></div>';
  }
  if (pedido.metodo_pago) {
    infoHtml += '<div class="d-flex align-items-center gap-2">' +
      '<div class="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style="width:36px;height:36px">' +
      '<span class="material-symbols-outlined text-secondary" style="font-size:18px">credit_card</span></div>' +
      '<div class="small text-muted">' + pedido.metodo_pago + (pedido.transaccion_id ? ' &nbsp;·&nbsp; ' + pedido.transaccion_id : '') + '</div></div>';
  }
  document.getElementById('mdp-info').innerHTML = infoHtml;
  infoWrap.style.display = infoHtml ? '' : 'none';

  const detalles = pedido.detalles || [];
  document.getElementById('mdp-productos').innerHTML = detalles.length
    ? detalles.map(d =>
        '<div class="d-flex align-items-center gap-3 p-3 rounded-3 border">' +
        '<img src="' + (d.imagen_url || '/images/no-image.svg') + '" onerror="this.src=\'/images/no-image.svg\'" style="width:64px;height:64px;object-fit:cover;border-radius:10px;flex-shrink:0">' +
        '<div class="flex-grow-1 overflow-hidden">' +
        '<div class="fw-semibold text-truncate">' + (d.nombre_producto || '—') + '</div>' +
        '<div class="text-muted small">' + (d.nombre_tienda || '') + '</div>' +
        (d.talla ? '<span class="badge bg-light text-dark border mt-1" style="font-size:.7rem">Talla: ' + d.talla + '</span>' : '') +
        '</div>' +
        '<div class="text-end flex-shrink-0">' +
        '<div class="text-muted small">×' + d.cantidad + '</div>' +
        '<div class="fw-bold text-primary">$' + Number(d.subtotal || 0).toLocaleString('es-CO') + '</div>' +
        '<div class="text-muted" style="font-size:.7rem">$' + Number(d.precio_unitario || 0).toLocaleString('es-CO') + ' c/u</div>' +
        '</div></div>'
      ).join('')
    : '<div class="text-center text-muted py-3 small">Sin productos registrados</div>';

  const subtotal = Number(pedido.subtotal) || (Number(pedido.total || 0) - Number(pedido.envio || 0));
  const envio    = Number(pedido.envio || 0);
  const total    = Number(pedido.total || 0);
  document.getElementById('mdp-resumen').innerHTML =
    '<div class="d-flex flex-column gap-1" style="font-size:.9rem">' +
    '<div class="d-flex justify-content-between text-muted"><span>Subtotal</span><span>$' + subtotal.toLocaleString('es-CO') + '</span></div>' +
    '<div class="d-flex justify-content-between text-muted"><span>Envío</span><span>' +
      (envio === 0 ? '<span class="text-success fw-medium">Gratis</span>' : '$' + envio.toLocaleString('es-CO')) +
    '</span></div>' +
    '<div class="d-flex justify-content-between fw-bold pt-2 border-top mt-1">' +
    '<span>Total</span><span class="text-primary" style="font-size:1.1rem">$' + total.toLocaleString('es-CO') + '</span></div></div>';

  const footer = document.getElementById('mdp-footer');
  let footerHtml = '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cerrar</button>';
  if (contexto === 'vendedor') {
    if (pedido.estado === 'pendiente') {
      footerHtml = '<button class="btn btn-success" onclick="procesarPedido(' + pedido.id_pedido + '); bootstrap.Modal.getInstance(document.getElementById(\'modalDetallePedido\'))?.hide()">' +
        '<span class="material-symbols-outlined icon-sm me-1">inventory</span>Procesar pedido</button>' + footerHtml;
    } else if (pedido.estado === 'procesando') {
      footerHtml = '<button class="btn btn-primary" onclick="marcarEnviado(' + pedido.id_pedido + '); bootstrap.Modal.getInstance(document.getElementById(\'modalDetallePedido\'))?.hide()">' +
        '<span class="material-symbols-outlined icon-sm me-1">local_shipping</span>Marcar enviado</button>' + footerHtml;
    }
  } else if (contexto === 'comprador') {
    if (pedido.estado === 'enviado') {
      footerHtml = '<button class="btn btn-success" onclick="marcarRecibido(' + pedido.id_pedido + '); bootstrap.Modal.getInstance(document.getElementById(\'modalDetallePedido\'))?.hide()">' +
        '<span class="material-symbols-outlined icon-sm me-1">done_all</span>Confirmar recepción</button>' + footerHtml;
    } else if (pedido.estado === 'entregado' && detalles.length > 0) {
      footerHtml = '<button class="btn btn-warning" onclick="abrirModalResenaBtn(' + pedido.id_pedido + '); bootstrap.Modal.getInstance(document.getElementById(\'modalDetallePedido\'))?.hide()">' +
        '<span class="material-symbols-outlined icon-sm me-1">star</span>Dejar reseña</button>' + footerHtml;
    }
  }
  footer.innerHTML = footerHtml;

  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalDetallePedido')).show();
}

// ── Reportes ──────────────────────────────────────────────────────────────────

const ESTADO_REPORTE_BADGE = {
  pendiente:  'bg-warning text-dark',
  en_revision: 'bg-info text-dark',
  atendido:   'bg-success',
  cerrado:    'bg-secondary',
  rechazado:  'bg-danger',
};

async function cargarReportesAdmin() {
  const container = document.getElementById('lista-reportes');
  container.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;

  const res = await apiFetch(`${API}/reportes`);
  if (!res) {
    container.innerHTML = `<div class="alert alert-danger m-3">Error al cargar reportes.</div>`;
    return;
  }
  const data = await res.json();
  const reportes = data.reportes || [];

  if (!reportes.length) {
    container.innerHTML = `<div class="text-center py-5 text-muted">
      <span class="material-symbols-outlined icon-lg">flag</span>
      <p class="mt-2">No hay reportes registrados.</p>
    </div>`;
    return;
  }

  const DEST_LABEL = { admin: 'Admin', vendedor: 'Vendedor', ambos: 'Ambos' };

  container.innerHTML = reportes.map(r => {
    const estadoBadgeClass = ESTADO_REPORTE_BADGE[(r.estado || '').toLowerCase()] || 'bg-secondary';
    const fecha = r.fecha_creacion
      ? new Date(r.fecha_creacion).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    const rolLabel = { comprador: 'Comprador', emprendedor: 'Vendedor', administrador: 'Admin' }[r.rol_usuario] || r.rol_usuario || '';
    const destLabel  = DEST_LABEL[r.tipo_destinatario] || 'Admin';
    const tiendaInfo = r.nombre_tienda ? ` (${r.nombre_tienda})` : '';
    const id = r.id_reporte || r._id;

    return `
    <div class="border-bottom p-3">
      <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div class="flex-grow-1">
          <!-- Cabecera: quién, cuándo -->
          <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <span class="fw-semibold small">${r.usuario_nombre || 'Usuario'}</span>
            <span class="badge bg-light text-dark border" style="font-size:.7rem">${rolLabel}</span>
            <span class="badge bg-secondary" style="font-size:.75rem">${r.motivo || '—'}</span>
            <span class="badge ${estadoBadgeClass}" style="font-size:.75rem">${r.estado || '—'}</span>
            <span class="text-muted" style="font-size:.72rem">→ Para: ${destLabel}${tiendaInfo}</span>
          </div>
          <!-- Descripción -->
          <p class="mb-1 small text-dark">${r.descripcion || '—'}</p>
          <!-- Respuesta si existe -->
          ${r.respuesta_admin ? `<div class="mt-1 p-2 rounded small" style="background:#f0fdf4;border-left:3px solid #16a34a">
            <span class="fw-semibold text-success">Tu respuesta:</span> ${r.respuesta_admin}
          </div>` : ''}
        </div>
        <div class="d-flex flex-column align-items-end gap-2 flex-shrink-0">
          <span class="text-muted small">${fecha}</span>
          <div class="dropdown">
            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">Acción</button>
            <ul class="dropdown-menu dropdown-menu-end" style="min-width:220px">
              <li><span class="dropdown-item-text small fw-semibold text-muted">Cambiar estado</span></li>
              <li><a class="dropdown-item small" href="#" onclick="cambiarEstadoReporte('${id}','en_revision');return false">
                🔍 En revisión</a></li>
              <li><a class="dropdown-item small" href="#" onclick="cambiarEstadoReporte('${id}','atendido');return false">
                ✅ Atendido</a></li>
              <li><a class="dropdown-item small" href="#" onclick="cambiarEstadoReporte('${id}','cerrado');return false">
                🔒 Cerrado</a></li>
              <li><a class="dropdown-item small" href="#" onclick="cambiarEstadoReporte('${id}','rechazado');return false">
                ❌ Rechazado</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><a class="dropdown-item small" href="#" onclick="responderReporte('${id}');return false">
                💬 Añadir respuesta</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function cambiarEstadoReporte(id, estado) {
  const res = await apiFetch(`${API}/reportes/${id}/estado`, {
    method: 'POST',
    body: JSON.stringify({ estado }),
  });
  if (!res) return;
  const data = await res.json();
  toast(data.message || (data.success ? 'Estado actualizado' : 'Error'), data.success ? 'success' : 'danger');
  if (data.success) cargarReportesAdmin();
}

async function responderReporte(id) {
  const respuesta = prompt('Escribe tu respuesta para el usuario (se le notificará):');
  if (!respuesta?.trim()) return;
  const res = await apiFetch(`${API}/reportes/${id}/estado`, {
    method: 'POST',
    body: JSON.stringify({ estado: 'atendido', respuesta: respuesta.trim() }),
  });
  if (!res) return;
  const data = await res.json();
  toast(data.success ? 'Respuesta enviada y notificada al usuario.' : data.message, data.success ? 'success' : 'danger');
  if (data.success) cargarReportesAdmin();
}

// ── Notificaciones (offcanvas) ────────────────────────────────────────────────

function _notifIcono(tipo) {
  const m = { sistema: 'info', pedido: 'receipt_long', tienda: 'store', reporte: 'flag', pago: 'payments', mensaje: 'chat' };
  return m[tipo] || 'notifications';
}

async function cargarNotificaciones() {
  const container = document.getElementById('listaNotificaciones');
  if (!container) return;
  container.innerHTML = `<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm text-primary"></div></div>`;

  const res = await apiFetch(`${API}/notificaciones`);
  if (!res) {
    container.innerHTML = `<div class="alert alert-danger m-3 small">Error al cargar notificaciones.</div>`;
    return;
  }
  const data = await res.json();
  const notifs = data.notificaciones || [];

  if (!notifs.length) {
    container.innerHTML = `<div class="text-center py-5 text-muted">
      <span class="material-symbols-outlined" style="font-size:40px">notifications_off</span>
      <p class="mt-2 small">Sin notificaciones nuevas.</p>
    </div>`;
    actualizarBadgeNotif();
    return;
  }

  container.innerHTML = notifs.map(n => {
    const fechaStr = n.fecha_creacion
      ? new Date(n.fecha_creacion).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
      : '';
    const clsBg = !n.leida ? 'border-start border-danger border-3 bg-light' : '';
    const icono = _notifIcono(n.tipo);
    const nuevoBadge = !n.leida ? `<span class="badge bg-danger ms-1" style="font-size:.6rem;padding:2px 5px">Nuevo</span>` : '';
    return `
    <div class="p-3 border-bottom" style="cursor:default;${!n.leida ? 'background:#fff5f5' : ''}">
      <div class="d-flex align-items-start gap-2">
        <span class="material-symbols-outlined text-danger mt-1 flex-shrink-0" style="font-size:20px">${icono}</span>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-start gap-1">
            <span class="fw-medium small">${n.titulo}${nuevoBadge}</span>
            <button class="btn btn-sm p-0 text-danger flex-shrink-0" onclick="eliminarNotif(${n.id_notificacion})" title="Eliminar">
              <span class="material-symbols-outlined" style="font-size:16px">close</span>
            </button>
          </div>
          <p class="mb-1 small text-muted">${n.mensaje}</p>
          <div class="d-flex justify-content-between align-items-center">
            <span class="text-muted" style="font-size:.7rem">${fechaStr}</span>
            ${!n.leida
              ? `<button class="btn btn-sm p-0 text-danger" style="font-size:.75rem;line-height:1.2"
                   onclick="marcarLeidaNotif(${n.id_notificacion})">
                   <span class="material-symbols-outlined align-middle" style="font-size:14px">done</span> Leída
                 </button>`
              : ''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  actualizarBadgeNotif();
}

async function marcarLeidaNotif(id) {
  await apiFetch(`${API}/notificaciones/${id}/marcar-leida`, { method: 'POST' });
  cargarNotificaciones();
}

async function marcarTodasLeidasNotif() {
  await apiFetch(`${API}/notificaciones/marcar-todas-leidas`, { method: 'POST' });
  cargarNotificaciones();
}

async function eliminarNotif(id) {
  await apiFetch(`${API}/notificaciones/${id}`, { method: 'DELETE' });
  cargarNotificaciones();
}

async function actualizarBadgeNotif() {
  const res = await apiFetch(`${API}/notificaciones/no-leidas`);
  if (!res) return;
  const data = await res.json();
  const count = data.count || 0;
  const badge = document.getElementById('badgeNotif');
  if (badge) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.classList.toggle('d-none', count === 0);
  }
}

// ── Usuarios ──────────────────────────────────────────────────────────────────

let _debounceTimer = null;
function debounceCargarUsuarios() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(cargarUsuarios, 400);
}

async function cargarUsuarios() {
  const container = document.getElementById('lista-usuarios');
  container.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div></div>`;

  const rol    = document.getElementById('filtroRolUsuarios')?.value  || '';
  const estado = document.getElementById('filtroEstadoUsuarios')?.value || '';
  const buscar = document.getElementById('buscarUsuario')?.value       || '';

  const params = new URLSearchParams();
  if (rol)    params.set('rol', rol);
  if (estado) params.set('estado', estado);
  if (buscar) params.set('buscar', buscar);

  const res = await apiFetch(`${API}/admin/usuarios?${params}`);
  if (!res) { container.innerHTML = `<div class="alert alert-danger m-3">Error al cargar usuarios.</div>`; return; }
  const data = await res.json();
  const usuarios = data.usuarios || [];

  if (!usuarios.length) {
    container.innerHTML = `<div class="text-center py-5 text-muted">
      <span class="material-symbols-outlined icon-lg">group_off</span>
      <p class="mt-2">No se encontraron usuarios con esos filtros.</p>
    </div>`;
    return;
  }

  const ROL_LABEL  = { comprador: 'Comprador', emprendedor: 'Vendedor', administrador: 'Admin' };
  const ROL_BADGE  = { comprador: 'bg-success', emprendedor: 'bg-warning text-dark', administrador: 'bg-danger' };
  const EST_BADGE  = { activo: 'bg-success', suspendido: 'bg-danger', inactivo: 'bg-secondary' };

  container.innerHTML = `<div class="table-responsive">
    <table class="table table-hover align-middle mb-0">
      <thead class="table-light">
        <tr>
          <th>ID</th><th>Nombre</th><th>Correo</th><th>Cédula</th>
          <th>Rol</th><th>Estado</th><th>Último acceso</th><th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${usuarios.map(u => {
          const rolBadge = ROL_BADGE[u.rol] || 'bg-secondary';
          const rolLabel = ROL_LABEL[u.rol]  || u.rol;
          const estNorm  = (u.estado || 'activo').toLowerCase();
          const estBadge = EST_BADGE[estNorm]  || 'bg-secondary';
          const acceso   = u.ultimo_acceso
            ? new Date(u.ultimo_acceso).toLocaleDateString('es-CO')
            : 'Nunca';
          const esAdmin  = u.rol === 'administrador';

          let acciones = '';
          if (!esAdmin) {
            if (estNorm === 'suspendido') {
              acciones = `<button class="btn btn-success btn-sm" onclick="cambiarEstadoUsuario(${u.id_usuario}, 'activo')" title="Activar">
                <span class="material-symbols-outlined icon-sm">check_circle</span> Activar
              </button>`;
            } else {
              acciones = `<button class="btn btn-warning btn-sm" onclick="cambiarEstadoUsuario(${u.id_usuario}, 'suspendido')" title="Suspender">
                <span class="material-symbols-outlined icon-sm">block</span> Suspender
              </button>`;
            }
          } else {
            acciones = `<span class="text-muted small">—</span>`;
          }

          return `<tr>
            <td class="text-muted small">#${u.id_usuario}</td>
            <td class="fw-medium">${u.nombre || ''} ${u.apellido || ''}</td>
            <td class="small">${u.correo || '—'}</td>
            <td class="small text-muted">${u.cedula || '—'}</td>
            <td><span class="badge ${rolBadge}">${rolLabel}</span></td>
            <td><span class="badge ${estBadge}">${estNorm}</span></td>
            <td class="small text-muted">${acceso}</td>
            <td>${acciones}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

async function cambiarEstadoUsuario(id, estado) {
  const etiq = estado === 'suspendido' ? 'suspender' : 'activar';
  if (!confirm(`¿${etiq} este usuario?`)) return;
  const res = await apiFetch(`${API}/admin/usuarios/${id}/estado`, {
    method: 'POST',
    body: JSON.stringify({ estado }),
  });
  if (!res) return;
  const data = await res.json();
  toast(data.message || (data.success ? 'Usuario actualizado.' : 'Error'), data.success ? 'success' : 'danger');
  if (data.success) cargarUsuarios();
}

// Inicializar
cargarDashboard();
actualizarBadgeNotif();
setInterval(actualizarBadgeNotif, 30000);

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.innerWidth <= 768) {
      const topbar = document.createElement('div');
      topbar.className = 'mobile-topbar';
      topbar.innerHTML = `
        <button class="btn btn-sm" onclick="toggleSidebar()">
          <span class="material-symbols-outlined">menu</span>
        </button>
        <span class="fw-bold" style="font-size:.95rem;color:var(--primary)">EmprendeMarket</span>`;
      document.getElementById('main-content')?.prepend(topbar);

      document.getElementById('sidebar')?.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', closeMobileSidebar);
      });
    }
  });
}

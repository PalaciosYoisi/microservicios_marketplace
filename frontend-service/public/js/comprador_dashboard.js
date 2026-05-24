const usuario = protegerPagina(['comprador']);
if (usuario) {
  document.getElementById('nombreUsuario').textContent = `${usuario.nombre} ${usuario.apellido}`;
  const fotoSidebar = document.getElementById('fotoSidebar');
  if (fotoSidebar && usuario.foto_perfil) {
    fotoSidebar.src = usuario.foto_perfil;
    fotoSidebar.classList.remove('d-none');
    document.getElementById('iconoSidebar')?.classList.add('d-none');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

function mostrarSeccion(sec) {
  ['dashboard', 'pedidos', 'reportes', 'perfil'].forEach(s => {
    const el = document.getElementById(`sec-${s}`);
    if (el) el.classList.add('d-none');
  });
  const target = document.getElementById(`sec-${sec}`);
  if (target) target.classList.remove('d-none');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  if (sec === 'pedidos')  cargarPedidos();
  if (sec === 'reportes') cargarReportesC();
  if (sec === 'perfil')   cargarPerfilC();
}

function toast(msg, tipo = 'success') {
  const el = document.getElementById('toast');
  el.className = `alert alert-${tipo} position-fixed bottom-0 end-0 m-3 shadow-strong`;
  el.textContent = msg;
  el.classList.remove('d-none');
  setTimeout(() => el.classList.add('d-none'), 3500);
}

function estadoBadge(estado) {
  const map = {
    pendiente: 'bg-warning text-dark', procesando: 'bg-info text-dark',
    enviado: 'bg-primary', entregado: 'bg-success', cancelado: 'bg-danger',
  };
  return map[estado] || 'bg-secondary';
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

async function cargarDashboard() {
  try {
    const [resPed, resFav] = await Promise.all([
      apiFetch(`${API}/comprador/pedidos`),
      apiFetch(`${API}/favoritos`),
    ]);

    const dataPed = resPed ? await resPed.json() : {};
    const dataFav = resFav ? await resFav.json() : {};

    const pedidos   = dataPed.pedidos   || [];
    const favoritos = dataFav.favoritos || [];

    const entregados = pedidos.filter(p => p.estado === 'entregado').length;
    const gastado    = pedidos
      .filter(p => ['procesando', 'enviado', 'entregado'].includes(p.estado))
      .reduce((s, p) => s + (p.total || 0), 0);

    document.getElementById('statPedidos').textContent    = pedidos.length;
    document.getElementById('statFavoritos').textContent  = favoritos.length;
    document.getElementById('statEntregados').textContent = entregados;
    document.getElementById('statGastado').textContent    = `$${gastado.toLocaleString('es-CO')}`;

    // Badge favoritos en sidebar
    if (favoritos.length > 0) {
      const b = document.getElementById('badgeFav');
      if (b) { b.textContent = favoritos.length; b.classList.remove('d-none'); }
    }

    renderPedidosRecientes(pedidos.slice(0, 5));
  } catch (err) {
    console.error('[comprador] Error cargando dashboard:', err);
  }
}

function renderPedidosRecientes(pedidos) {
  const container = document.getElementById('pedidosRecientes');
  if (!pedidos.length) {
    container.innerHTML = `<div class="text-center py-5 text-muted">
      <span class="material-symbols-outlined icon-xl">receipt_long</span>
      <p class="mt-2">No tienes pedidos aún.</p>
      <a href="/marketplace" class="btn btn-primary btn-sm mt-2">Explorar Marketplace</a>
    </div>`;
    return;
  }
  container.innerHTML = `<div class="table-responsive">
    <table class="table table-hover align-middle mb-0">
      <thead class="table-light">
        <tr><th>ID</th><th>Fecha</th><th>Total</th><th>Estado</th><th></th></tr>
      </thead>
      <tbody>
        ${pedidos.map(p => {
          let accion = '';
          if (p.estado === 'enviado') {
            accion = `<button class="btn btn-sm btn-outline-success" onclick="marcarRecibido(${p.id_pedido})">Recibido</button>`;
          } else if (p.estado === 'entregado' && p.detalles?.length) {
            accion = `<button class="btn btn-sm btn-outline-warning" onclick="abrirModalResenaBtn(${p.id_pedido})" title="Dejar reseña">
              <span class="material-symbols-outlined icon-sm">star</span>
            </button>`;
          }
          return `<tr>
            <td class="text-muted small">#${p.id_pedido}</td>
            <td class="small">${new Date(p.fecha_pedido).toLocaleDateString('es-CO')}</td>
            <td class="fw-medium text-primary">$${(p.total || 0).toLocaleString('es-CO')}</td>
            <td><span class="badge ${estadoBadge(p.estado)}">${p.estado}</span></td>
            <td>${accion}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

// ── Pedidos ───────────────────────────────────────────────────────────────────

let pedidosData = []; // Cache de pedidos para acceder a detalles en el modal de reseña

async function cargarPedidos() {
  const container = document.getElementById('listaPedidos');
  container.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div></div>`;

  const res = await apiFetch(`${API}/comprador/pedidos`);
  if (!res) return;
  const data = await res.json();
  pedidosData = data.pedidos || [];

  if (!pedidosData.length) {
    container.innerHTML = `<div class="text-center py-5 text-muted">
      <span class="material-symbols-outlined icon-xl">receipt_long</span>
      <p class="mt-2">No tienes pedidos aún.</p>
      <a href="/marketplace" class="btn btn-primary btn-sm mt-2">Explorar Marketplace</a>
    </div>`;
    return;
  }

  container.innerHTML = `<div class="table-responsive">
    <table class="table table-hover align-middle mb-0">
      <thead class="table-light">
        <tr><th>ID</th><th>Fecha</th><th>Total</th><th>Método</th><th>Estado</th><th>Acciones</th></tr>
      </thead>
      <tbody>
        ${pedidosData.map(p => {
          let accion = '<span class="text-muted small">—</span>';
          if (p.estado === 'enviado') {
            accion = `<button class="btn btn-sm btn-outline-success" onclick="marcarRecibido(${p.id_pedido})">
              <span class="material-symbols-outlined icon-sm me-1">done_all</span>Recibido
            </button>`;
          } else if (p.estado === 'entregado' && p.detalles?.length) {
            accion = `<button class="btn btn-sm btn-outline-warning" onclick="abrirModalResenaBtn(${p.id_pedido})" title="Dejar reseña">
              <span class="material-symbols-outlined icon-sm me-1">star</span>Reseñar
            </button>`;
          }
          return `<tr>
            <td class="text-muted small">#${p.id_pedido}</td>
            <td class="small">${new Date(p.fecha_pedido).toLocaleDateString('es-CO')}</td>
            <td class="fw-medium text-primary">$${(p.total || 0).toLocaleString('es-CO')}</td>
            <td class="small text-muted">${p.metodo_pago || '—'}</td>
            <td><span class="badge ${estadoBadge(p.estado)}">${p.estado}</span></td>
            <td>${accion}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

async function marcarRecibido(id) {
  const res = await apiFetch(`${API}/comprador/pedidos/${id}/marcar-recibido`, { method: 'POST' });
  if (!res) return;
  const data = await res.json();
  toast(data.message || (data.success ? '¡Pedido recibido!' : 'Error'), data.success ? 'success' : 'danger');
  if (data.success) {
    cargarDashboard();
    const sec = document.getElementById('sec-pedidos');
    if (sec && !sec.classList.contains('d-none')) cargarPedidos();

    // Abrir modal de reseña si hay detalles
    const detalles = data.detalles || [];
    if (detalles.length > 0) {
      setTimeout(() => abrirModalResena(id, detalles), 800);
    }
  }
}

// ── Reseñas ───────────────────────────────────────────────────────────────────

let resenaActual = { id_pedido: null, detalles: [] };
let fotoResena   = null;

async function abrirModalResenaBtn(id_pedido) {
  // Intentar desde caché primero
  const cached = pedidosData.find(p => p.id_pedido === id_pedido);
  if (cached && cached.detalles?.length) {
    abrirModalResena(id_pedido, cached.detalles);
    return;
  }
  // Consultar API
  const res = await apiFetch(`${API}/comprador/pedidos/${id_pedido}`);
  if (!res) return;
  const data = await res.json();
  if (data.success && data.pedido?.detalles?.length) {
    abrirModalResena(id_pedido, data.pedido.detalles);
  }
}

function abrirModalResena(id_pedido, detalles) {
  resenaActual = { id_pedido, detalles };
  fotoResena   = null;

  // Selector de producto
  const sel = document.getElementById('resenaProductoSel');
  if (sel) {
    sel.innerHTML = detalles.map(d =>
      `<option value="${d.id_producto}">${d.nombre_producto}${d.talla ? ` — Talla: ${d.talla}` : ''}</option>`
    ).join('');
    // Ocultar selector si solo hay 1 producto
    const wrap = document.getElementById('resenaProductoWrap');
    if (wrap) wrap.classList.toggle('d-none', detalles.length <= 1);
  }

  // Reset formulario
  document.getElementById('formResena')?.reset();
  seleccionarEstrella(0);
  document.getElementById('resenaPrevFoto')?.classList.add('d-none');
  document.getElementById('alertResena')?.classList.add('d-none');

  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalResena')).show();
}

function seleccionarEstrella(val) {
  document.getElementById('estrellasValor').value = val;
  document.querySelectorAll('.estrella-btn').forEach((s, i) => {
    s.textContent = i < val ? '★' : '☆';
    s.classList.toggle('activa', i < val);
  });
}

function previsualizarFotoResena(input) {
  const file = input.files[0];
  if (!file) return;
  fotoResena = file;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('resenaPrevFoto');
    if (img) { img.src = e.target.result; img.classList.remove('d-none'); }
  };
  reader.readAsDataURL(file);
}

async function enviarResena(e) {
  e.preventDefault();
  const alertEl = document.getElementById('alertResena');
  alertEl.classList.add('d-none');

  const calificacion = parseInt(document.getElementById('estrellasValor').value);
  if (!calificacion || calificacion < 1) {
    alertEl.className = 'alert alert-warning mt-2 mb-0';
    alertEl.textContent = 'Por favor selecciona una calificación con estrellas.';
    alertEl.classList.remove('d-none');
    return;
  }

  const id_producto = document.getElementById('resenaProductoSel')?.value
    || resenaActual.detalles[0]?.id_producto;

  if (!id_producto) {
    alertEl.className = 'alert alert-warning mt-2 mb-0';
    alertEl.textContent = 'No se encontró el producto para la reseña.';
    alertEl.classList.remove('d-none');
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  const textoOrig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';

  try {
    // 1. Subir foto si hay una
    let foto_url = '';
    if (fotoResena) {
      const fd = new FormData();
      fd.append('foto', fotoResena);
      const uploadRes = await apiFetch(`${API}/resenas/upload-foto`, { method: 'POST', body: fd });
      if (uploadRes) {
        const uploadData = await uploadRes.json();
        if (uploadData.success) foto_url = uploadData.url;
      }
    }

    // 2. Enviar reseña
    const res = await apiFetch(`${API}/resenas`, {
      method: 'POST',
      body: JSON.stringify({
        id_producto,
        calificacion,
        comentario: document.getElementById('resenaComentario')?.value || '',
        foto_url,
      }),
    });

    if (!res) throw new Error('Sin conexión con el servidor.');
    const data = await res.json();

    if (data.success) {
      bootstrap.Modal.getInstance(document.getElementById('modalResena'))?.hide();
      toast('¡Gracias por tu reseña! 🌟', 'success');
      fotoResena = null;
    } else {
      alertEl.className = 'alert alert-danger mt-2 mb-0';
      alertEl.textContent = data.message || 'Error al enviar la reseña.';
      alertEl.classList.remove('d-none');
    }
  } catch (err) {
    alertEl.className = 'alert alert-danger mt-2 mb-0';
    alertEl.textContent = 'Error: ' + err.message;
    alertEl.classList.remove('d-none');
  } finally {
    btn.disabled = false;
    btn.innerHTML = textoOrig;
  }
}

// ── Favoritos (offcanvas) ─────────────────────────────────────────────────────

async function cargarFavoritosPanel() {
  const container = document.getElementById('listaFavoritos');
  if (!container) return;
  container.innerHTML = `<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm text-primary"></div></div>`;

  const res = await apiFetch(`${API}/favoritos`);
  if (!res) { container.innerHTML = `<div class="alert alert-danger m-3 small">Error al cargar favoritos.</div>`; return; }
  const data = await res.json();
  const favs = data.favoritos || [];

  if (!favs.length) {
    container.innerHTML = `<div class="text-center py-5 text-muted">
      <span class="material-symbols-outlined" style="font-size:48px">favorite_border</span>
      <p class="mt-2 small">No tienes favoritos aún.</p>
      <a href="/marketplace" class="btn btn-primary btn-sm mt-2" data-bs-dismiss="offcanvas">Explorar Marketplace</a>
    </div>`;
    return;
  }

  container.innerHTML = `<div class="p-3 d-flex flex-column gap-3">
    ${favs.map(f => `
    <div class="card shadow-soft fav-card-item" id="favItem-${f.id_producto}">
      <div class="row g-0">
        <div class="col-4">
          <img src="${f.imagen_url || '/img/no-image.png'}" class="img-fluid h-100 rounded-start"
               style="object-fit:cover;max-height:100px" onerror="this.src='/img/no-image.png'">
        </div>
        <div class="col-8">
          <div class="card-body p-2">
            <h6 class="card-title small fw-bold mb-1 text-truncate">${f.nombre_producto}</h6>
            <p class="text-primary fw-bold mb-2 small">$${(f.precio || 0).toLocaleString('es-CO')}</p>
            <div class="d-flex gap-1">
              <a href="/producto/${f.id_producto}" class="btn btn-primary btn-sm flex-grow-1" data-bs-dismiss="offcanvas">
                <span class="material-symbols-outlined icon-sm">visibility</span> Ver
              </a>
              <button class="btn btn-outline-danger btn-sm" onclick="quitarFavoritoPanel(${f.id_producto})" title="Quitar de favoritos">
                <span class="material-symbols-outlined icon-sm">heart_minus</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`).join('')}
  </div>`;
}

async function quitarFavoritoPanel(id) {
  const res = await apiFetch(`${API}/favoritos/${id}`, { method: 'DELETE' });
  if (!res) return;
  const data = await res.json();
  if (data.success) {
    document.getElementById(`favItem-${id}`)?.remove();
    const remaining = document.querySelectorAll('#listaFavoritos [id^="favItem-"]').length;
    const badge = document.getElementById('badgeFav');
    if (badge) {
      if (remaining === 0) {
        badge.classList.add('d-none');
        document.getElementById('listaFavoritos').innerHTML = `<div class="text-center py-5 text-muted">
          <span class="material-symbols-outlined" style="font-size:48px">favorite_border</span>
          <p class="mt-2 small">No tienes favoritos aún.</p>
        </div>`;
      } else {
        badge.textContent = remaining;
      }
    }
    // Update stats
    const stat = document.getElementById('statFavoritos');
    if (stat) stat.textContent = remaining;
  }
}

// ── Perfil ────────────────────────────────────────────────────────────────────

let fotoPendingC = null;

async function cargarPerfilC() {
  const res = await apiFetch(`${API}/auth/me`);
  if (!res) return;
  const data = await res.json();
  if (!data.success) return;
  const u = data.usuario;

  document.getElementById('perfilNombreC').value   = u.nombre   || '';
  document.getElementById('perfilApellidoC').value = u.apellido || '';
  document.getElementById('perfilCorreoC').value   = u.correo   || '';
  document.getElementById('perfilCedulaC').value   = u.cedula   || '';
  document.getElementById('perfilTelefonoC').value = u.telefono || '';

  const img = document.getElementById('fotoActualC');
  if (u.foto_perfil) { img.src = u.foto_perfil; img.classList.remove('d-none'); }

  const fotoSidebar = document.getElementById('fotoSidebar');
  if (fotoSidebar && u.foto_perfil) {
    fotoSidebar.src = u.foto_perfil;
    fotoSidebar.classList.remove('d-none');
    document.getElementById('iconoSidebar')?.classList.add('d-none');
  }
}

function previsualizarFotoC(input) {
  const file = input.files[0];
  if (!file) return;
  fotoPendingC = file;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('fotoActualC');
    img.src = e.target.result;
    img.classList.remove('d-none');
  };
  reader.readAsDataURL(file);
}

async function guardarPerfilC(e) {
  e.preventDefault();
  const alertEl = document.getElementById('perfilAlertC');
  alertEl.classList.add('d-none');

  if (fotoPendingC) {
    const fd = new FormData();
    fd.append('foto', fotoPendingC);
    const r = await apiFetch(`${API}/auth/perfil/foto`, { method: 'POST', body: fd });
    if (r) {
      const d = await r.json();
      if (d.success) {
        const fotoSidebar = document.getElementById('fotoSidebar');
        if (fotoSidebar) { fotoSidebar.src = d.url; fotoSidebar.classList.remove('d-none'); }
      }
    }
    fotoPendingC = null;
  }

  const res = await apiFetch(`${API}/auth/perfil`, {
    method: 'PUT',
    body: JSON.stringify({
      nombre:   document.getElementById('perfilNombreC').value,
      apellido: document.getElementById('perfilApellidoC').value,
      cedula:   document.getElementById('perfilCedulaC').value,
      telefono: document.getElementById('perfilTelefonoC').value,
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

// ── Reportes ─────────────────────────────────────────────────────────────────

const REPORTE_BADGE_C = {
  pendiente:   'bg-warning text-dark',
  en_revision: 'bg-info text-dark',
  atendido:    'bg-success',
  cerrado:     'bg-secondary',
  rechazado:   'bg-danger',
};

let vendedoresCache = [];

// Muestra u oculta el selector de tienda según destinatario
function cambiarDestinatario(valor) {
  const selector = document.getElementById('selectorTienda');
  if (valor === 'vendedor' || valor === 'ambos') {
    selector.classList.remove('d-none');
    if (!vendedoresCache.length) cargarVendedoresC();
  } else {
    selector.classList.add('d-none');
  }
}

async function cargarVendedoresC() {
  const sel = document.getElementById('tiendaReporteC');
  if (!sel) return;
  sel.innerHTML = '<option value="">Cargando...</option>';

  const res = await apiFetch(`${API}/comprador/mis-vendedores`);
  if (!res) {
    sel.innerHTML = '<option value="">No se pudo cargar</option>';
    return;
  }
  const data = await res.json();
  vendedoresCache = data.vendedores || [];

  if (!vendedoresCache.length) {
    sel.innerHTML = '<option value="">No tienes compras anteriores</option>';
    return;
  }
  sel.innerHTML = '<option value="">Selecciona una tienda</option>' +
    vendedoresCache.map(v =>
      `<option value="${v.id_tienda}" data-nombre="${v.nombre_tienda}">${v.nombre_tienda}</option>`
    ).join('');
}

async function cargarReportesC() {
  const container = document.getElementById('listaReportesC');
  container.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-warning spinner-border-sm"></div></div>`;

  const res = await apiFetch(`${API}/reportes`);
  if (!res) { container.innerHTML = `<div class="alert alert-danger m-3">Error al cargar reportes.</div>`; return; }
  const data = await res.json();
  const reportes = data.reportes || [];

  if (!reportes.length) {
    container.innerHTML = `<div class="text-center py-5 text-muted">
      <span class="material-symbols-outlined icon-lg">flag</span>
      <p class="mt-2">No has enviado reportes aún.</p>
    </div>`;
    return;
  }

  const DEST_LABEL = { admin: 'Administrador', vendedor: 'Vendedor', ambos: 'Ambos' };

  container.innerHTML = reportes.map(r => {
    const badge      = REPORTE_BADGE_C[(r.estado || '').toLowerCase()] || 'bg-secondary';
    const fecha      = r.fecha_creacion
      ? new Date(r.fecha_creacion).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    const destLabel  = DEST_LABEL[r.tipo_destinatario] || 'Administrador';
    const tiendaInfo = r.nombre_tienda ? ` — ${r.nombre_tienda}` : '';
    const respuesta  = r.respuesta_admin
      ? `<div class="mt-2 p-2 rounded small" style="background:#f0fdf4;border-left:3px solid #16a34a">
           <span class="fw-semibold text-success">Respuesta:</span> ${r.respuesta_admin}
         </div>` : '';

    return `
    <div class="border-bottom p-3">
      <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div class="flex-grow-1">
          <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <span class="badge bg-secondary">${r.motivo || '—'}</span>
            <span class="badge border text-muted" style="font-size:.7rem">
              Para: ${destLabel}${tiendaInfo}
            </span>
            <span class="badge ${badge}">${r.estado || '—'}</span>
          </div>
          <p class="mb-1 small text-dark">${r.descripcion || '—'}</p>
          ${respuesta}
        </div>
        <div class="text-muted small text-end flex-shrink-0" style="min-width:90px">${fecha}</div>
      </div>
    </div>`;
  }).join('');
}

async function enviarReporteC(e) {
  e.preventDefault();
  const alertEl = document.getElementById('alertaReporteC');
  alertEl.classList.add('d-none');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  const tipoDestino = document.querySelector('input[name="destReporte"]:checked')?.value || 'admin';
  const selTienda   = document.getElementById('tiendaReporteC');
  const idTienda    = selTienda?.value || null;
  const nombreTienda = selTienda?.options[selTienda?.selectedIndex]?.dataset.nombre || '';

  // Validar que seleccionó tienda si es necesario
  if ((tipoDestino === 'vendedor' || tipoDestino === 'ambos') && !idTienda) {
    alertEl.className = 'alert alert-warning mt-3 mb-0';
    alertEl.textContent = 'Selecciona una tienda para enviarle el reporte.';
    alertEl.classList.remove('d-none');
    btn.disabled = false;
    return;
  }

  const res = await apiFetch(`${API}/reportes`, {
    method: 'POST',
    body: JSON.stringify({
      motivo:            document.getElementById('motivoReporteC').value,
      descripcion:       document.getElementById('descReporteC').value,
      tipo_destinatario: tipoDestino,
      id_tienda:         idTienda   || undefined,
      nombre_tienda:     nombreTienda || undefined,
    }),
  });

  btn.disabled = false;
  if (!res) return;
  const data = await res.json();
  alertEl.className = `alert alert-${data.success ? 'success' : 'danger'} mt-3 mb-0`;
  alertEl.textContent = data.message || (data.success ? 'Reporte enviado correctamente.' : 'Error al enviar.');
  alertEl.classList.remove('d-none');
  if (data.success) {
    document.getElementById('formReporteC').reset();
    document.getElementById('selectorTienda').classList.add('d-none');
    vendedoresCache = [];
    cargarReportesC();
    setTimeout(() => alertEl.classList.add('d-none'), 5000);
  }
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
  if (!res) { container.innerHTML = `<div class="alert alert-danger m-3 small">Error al cargar notificaciones.</div>`; return; }
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
    const clsBg    = !n.leida ? 'border-start border-primary border-3' : '';
    const bgStyle  = !n.leida ? 'background:#f0f5ff' : '';
    const icono    = _notifIcono(n.tipo);
    const nuevoBdg = !n.leida ? `<span class="badge bg-primary ms-1" style="font-size:.6rem;padding:2px 5px">Nuevo</span>` : '';
    return `
    <div class="p-3 border-bottom ${clsBg}" style="${bgStyle}">
      <div class="d-flex align-items-start gap-2">
        <span class="material-symbols-outlined text-primary mt-1 flex-shrink-0" style="font-size:20px">${icono}</span>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-start gap-1">
            <span class="fw-medium small">${n.titulo}${nuevoBdg}</span>
            <button class="btn btn-sm p-0 text-danger flex-shrink-0" onclick="eliminarNotif(${n.id_notificacion})" title="Eliminar">
              <span class="material-symbols-outlined" style="font-size:16px">close</span>
            </button>
          </div>
          <p class="mb-1 small text-muted">${n.mensaje}</p>
          <div class="d-flex justify-content-between align-items-center">
            <span class="text-muted" style="font-size:.7rem">${fechaStr}</span>
            ${!n.leida
              ? `<button class="btn btn-sm p-0 text-primary" style="font-size:.75rem;line-height:1.2"
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

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  cargarDashboard();
  actualizarBadgeNotif();
  setInterval(actualizarBadgeNotif, 30000);
});

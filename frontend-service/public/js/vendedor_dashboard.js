const usuario = protegerPagina(['emprendedor']);
if (usuario) {
  document.getElementById('nombreUsuario').textContent = `${usuario.nombre} ${usuario.apellido}`;
  // Foto de perfil en sidebar
  const fotoSidebar = document.getElementById('fotoSidebar');
  if (fotoSidebar && usuario.foto_perfil) {
    fotoSidebar.src = usuario.foto_perfil;
    fotoSidebar.classList.remove('d-none');
    document.getElementById('iconoSidebar')?.classList.add('d-none');
  }
}

let tiendaActual = null;
let productosActuales = [];

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

function mostrarSeccion(sec) {
  ['dashboard', 'productos', 'pedidos', 'tienda', 'reportes', 'mensajes', 'perfil'].forEach(s => {
    const el = document.getElementById(`sec-${s}`);
    if (el) el.classList.add('d-none');
  });
  const target = document.getElementById(`sec-${sec}`);
  if (target) target.classList.remove('d-none');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  if (sec === 'productos') cargarProductos();
  if (sec === 'pedidos')   cargarPedidos();
  if (sec === 'tienda')    cargarInfoTienda();
  if (sec === 'reportes')  cargarReportesV();
  if (sec === 'mensajes')  cargarMensajes();
  if (sec === 'perfil')    cargarPerfil();
}

function toast(msg, tipo = 'success') {
  const el = document.getElementById('toast');
  el.className = `alert alert-${tipo} position-fixed bottom-0 end-0 m-3 shadow-strong`;
  el.textContent = msg;
  el.classList.remove('d-none');
  setTimeout(() => el.classList.add('d-none'), 3500);
}

// ── Dashboard ────────────────────────────────────────────────────────────────

async function cargarDashboard() {
  try {
    const [resProd, resPed] = await Promise.all([
      apiFetch(`${API}/vendedor/productos`),
      apiFetch(`${API}/vendedor/pedidos`),
    ]);
    if (!resProd || !resPed) return;

    const dataProd = await resProd.json();
    const dataPed  = await resPed.json();

    tiendaActual      = dataProd.tienda;
    productosActuales = dataProd.productos || [];

    // Mostrar alerta de tienda
    const alertaTienda = document.getElementById('alertaTienda');
    if (!tiendaActual) {
      alertaTienda.classList.remove('d-none');
      alertaTienda.innerHTML = `<span class="material-symbols-outlined me-2">store</span>
        <strong>No tienes tienda registrada.</strong> Crea tu tienda para empezar a vender.
        <button class="btn btn-warning btn-sm ms-3" onclick="mostrarSeccion('tienda')">Crear tienda</button>`;
    } else if (tiendaActual.estado === 'pendiente') {
      alertaTienda.classList.remove('d-none');
      alertaTienda.className = 'alert alert-info';
      alertaTienda.innerHTML = `<span class="material-symbols-outlined me-2">hourglass_empty</span>
        <strong>Tu tienda está pendiente de aprobación.</strong> El administrador la revisará pronto. Mientras tanto, no podrás publicar productos.`;
    } else if (['inactiva', 'suspendida'].includes(tiendaActual.estado)) {
      alertaTienda.classList.remove('d-none');
      alertaTienda.className = 'alert alert-danger';
      alertaTienda.innerHTML = `<span class="material-symbols-outlined me-2">block</span>
        <strong>Tu tienda está ${tiendaActual.estado}.</strong> Contacta al administrador.`;
    } else {
      alertaTienda.classList.add('d-none');
    }

    const activos   = productosActuales.filter(p => ['activo','Activo'].includes(p.estado)).length;
    const stockBajo = productosActuales.filter(p => (p.stock || 0) < 5).length;
    const pedidos   = dataPed.pedidos || [];
    const ventas    = pedidos
      .filter(p => ['procesando','enviado','entregado'].includes(p.estado))
      .reduce((sum, p) => sum + (p.total || 0), 0);

    document.getElementById('statProductos').textContent = activos;
    document.getElementById('statPedidos').textContent   = pedidos.length;
    document.getElementById('statStockBajo').textContent = stockBajo;
    document.getElementById('statVentas').textContent    = `$${ventas.toLocaleString('es-CO')}`;
  } catch (err) {
    console.error('Error cargando dashboard:', err);
  }
}

// ── Productos ─────────────────────────────────────────────────────────────────

async function cargarProductos() {
  // Fetch primero para obtener tiendaActual fresco
  const res = await apiFetch(`${API}/vendedor/productos`);
  if (!res) return;
  const data = await res.json();
  tiendaActual      = data.tienda;          // ← siempre actualizar tiendaActual
  productosActuales = data.productos || [];

  const tiendaAprobada = tiendaActual && ['activa','activo'].includes((tiendaActual.estado||'').toLowerCase());

  const btnNuevo = document.getElementById('btnNuevoProducto');
  if (btnNuevo) {
    btnNuevo.disabled = !tiendaAprobada;
    btnNuevo.title = tiendaAprobada ? '' : 'Necesitas una tienda aprobada para crear productos';
  }

  const lista = document.getElementById('listaProductos');

  if (!tiendaAprobada) {
    lista.innerHTML = `<div class="col-12">
      <div class="alert alert-info">
        <span class="material-symbols-outlined me-2">info</span>
        ${!tiendaActual ? 'Crea y aprueba tu tienda para poder publicar productos.' : 'Tu tienda aún está pendiente de aprobación. Cuando sea aprobada, podrás publicar productos aquí.'}
      </div>
    </div>`;
    return;
  }

  if (!productosActuales.length) {
    lista.innerHTML = `<div class="col-12 text-center py-5 text-muted">
      <span class="material-symbols-outlined icon-xl">inventory_2</span>
      <p>No tienes productos aún. ¡Crea tu primer producto!</p>
    </div>`;
    return;
  }

  lista.innerHTML = productosActuales.map(p => `
    <div class="col-md-6 col-xl-4">
      <div class="card shadow-soft h-100">
        <img src="${p.imagen_url || '/images/no-image.svg'}"
             class="card-img-top" style="height:150px;object-fit:cover"
             onerror="this.src='/images/no-image.svg'">
        <div class="card-body">
          <h6 class="fw-bold">${p.nombre_producto}</h6>
          <div class="d-flex justify-content-between mb-2">
            <span class="text-primary fw-bold">$${Number(p.precio).toLocaleString('es-CO')}</span>
            <span class="badge ${(p.stock||0)<5?'bg-warning text-dark':'bg-success'}">Stock: ${p.stock??0}</span>
          </div>
          <span class="badge bg-secondary">${p.categoria||'General'}</span>
          <span class="badge ${p.estado==='activo'?'bg-success':'bg-danger'} ms-1">${p.estado}</span>
          ${p.tallas?.length ? `<div class="mt-2 d-flex flex-wrap gap-1">${p.tallas.map(t => {
              const nombre = typeof t === 'string' ? t : t.nombre;
              const stock  = typeof t === 'object' && t.stock !== undefined ? ` (${t.stock})` : '';
              return `<span class="badge" style="background:#e9ecef;color:#333;font-size:.72rem">${nombre}${stock}</span>`;
            }).join('')}</div>` : ''}
        </div>
        <div class="card-footer bg-transparent d-flex gap-2">
          <button class="btn btn-outline-primary btn-sm flex-grow-1" onclick="editarProducto('${p.id_producto}')">
            <span class="material-symbols-outlined icon-sm">edit</span> Editar
          </button>
          <button class="btn btn-outline-danger btn-sm" onclick="eliminarProducto('${p.id_producto}')">
            <span class="material-symbols-outlined icon-sm">delete</span>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// ── Pedidos ───────────────────────────────────────────────────────────────────

async function cargarPedidos() {
  const res = await apiFetch(`${API}/vendedor/pedidos`);
  if (!res) return;
  const data = await res.json();
  const lista = document.getElementById('listaPedidos');

  if (!data.pedidos?.length) {
    lista.innerHTML = `<div class="text-center py-5 text-muted">
      <span class="material-symbols-outlined icon-xl">receipt_long</span>
      <p>No hay pedidos aún.</p>
    </div>`;
    return;
  }

  lista.innerHTML = `<div class="table-responsive">
    <table class="table table-hover">
      <thead class="table-light"><tr>
        <th>ID</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Acciones</th>
      </tr></thead>
      <tbody>
        ${data.pedidos.map(p => `
          <tr>
            <td>#${p.id_pedido}</td>
            <td>${new Date(p.fecha_pedido).toLocaleDateString('es-CO')}</td>
            <td>$${Number(p.total).toLocaleString('es-CO')}</td>
            <td><span class="badge ${estadoBadge(p.estado)}">${p.estado}</span></td>
            <td>
              ${p.estado==='pendiente'   ? `<button class="btn btn-sm btn-success" onclick="procesarPedido(${p.id_pedido})">Procesar</button>` : ''}
              ${p.estado==='procesando'  ? `<button class="btn btn-sm btn-primary" onclick="marcarEnviado(${p.id_pedido})">Marcar enviado</button>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function estadoBadge(estado) {
  const map = { pendiente:'bg-warning text-dark', procesando:'bg-info text-dark', enviado:'bg-primary', entregado:'bg-success', cancelado:'bg-danger' };
  return map[estado] || 'bg-secondary';
}

// ── Tienda ────────────────────────────────────────────────────────────────────

async function cargarInfoTienda() {
  const res = await apiFetch(`${API}/vendedor/productos`);
  if (!res) return;
  const data = await res.json();
  tiendaActual = data.tienda;
  const container = document.getElementById('infoTienda');

  if (!tiendaActual) {
    container.innerHTML = `
      <div class="card shadow-soft">
        <div class="card-body text-center py-5">
          <span class="material-symbols-outlined icon-xl text-muted">store</span>
          <h5 class="mt-3">No tienes tienda registrada</h5>
          <p class="text-muted">Crea tu tienda para empezar a vender en EmprendeMarket</p>
          <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modalTienda">
            <span class="material-symbols-outlined icon-sm me-2">add_business</span>Crear mi tienda
          </button>
        </div>
      </div>`;
    return;
  }

  const t = tiendaActual;
  const estadoClass = t.estado==='activa'?'bg-success':t.estado==='pendiente'?'bg-warning text-dark':'bg-danger';
  container.innerHTML = `
    <div class="card shadow-soft">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h5 class="fw-bold">${t.nombre_tienda}</h5>
            <span class="badge ${estadoClass}">${t.estado}</span>
            ${t.estado==='pendiente'?'<p class="text-muted small mt-2">Pendiente de aprobación por el administrador.</p>':''}
          </div>
        </div>
        <p class="text-muted">${t.descripcion||'Sin descripción'}</p>
        <div class="row g-3">
          <div class="col-md-4"><div class="small text-muted">Categoría</div><div class="fw-medium">${t.categoria||'—'}</div></div>
          <div class="col-md-4"><div class="small text-muted">Teléfono</div><div class="fw-medium">${t.telefono_contacto||'—'}</div></div>
          <div class="col-md-4"><div class="small text-muted">Horario</div><div class="fw-medium">${t.horario_atencion||'—'}</div></div>
        </div>
      </div>
    </div>`;
}

// ── Producto CRUD ─────────────────────────────────────────────────────────────

// Estado del uploader de imagen
let imagenSeleccionada = null; // { tipo: 'archivo'|'url', valor: File|string }

// ── Tallas / Tamaños ─────────────────────────────────────────────────────────

const TALLAS_POR_CATEGORIA = {
  'Ropa':               ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  'Deportes':           ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  'Ropa Infantil':      ['0-3m', '3-6m', '6-12m', '1-2a', '2-4a', '4-6a', '6-8a', '8-10a', '10-12a'],
  'Zapatos / Calzado':  ['28', '30', '32', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'],
  'Bolsos y Accesorios':['Único', 'Pequeño', 'Mediano', 'Grande'],
};

/**
 * @param {string}   categoria
 * @param {string[]} seleccionadas - nombres de tallas ya seleccionadas
 * @param {Object}   stockMap - { 'S': 10, 'M': 5, ... } stock por talla
 */
function actualizarTallas(categoria, seleccionadas = [], stockMap = {}) {
  const contenedor = document.getElementById('contenedorTallas');
  const chipsEl    = document.getElementById('tallasChips');
  const tallas     = TALLAS_POR_CATEGORIA[categoria];

  if (!tallas) {
    contenedor.style.display = 'none';
    chipsEl.innerHTML = '';
    actualizarStockInputs({});
    return;
  }

  contenedor.style.display = '';
  chipsEl.innerHTML = tallas.map(t => {
    const activa = seleccionadas.includes(t) ? 'selected' : '';
    return `<span class="talla-chip ${activa}" data-talla="${t}" onclick="toggleTalla(this)">${t}</span>`;
  }).join('');

  actualizarStockInputs(stockMap);
}

function toggleTalla(el) {
  el.classList.toggle('selected');
  actualizarStockInputs();
}

/**
 * Renderiza los inputs de stock para las tallas seleccionadas.
 * @param {Object} stockMap - valores iniciales { 'S': 10 }
 */
function actualizarStockInputs(stockMap = {}) {
  const sel       = getTallasNombres();
  const container = document.getElementById('tallasStockInputs');
  const grid      = document.getElementById('tallasStockGrid');
  if (!container || !grid) return;

  if (!sel.length) {
    container.classList.add('d-none');
    return;
  }

  container.classList.remove('d-none');
  // Preservar valores ya ingresados al re-renderizar
  const valoresActuales = {};
  grid.querySelectorAll('[data-talla-stock]').forEach(inp => {
    valoresActuales[inp.dataset.tallaStock] = inp.value;
  });

  grid.innerHTML = sel.map(t => {
    const val = stockMap[t] ?? valoresActuales[t] ?? '';
    return `<div class="d-flex align-items-center gap-1 border rounded px-2 py-1 bg-white" style="font-size:.85rem">
      <span class="badge" style="background:var(--primary);color:#fff;font-size:.78rem">${t}</span>
      <input type="number" class="form-control form-control-sm" style="width:75px"
             placeholder="Stock" min="0" data-talla-stock="${t}" value="${val}">
    </div>`;
  }).join('');
}

/** Devuelve solo los nombres de las tallas seleccionadas */
function getTallasNombres() {
  return [...document.querySelectorAll('#tallasChips .talla-chip.selected')].map(el => el.dataset.talla);
}

/** Devuelve [{nombre, stock}] para enviar al backend */
function getTallasSeleccionadas() {
  const grid = document.getElementById('tallasStockGrid');
  return getTallasNombres().map(nombre => {
    const inp   = grid?.querySelector(`[data-talla-stock="${nombre}"]`);
    const stock = inp ? (parseInt(inp.value) || 0) : 0;
    return { nombre, stock };
  });
}

// ── Modal Producto ────────────────────────────────────────────────────────────

function prepararModalProducto() {
  document.getElementById('productoId').value = '';
  document.getElementById('modalProductoTitulo').textContent = 'Nuevo Producto';
  document.getElementById('formProducto').reset();
  document.getElementById('modalProductoAlert').classList.add('d-none');
  actualizarTallas('General', [], {});
  resetUploader();
}

async function editarProducto(id) {
  const prod = productosActuales.find(p => String(p.id_producto) === String(id));
  if (!prod) { toast('Producto no encontrado. Recarga la página.', 'warning'); return; }

  document.getElementById('productoId').value      = id;
  document.getElementById('prodNombre').value      = prod.nombre_producto;
  document.getElementById('prodDescripcion').value = prod.descripcion || '';
  document.getElementById('prodPrecio').value      = prod.precio;
  document.getElementById('prodStock').value       = prod.stock ?? 0;
  document.getElementById('prodCategoria').value   = prod.categoria || 'General';
  document.getElementById('modalProductoTitulo').textContent = 'Editar Producto';
  document.getElementById('modalProductoAlert').classList.add('d-none');

  // Soporte formato antiguo (array de strings) y nuevo ([{nombre, stock}])
  const tallas    = prod.tallas || [];
  const talNombres = tallas.map(t => (typeof t === 'string' ? t : t.nombre));
  const stockMap   = {};
  tallas.forEach(t => { if (typeof t === 'object' && t.nombre) stockMap[t.nombre] = t.stock ?? 0; });
  actualizarTallas(prod.categoria || 'General', talNombres, stockMap);

  resetUploader(prod.imagen_url);
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalProducto')).show();
}

// ── Uploader de imágenes multi-modo ──────────────────────────────────────────

function resetUploader(imagenActual = null) {
  imagenSeleccionada = imagenActual ? { tipo: 'url', valor: imagenActual } : null;
  const preview = document.getElementById('imgPreview');
  const urlInput = document.getElementById('prodImagenUrl');
  if (urlInput) urlInput.value = imagenActual || '';
  if (preview) {
    preview.src = imagenActual || '';
    preview.classList.toggle('d-none', !imagenActual);
  }
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    dropZone.querySelector('.drop-text').textContent = imagenActual ? '✓ Imagen cargada' : 'Arrastra una imagen aquí o haz clic para seleccionar';
  }
}

function activarPestanaImagen(tab) {
  ['tab-archivo', 'tab-url'].forEach(t => {
    document.getElementById(t)?.classList.remove('active');
    document.getElementById(`panel-${t.split('-')[1]}`)?.classList.add('d-none');
  });
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  document.getElementById(`panel-${tab}`)?.classList.remove('d-none');
}

// Drag & drop
function setupDropZone() {
  const zone = document.getElementById('dropZone');
  if (!zone) return;

  zone.addEventListener('click', () => document.getElementById('fileInput').click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) seleccionarArchivo(file);
  });

  const fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) seleccionarArchivo(file);
  });
}

function seleccionarArchivo(file) {
  imagenSeleccionada = { tipo: 'archivo', valor: file };
  const preview = document.getElementById('imgPreview');
  preview.src = URL.createObjectURL(file);
  preview.classList.remove('d-none');
  document.getElementById('dropZone').querySelector('.drop-text').textContent = `✓ ${file.name}`;
}

function aplicarUrl() {
  const url = document.getElementById('prodImagenUrl').value.trim();
  if (!url) return;
  imagenSeleccionada = { tipo: 'url', valor: url };
  const preview = document.getElementById('imgPreview');
  preview.src = url;
  preview.classList.remove('d-none');
  toast('URL de imagen aplicada', 'info');
}

// Pegar imagen desde portapapeles
document.addEventListener('paste', async e => {
  const modal = document.getElementById('modalProducto');
  if (!modal?.classList.contains('show')) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      seleccionarArchivo(file);
      activarPestanaImagen('archivo');
      toast('Imagen pegada desde portapapeles', 'info');
      break;
    }
  }
});

async function guardarProducto(e) {
  e.preventDefault();

  const alertEl   = document.getElementById('modalProductoAlert');
  const btnGuardar = document.getElementById('btnGuardarProducto');
  if (alertEl) alertEl.classList.add('d-none');

  // Estado de carga
  const textoOriginal = btnGuardar ? btnGuardar.innerHTML : '';
  if (btnGuardar) {
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Guardando...`;
  }

  const mostrarError = (msg) => {
    if (alertEl) {
      alertEl.className = 'alert alert-danger';
      alertEl.textContent = msg;
      alertEl.classList.remove('d-none');
      alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.innerHTML = textoOriginal;
    }
  };

  try {
    // ── 1. Subir imagen si es un archivo local ──────────────────────────────
    let imagenUrl = '';
    if (imagenSeleccionada?.tipo === 'archivo') {
      const formData = new FormData();
      formData.append('imagen', imagenSeleccionada.valor);
      const uploadRes = await apiFetch(`${API}/vendedor/upload-imagen`, {
        method: 'POST',
        body: formData,
        // Sin headers adicionales: apiFetch detecta FormData automáticamente
      });
      if (!uploadRes) {
        mostrarError('No se pudo conectar con el servidor para subir la imagen. Verifica que los servicios estén activos.');
        return;
      }
      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        mostrarError(uploadData.message || 'Error al subir la imagen.');
        return;
      }
      imagenUrl = uploadData.url;
    } else if (imagenSeleccionada?.tipo === 'url') {
      imagenUrl = imagenSeleccionada.valor;
    }

    // ── 2. Guardar producto ─────────────────────────────────────────────────
    const id       = document.getElementById('productoId').value;
    const categoria = document.getElementById('prodCategoria').value;
    const tallas    = getTallasSeleccionadas();

    const body = {
      nombre_producto: document.getElementById('prodNombre').value.trim(),
      descripcion:     document.getElementById('prodDescripcion').value.trim(),
      precio:          parseFloat(document.getElementById('prodPrecio').value),
      stock:           parseInt(document.getElementById('prodStock').value) || 0,
      categoria,
      imagen_url:      imagenUrl,
      ...(tallas.length > 0 ? { tallas } : { tallas: [] }),
    };

    const url    = id ? `${API}/vendedor/productos/${id}` : `${API}/vendedor/productos`;
    const method = id ? 'PUT' : 'POST';
    const res    = await apiFetch(url, { method, body: JSON.stringify(body) });

    if (!res) {
      mostrarError('No se pudo conectar con el servidor. Verifica que los servicios estén activos.');
      return;
    }

    const data = await res.json();

    if (!data.success) {
      mostrarError(data.message || 'Error al guardar el producto.');
      return;
    }

    // ── 3. Éxito ────────────────────────────────────────────────────────────
    if (alertEl) {
      alertEl.className = 'alert alert-success';
      alertEl.textContent = data.message || 'Producto guardado correctamente.';
      alertEl.classList.remove('d-none');
    }
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.innerHTML = textoOriginal;
    }

    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById('modalProducto'))?.hide();
      cargarProductos();
      cargarDashboard();
    }, 800);

  } catch (err) {
    console.error('[guardarProducto]', err);
    mostrarError('Error inesperado: ' + err.message);
  }
}

async function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  const res = await apiFetch(`${API}/vendedor/productos/${id}`, { method: 'DELETE' });
  if (!res) return;
  const data = await res.json();
  toast(data.message, data.success ? 'success' : 'danger');
  if (data.success) cargarProductos();
}

// ── Pedidos (acciones) ────────────────────────────────────────────────────────

async function procesarPedido(id) {
  const res = await apiFetch(`${API}/vendedor/pedidos/${id}/procesar`, { method: 'POST' });
  if (!res) return;
  const data = await res.json();
  toast(data.message, data.success ? 'success' : 'danger');
  if (data.success) cargarPedidos();
}

async function marcarEnviado(id) {
  const guia = prompt('Número de guía (opcional):') || '';
  const res = await apiFetch(`${API}/vendedor/pedidos/${id}/marcar-enviado`, {
    method: 'POST', body: JSON.stringify({ numero_guia: guia }),
  });
  if (!res) return;
  const data = await res.json();
  toast(data.message, data.success ? 'success' : 'danger');
  if (data.success) cargarPedidos();
}

// ── Tienda: crear ─────────────────────────────────────────────────────────────

async function guardarTienda(e) {
  e.preventDefault();
  const body = {
    nombre_tienda:     document.getElementById('tiendaNombre').value,
    descripcion:       document.getElementById('tiendaDescripcion').value,
    categoria:         document.getElementById('tiendaCategoria').value,
    telefono_contacto: document.getElementById('tiendaTelefono').value,
    horario_atencion:  document.getElementById('tiendaHorario').value,
  };
  const res = await apiFetch(`${API}/tiendas`, { method: 'POST', body: JSON.stringify(body) });
  if (!res) return;
  const data = await res.json();
  const alertEl = document.getElementById('modalTiendaAlert');
  alertEl.className = `alert alert-${data.success ? 'success' : 'danger'}`;
  alertEl.textContent = data.message;
  alertEl.classList.remove('d-none');
  if (data.success) {
    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById('modalTienda')).hide();
      cargarDashboard();
      cargarInfoTienda();
    }, 1200);
  }
}

// ── Perfil ────────────────────────────────────────────────────────────────────

let fotoPending = null; // File pendiente de subir para foto de perfil

async function cargarPerfil() {
  const res = await apiFetch(`${API}/auth/me`);
  if (!res) return;
  const data = await res.json();
  if (!data.success) return;
  const u = data.usuario;

  document.getElementById('perfilNombre').value   = u.nombre   || '';
  document.getElementById('perfilApellido').value = u.apellido || '';
  document.getElementById('perfilCorreo').value   = u.correo   || '';
  document.getElementById('perfilCedula').value   = u.cedula   || '';
  document.getElementById('perfilTelefono').value = u.telefono || '';
  document.getElementById('perfilBio').value      = u.bio      || '';

  const fotoActual = document.getElementById('fotoActual');
  if (u.foto_perfil) {
    fotoActual.src = u.foto_perfil;
    fotoActual.classList.remove('d-none');
  }
}

function previsualizarFoto(input) {
  const file = input.files[0];
  if (!file) return;
  fotoPending = file;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('fotoActual');
    img.src = e.target.result;
    img.classList.remove('d-none');
  };
  reader.readAsDataURL(file);
}

async function guardarPerfil(e) {
  e.preventDefault();
  const alertEl = document.getElementById('perfilAlert');
  alertEl.classList.add('d-none');

  // Subir foto si hay una pendiente
  if (fotoPending) {
    const fd = new FormData();
    fd.append('foto', fotoPending);
    const r = await apiFetch(`${API}/auth/perfil/foto`, { method: 'POST', body: fd, headers: {} });
    if (r) {
      const d = await r.json();
      if (d.success) {
        // Actualizar foto en sidebar
        const fotoSidebar = document.getElementById('fotoSidebar');
        if (fotoSidebar) { fotoSidebar.src = d.url; fotoSidebar.classList.remove('d-none'); }
      }
    }
    fotoPending = null;
  }

  const body = {
    nombre:   document.getElementById('perfilNombre').value,
    apellido: document.getElementById('perfilApellido').value,
    cedula:   document.getElementById('perfilCedula').value,
    telefono: document.getElementById('perfilTelefono').value,
    bio:      document.getElementById('perfilBio').value,
  };

  const res = await apiFetch(`${API}/auth/perfil`, { method: 'PUT', body: JSON.stringify(body) });
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

const REPORTE_ESTADO_BADGE_V = {
  pendiente:   'bg-warning text-dark',
  en_revision: 'bg-info text-dark',
  atendido:    'bg-success',
  cerrado:     'bg-secondary',
  rechazado:   'bg-danger',
};

async function cargarReportesV() {
  const containerRecibidos = document.getElementById('listaReportesRecibidos');
  const containerEnviados  = document.getElementById('listaReportesV');
  if (containerRecibidos) containerRecibidos.innerHTML = `<div class="text-center py-3"><div class="spinner-border text-warning spinner-border-sm"></div></div>`;
  containerEnviados.innerHTML = `<div class="text-center py-3"><div class="spinner-border text-warning spinner-border-sm"></div></div>`;

  const res = await apiFetch(`${API}/reportes`);
  if (!res) {
    containerEnviados.innerHTML = `<div class="alert alert-danger m-3">Error al cargar reportes.</div>`;
    return;
  }
  const data = await res.json();
  const reportes = data.reportes || [];

  const miId = usuario?.id; // `usuario` es el JWT decodificado del top-level scope

  const recibidos = reportes.filter(r => r.id_destinatario && String(r.id_destinatario) === String(miId));
  const enviados  = reportes.filter(r => !r.id_destinatario || String(r.id_destinatario) !== String(miId));

  const renderReporte = (r, esRecibido = false) => {
    const badge = REPORTE_ESTADO_BADGE_V[(r.estado || '').toLowerCase()] || 'bg-secondary';
    const fecha = r.fecha_creacion
      ? new Date(r.fecha_creacion).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    const respuesta = r.respuesta_admin
      ? `<div class="mt-2 p-2 rounded small" style="background:#f0fdf4;border-left:3px solid #16a34a">
           <span class="fw-semibold text-success">Respuesta del admin:</span> ${r.respuesta_admin}
         </div>` : '';
    const remitente = esRecibido && r.usuario_nombre
      ? `<span class="badge bg-light text-dark border me-1" style="font-size:.7rem">De: ${r.usuario_nombre}</span>` : '';
    return `
    <div class="border-bottom p-3">
      <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div class="flex-grow-1">
          <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
            ${remitente}
            <span class="badge bg-secondary">${r.motivo || '—'}</span>
            <span class="badge ${badge}">${r.estado || '—'}</span>
          </div>
          <p class="mb-1 small text-dark">${r.descripcion || '—'}</p>
          ${respuesta}
        </div>
        <div class="text-muted small text-end flex-shrink-0">${fecha}</div>
      </div>
    </div>`;
  };

  // Reportes recibidos (de compradores)
  if (containerRecibidos) {
    containerRecibidos.innerHTML = recibidos.length
      ? recibidos.map(r => renderReporte(r, true)).join('')
      : `<div class="text-center py-4 text-muted small">
           <span class="material-symbols-outlined">mark_email_read</span>
           <p class="mt-1 mb-0">No has recibido reportes de compradores.</p>
         </div>`;
  }

  // Reportes enviados (por el vendedor)
  containerEnviados.innerHTML = enviados.length
    ? enviados.map(r => renderReporte(r, false)).join('')
    : `<div class="text-center py-4 text-muted small">
         <span class="material-symbols-outlined">flag</span>
         <p class="mt-1 mb-0">No has enviado reportes aún.</p>
       </div>`;
}

async function enviarReporteV(e) {
  e.preventDefault();
  const alertEl = document.getElementById('alertaReporteV');
  alertEl.classList.add('d-none');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  const res = await apiFetch(`${API}/reportes`, {
    method: 'POST',
    body: JSON.stringify({
      motivo:      document.getElementById('motivoReporteV').value,
      descripcion: document.getElementById('descReporteV').value,
    }),
  });

  btn.disabled = false;
  if (!res) return;
  const data = await res.json();
  alertEl.className = `alert alert-${data.success ? 'success' : 'danger'} mt-3 mb-0`;
  alertEl.textContent = data.message || (data.success ? 'Reporte enviado.' : 'Error al enviar.');
  alertEl.classList.remove('d-none');
  if (data.success) {
    document.getElementById('formReporteV').reset();
    cargarReportesV();
    setTimeout(() => alertEl.classList.add('d-none'), 4000);
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
    const clsBg = !n.leida ? 'border-start border-primary border-3 bg-light' : '';
    const icono = _notifIcono(n.tipo);
    const nuevoBadge = !n.leida ? `<span class="badge bg-primary ms-1" style="font-size:.6rem;padding:2px 5px">Nuevo</span>` : '';
    return `
    <div class="p-3 border-bottom notif-item ${clsBg}">
      <div class="d-flex align-items-start gap-2">
        <span class="material-symbols-outlined text-primary mt-1 flex-shrink-0" style="font-size:20px">${icono}</span>
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

// ── Mensajes ──────────────────────────────────────────────────────────────────

let convActual = null; // { id_conversacion, id_destinatario, nombre }

async function cargarMensajes() {
  const container = document.getElementById('listaConversaciones');
  container.innerHTML = `<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm text-primary"></div></div>`;

  const res = await apiFetch(`${API}/mensajes`);
  if (!res) {
    container.innerHTML = `<div class="alert alert-danger m-2 small p-2">Error al cargar conversaciones.</div>`;
    return;
  }
  const data = await res.json();
  const convs = data.conversaciones || [];

  if (!convs.length) {
    container.innerHTML = `<div class="text-center py-4 text-muted p-3" style="font-size:.85rem">
      <span class="material-symbols-outlined" style="font-size:36px">chat_bubble_outline</span>
      <p class="mt-2">Sin conversaciones aún.<br>¡Inicia una nueva!</p>
    </div>`;
    return;
  }

  container.innerHTML = convs.map(c => {
    const otro   = c.otro_usuario || {};
    const destId = otro.id_usuario || '';
    const nombre = `${otro.nombre || ''} ${otro.apellido || ''}`.trim() || 'Usuario';
    const msg    = c.ultimo_mensaje?.contenido || '';
    const prev   = msg.length > 32 ? msg.substring(0, 32) + '…' : msg;
    const bdg    = c.no_leidos > 0
      ? `<span class="badge bg-danger rounded-pill" style="font-size:.62rem">${c.no_leidos}</span>` : '';
    return `
      <div class="conv-item d-flex align-items-center gap-2 p-2 border-bottom"
           style="cursor:pointer"
           onclick="abrirConversacion('${c.id_conversacion}', '${destId}', '${nombre.replace(/'/g, "\\'")}', this)">
        <div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white flex-shrink-0"
             style="width:36px;height:36px;font-size:.85rem">
          ${nombre.charAt(0).toUpperCase()}
        </div>
        <div class="flex-grow-1 overflow-hidden">
          <div class="d-flex justify-content-between align-items-center">
            <span class="small fw-medium">${nombre}</span>
            ${bdg}
          </div>
          <div class="text-muted text-truncate" style="font-size:.78rem">${prev}</div>
        </div>
      </div>`;
  }).join('');
}

async function abrirConversacion(convId, destId, nombre, itemEl) {
  convActual = { id_conversacion: convId, id_destinatario: destId, nombre };

  document.getElementById('convHeader').innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white"
           style="width:32px;height:32px;min-width:32px;font-size:.8rem">
        ${nombre.charAt(0).toUpperCase()}
      </div>
      <span class="fw-bold small">${nombre}</span>
    </div>`;
  document.getElementById('convDestId').value     = destId;
  document.getElementById('formMensajeWrap').style.display = '';

  // Resaltar activa
  document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('activa'));
  if (itemEl) itemEl.classList.add('activa');

  const panel = document.getElementById('mensajesPanel');
  panel.innerHTML = `<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></div>`;

  const res = await apiFetch(`${API}/mensajes/${convId}`);
  if (!res) {
    panel.innerHTML = `<div class="alert alert-danger m-2 small">Error al cargar mensajes.</div>`;
    return;
  }
  const data = await res.json();
  const msgs = data.mensajes || [];
  const myId = usuario?.id;

  panel.innerHTML = msgs.length === 0
    ? `<div class="text-center text-muted py-5" style="font-size:.85rem">
         <span class="material-symbols-outlined" style="font-size:36px">chat_bubble_outline</span>
         <p class="mt-2">Sin mensajes aún. ¡Escribe el primero!</p>
       </div>`
    : msgs.map(m => {
        const esMio = Number(m.id_remitente) === Number(myId);
        const hora  = new Date(m.fecha_envio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="d-flex mb-2 ${esMio ? 'justify-content-end' : 'justify-content-start'}">
            <div class="rounded-3 px-3 py-2 small" style="max-width:72%;word-break:break-word;
              background:${esMio ? 'var(--primary)' : '#e9ecef'};color:${esMio ? '#fff' : '#333'}">
              <div>${m.contenido}</div>
              <div class="text-end mt-1" style="font-size:.65rem;opacity:.75">${hora}</div>
            </div>
          </div>`;
      }).join('');

  panel.scrollTop = panel.scrollHeight;
  document.getElementById('inputMensaje').focus();
}

async function enviarMensajeV(e) {
  e.preventDefault();
  if (!convActual?.id_destinatario) return;
  const input     = document.getElementById('inputMensaje');
  const contenido = input.value.trim();
  if (!contenido) return;

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  const res = await apiFetch(`${API}/mensajes/enviar`, {
    method: 'POST',
    body: JSON.stringify({ id_destinatario: convActual.id_destinatario, contenido }),
  });
  btn.disabled = false;
  if (!res) return;
  const data = await res.json();
  if (data.success) {
    input.value = '';
    abrirConversacion(convActual.id_conversacion, convActual.id_destinatario, convActual.nombre);
    cargarMensajes();
  }
}

async function mostrarNuevaConv() {
  const modal = new bootstrap.Modal(document.getElementById('modalNuevaConv'));
  const lista = document.getElementById('listaUsuariosConv');
  lista.innerHTML = `<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></div>`;
  modal.show();

  const res = await apiFetch(`${API}/mensajes-usuarios`);
  if (!res) {
    lista.innerHTML = `<div class="text-danger small p-2">Error al cargar usuarios.</div>`;
    return;
  }
  const data = await res.json();
  const usuariosDisp = data.usuarios || [];

  if (!usuariosDisp.length) {
    lista.innerHTML = `<p class="text-muted small text-center py-2">No hay otros usuarios disponibles.</p>`;
    return;
  }

  lista.innerHTML = usuariosDisp.map(u => {
    const nombre = `${u.nombre || ''} ${u.apellido || ''}`.trim() || `Usuario #${u.id_usuario}`;
    return `
      <button class="btn btn-outline-secondary btn-sm text-start d-flex align-items-center gap-2 w-100"
              onclick="iniciarNuevaConv(${u.id_usuario}, '${nombre.replace(/'/g, "\\'")}')">
        <div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white flex-shrink-0"
             style="width:28px;height:28px;font-size:.78rem">
          ${nombre.charAt(0).toUpperCase()}
        </div>
        <div>
          <div class="small fw-medium">${nombre}</div>
          <div class="text-muted" style="font-size:.7rem">${u.correo || u.rol || ''}</div>
        </div>
      </button>`;
  }).join('');
}

function iniciarNuevaConv(destId, nombre) {
  bootstrap.Modal.getInstance(document.getElementById('modalNuevaConv'))?.hide();
  const myId = usuario?.id;
  if (!myId) return;
  const convId = `${Math.min(Number(myId), Number(destId))}-${Math.max(Number(myId), Number(destId))}`;
  document.getElementById('formMensajeWrap').style.display = '';
  convActual = { id_conversacion: convId, id_destinatario: String(destId), nombre };
  document.getElementById('convHeader').innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white"
           style="width:32px;height:32px;min-width:32px;font-size:.8rem">
        ${nombre.charAt(0).toUpperCase()}
      </div>
      <span class="fw-bold small">${nombre}</span>
    </div>`;
  document.getElementById('convDestId').value = String(destId);
  const panel = document.getElementById('mensajesPanel');
  panel.innerHTML = `<div class="text-center text-muted py-5" style="font-size:.85rem">
    <span class="material-symbols-outlined" style="font-size:36px">chat_bubble_outline</span>
    <p class="mt-2">Sin mensajes aún. ¡Escribe el primero!</p>
  </div>`;
  document.getElementById('inputMensaje').focus();
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  setupDropZone();
  activarPestanaImagen('archivo');
  actualizarTallas('General', [], {}); // estado inicial del selector de tallas
  cargarDashboard();
  actualizarBadgeNotif();
  setInterval(actualizarBadgeNotif, 30000); // Polling cada 30 s
});

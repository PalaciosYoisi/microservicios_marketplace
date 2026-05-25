let paginaActual        = 1;
let paginaTiendasActual = 1;
let tabActiva           = 'productos';
const LIMITE         = 12;
const LIMITE_TIENDAS = 9;

// ── Navbar según sesión ───────────────────────────────────────────────────────
const usuario    = getUsuario();
const navUsuario = document.getElementById('navUsuario');
if (usuario) {
  const dashLink = usuario.rol === 'emprendedor'
    ? '/vendedor/dashboard'
    : usuario.rol === 'administrador'
    ? '/admin/dashboard'
    : '/comprador/dashboard';
  navUsuario.innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <a href="${dashLink}" class="btn btn-outline-primary btn-sm">
        <span class="material-symbols-outlined icon-sm">dashboard</span>
      </a>
      <button class="btn btn-outline-secondary btn-sm" onclick="cerrarSesion()">
        <span class="material-symbols-outlined icon-sm">logout</span>
      </button>
    </div>`;
} else {
  navUsuario.innerHTML = `<a href="/login" class="btn btn-primary btn-sm">Ingresar</a>`;
}

// ── Cambiar tab ───────────────────────────────────────────────────────────────
function cambiarTab(tab) {
  tabActiva = tab;
  document.getElementById('tab-productos').classList.toggle('active', tab === 'productos');
  document.getElementById('tab-tiendas').classList.toggle('active', tab === 'tiendas');
  document.getElementById('seccion-productos').classList.toggle('d-none', tab !== 'productos');
  document.getElementById('seccion-tiendas').classList.toggle('d-none', tab !== 'tiendas');

  if (tab === 'tiendas') cargarTiendas(paginaTiendasActual);
  if (tab === 'productos') cargarProductos(paginaActual);
}

// ── Productos ─────────────────────────────────────────────────────────────────
async function cargarProductos(pagina = 1) {
  const categoria = document.getElementById('filtroCategoria').value;
  const buscar    = document.getElementById('searchInput').value;

  document.getElementById('loadingProductos').classList.remove('d-none');
  document.getElementById('gridProductos').classList.add('d-none');
  document.getElementById('sinProductos').classList.add('d-none');

  try {
    let url = `${API}/productos?pagina=${pagina}&limite=${LIMITE}`;
    if (categoria) url += `&categoria=${encodeURIComponent(categoria)}`;
    if (buscar)    url += `&buscar=${encodeURIComponent(buscar)}`;

    const res  = await fetch(url);
    const data = await res.json();

    document.getElementById('loadingProductos').classList.add('d-none');

    if (!data.success || !data.productos.length) {
      document.getElementById('sinProductos').classList.remove('d-none');
      document.getElementById('totalProductos').textContent = '0 productos';
      return;
    }

    document.getElementById('totalProductos').textContent = `${data.paginacion.total} productos`;
    renderProductos(data.productos);
    renderPaginacion(data.paginacion);
    paginaActual = pagina;
  } catch (err) {
    console.error('[marketplace] Error cargando productos:', err);
    document.getElementById('loadingProductos').classList.add('d-none');
    document.getElementById('sinProductos').classList.remove('d-none');
    document.getElementById('sinProductos').innerHTML = `
      <span class="material-symbols-outlined icon-xl text-danger">error</span>
      <p class="text-danger mt-2 fw-semibold">No se pudieron cargar los productos.</p>
      <p class="text-muted small">Asegúrate de acceder por <strong>http://localhost:3000</strong> (el gateway).<br>
      Verifica también que MongoDB y los servicios estén corriendo.</p>
      <button class="btn btn-outline-primary btn-sm mt-2" onclick="cargarProductos()">
        <span class="material-symbols-outlined icon-sm me-1">refresh</span>Reintentar
      </button>`;
  }
}

function renderProductos(productos) {
  const grid = document.getElementById('gridProductos');
  grid.innerHTML = productos.map(p => `
    <div class="col-sm-6 col-xl-4">
      <div class="card card-hover h-100 shadow-soft">
        <div class="position-relative">
          <img src="${p.imagen_url || 'https://via.placeholder.com/300x200?text=Producto'}"
               class="card-img-top" style="height:200px;object-fit:cover" alt="${p.nombre_producto}"
               onerror="this.src='https://via.placeholder.com/300x200?text=Sin+imagen'">
          <span class="badge bg-primary position-absolute top-0 end-0 m-2">${p.categoria || 'General'}</span>
        </div>
        <div class="card-body d-flex flex-column">
          <h6 class="card-title fw-bold">${p.nombre_producto}</h6>
          <p class="card-text text-muted small flex-grow-1">${(p.descripcion || '').substring(0, 80)}${(p.descripcion || '').length > 80 ? '...' : ''}</p>
          ${p.tienda ? `
            <a href="/tienda/${p.tienda.id_tienda}" class="small text-muted mb-2 text-decoration-none d-flex align-items-center gap-1">
              <span class="material-symbols-outlined icon-sm">store</span>${p.tienda.nombre_tienda}
            </a>` : ''}
          ${p.tallas?.length ? `<div class="d-flex flex-wrap gap-1 mb-2">${p.tallas.map(t => `<span class="badge" style="background:#f0f0f0;color:#444;font-size:.72rem;border:1px solid #ddd">${typeof t === 'object' ? t.nombre : t}</span>`).join('')}</div>` : ''}
          <div class="d-flex justify-content-between align-items-center mt-auto">
            <span class="h5 fw-bold text-primary mb-0">$${Number(p.precio).toLocaleString('es-CO')}</span>
            <span class="small text-muted">${p.stock > 0 ? `${p.stock} disp.` : '<span class="text-danger">Agotado</span>'}</span>
          </div>
          <div class="d-flex gap-2 mt-3">
            <a href="/producto/${p.id_producto}" class="btn btn-outline-primary btn-sm flex-grow-1">Ver detalle</a>
            ${p.stock > 0 ? `<button class="btn btn-primary btn-sm" onclick="agregarCarrito(${p.id_producto})">
              <span class="material-symbols-outlined icon-sm">add_shopping_cart</span>
            </button>` : ''}
          </div>
        </div>
      </div>
    </div>
  `).join('');
  grid.classList.remove('d-none');
}

function renderPaginacion(pag) {
  if (pag.paginas <= 1) { document.getElementById('paginacion').classList.add('d-none'); return; }
  document.getElementById('paginacion').classList.remove('d-none');
  document.getElementById('paginacionItems').innerHTML = paginasHtml(pag, 'cargarProductos');
}

// ── Tiendas ───────────────────────────────────────────────────────────────────
async function cargarTiendas(pagina = 1) {
  const categoria = document.getElementById('filtroCategoria').value;
  const buscar    = document.getElementById('searchInput').value;

  document.getElementById('loadingTiendas').classList.remove('d-none');
  document.getElementById('gridTiendas').classList.add('d-none');
  document.getElementById('sinTiendas').classList.add('d-none');

  try {
    let url = `${API}/tiendas?pagina=${pagina}&limite=${LIMITE_TIENDAS}`;
    if (categoria) url += `&categoria=${encodeURIComponent(categoria)}`;
    if (buscar)    url += `&buscar=${encodeURIComponent(buscar)}`;

    const res  = await fetch(url);
    const data = await res.json();

    document.getElementById('loadingTiendas').classList.add('d-none');

    if (!data.success || !data.tiendas || !data.tiendas.length) {
      document.getElementById('sinTiendas').classList.remove('d-none');
      document.getElementById('totalTiendas').textContent = '0 tiendas';
      return;
    }

    const pag = data.paginacion || { total: data.tiendas.length, pagina: 1, paginas: 1 };
    document.getElementById('totalTiendas').textContent = `${pag.total} tiendas`;
    renderTiendas(data.tiendas);
    renderPaginacionTiendas(pag);
    paginaTiendasActual = pagina;
  } catch (err) {
    console.error('[marketplace] Error cargando tiendas:', err);
    document.getElementById('loadingTiendas').classList.add('d-none');
    document.getElementById('sinTiendas').classList.remove('d-none');
  }
}

// Color de fondo por categoría
const CATEGORIA_COLORS = {
  'Ropa':                '#f9a8d4',
  'Zapatos / Calzado':   '#fcd34d',
  'Ropa Infantil':       '#86efac',
  'Bolsos y Accesorios': '#c4b5fd',
  'Deportes':            '#67e8f9',
  'Alimentos':           '#fdba74',
  'Artesanías':          '#a78bfa',
  'Tecnología':          '#93c5fd',
  'Hogar':               '#6ee7b7',
  'Belleza':             '#f9a8d4',
  'Joyería':             '#fde68a',
  'General':             '#d1d5db',
};

function renderTiendas(tiendas) {
  const grid = document.getElementById('gridTiendas');
  grid.innerHTML = tiendas.map(t => {
    const color  = CATEGORIA_COLORS[t.categoria] || '#e5e7eb';
    const logo   = t.logo_url || '';
    const owner  = t.propietario ? `${t.propietario.nombre} ${t.propietario.apellido}` : '—';
    const desc   = (t.descripcion || '').substring(0, 90) + ((t.descripcion || '').length > 90 ? '...' : '');
    const nProds = t.total_productos || 0;
    return `
      <div class="col-sm-6 col-xl-4">
        <div class="card h-100 shadow-soft overflow-hidden" style="border-radius:14px">
          <!-- Banner con logo -->
          <div style="height:100px;background:${color}20;border-bottom:1px solid ${color}60;position:relative;display:flex;align-items:center;justify-content:center;">
            ${logo
              ? `<img src="${logo}" alt="${t.nombre_tienda}" style="width:72px;height:72px;object-fit:cover;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.15)" onerror="this.outerHTML='<div style=\'width:72px;height:72px;border-radius:50%;background:${color};border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:1.8rem\'>🏪</div>'">`
              : `<div style="width:72px;height:72px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;font-size:1.8rem">🏪</div>`
            }
            <span class="badge position-absolute top-0 end-0 m-2" style="background:${color};color:#374151;font-size:.7rem">${t.categoria || 'General'}</span>
          </div>
          <div class="card-body d-flex flex-column pt-3">
            <h6 class="fw-bold mb-1">${t.nombre_tienda}</h6>
            <p class="small text-muted flex-grow-1 mb-2">${desc || 'Sin descripción.'}</p>
            <div class="d-flex flex-column gap-1 mb-3">
              <div class="d-flex align-items-center gap-1 small text-muted">
                <span class="material-symbols-outlined" style="font-size:15px">person</span>
                ${owner}
              </div>
              <div class="d-flex align-items-center gap-1 small text-muted">
                <span class="material-symbols-outlined" style="font-size:15px">inventory_2</span>
                ${nProds} producto${nProds !== 1 ? 's' : ''}
              </div>
              ${t.horario_atencion ? `
              <div class="d-flex align-items-center gap-1 small text-muted">
                <span class="material-symbols-outlined" style="font-size:15px">schedule</span>
                ${t.horario_atencion}
              </div>` : ''}
            </div>
            <a href="/tienda/${t.id_tienda}" class="btn btn-primary btn-sm w-100">
              <span class="material-symbols-outlined icon-sm me-1">storefront</span>Visitar tienda
            </a>
          </div>
        </div>
      </div>`;
  }).join('');
  grid.classList.remove('d-none');
}

function renderPaginacionTiendas(pag) {
  if (pag.paginas <= 1) { document.getElementById('paginacionTiendas').classList.add('d-none'); return; }
  document.getElementById('paginacionTiendas').classList.remove('d-none');
  document.getElementById('paginacionTiendasItems').innerHTML = paginasHtml(pag, 'cargarTiendas');
}

// ── Helper paginación ─────────────────────────────────────────────────────────
function paginasHtml(pag, fn) {
  const MAX = 7;
  let html = '';

  // Botón anterior
  html += `<li class="page-item ${pag.pagina === 1 ? 'disabled' : ''}">
    <button class="page-link" onclick="${fn}(${pag.pagina - 1})">‹</button></li>`;

  if (pag.paginas <= MAX) {
    for (let i = 1; i <= pag.paginas; i++) {
      html += `<li class="page-item ${i === pag.pagina ? 'active' : ''}">
        <button class="page-link" onclick="${fn}(${i})">${i}</button></li>`;
    }
  } else {
    // Mostrar primera, última y las 3 cercanas a la actual
    const show = new Set([1, pag.paginas, pag.pagina - 1, pag.pagina, pag.pagina + 1].filter(n => n >= 1 && n <= pag.paginas));
    let prev = 0;
    [...show].sort((a, b) => a - b).forEach(i => {
      if (prev && i - prev > 1) html += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
      html += `<li class="page-item ${i === pag.pagina ? 'active' : ''}">
        <button class="page-link" onclick="${fn}(${i})">${i}</button></li>`;
      prev = i;
    });
  }

  // Botón siguiente
  html += `<li class="page-item ${pag.pagina === pag.paginas ? 'disabled' : ''}">
    <button class="page-link" onclick="${fn}(${pag.pagina + 1})">›</button></li>`;

  return html;
}

// ── Carrito ───────────────────────────────────────────────────────────────────
async function agregarCarrito(idProducto) {
  if (!getToken()) { window.location.href = '/login'; return; }
  try {
    const res  = await apiFetch(`${API}/carrito/agregar`, { method: 'POST', body: JSON.stringify({ id_producto: idProducto, cantidad: 1 }) });
    if (!res) return;
    const data = await res.json();
    mostrarToast(data.message, data.success ? 'success' : 'danger');
    if (data.success) actualizarContadorCarrito();
  } catch {
    mostrarToast('Error al agregar al carrito', 'danger');
  }
}

async function actualizarContadorCarrito() {
  if (!getToken()) return;
  try {
    const res  = await apiFetch(`${API}/carrito`);
    if (!res) return;
    const data = await res.json();
    const count = document.getElementById('carritoCount');
    if (data.cantidad > 0) { count.textContent = data.cantidad; count.classList.remove('d-none'); }
  } catch {}
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function mostrarToast(msg, tipo) {
  const t = document.createElement('div');
  t.className = `alert alert-${tipo} position-fixed bottom-0 end-0 m-3 shadow-strong`;
  t.style.zIndex = '9999';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function buscar()  { tabActiva === 'tiendas' ? cargarTiendas(1) : cargarProductos(1); }
function filtrar() { tabActiva === 'tiendas' ? cargarTiendas(1) : cargarProductos(1); }
function limpiarFiltros() {
  document.getElementById('filtroCategoria').value = '';
  document.getElementById('searchInput').value     = '';
  tabActiva === 'tiendas' ? cargarTiendas(1) : cargarProductos(1);
}

document.getElementById('searchInput').addEventListener('keypress', e => { if (e.key === 'Enter') buscar(); });

// ── Init ──────────────────────────────────────────────────────────────────────
cargarProductos();
actualizarContadorCarrito();

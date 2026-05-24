let paginaActual = 1;
const LIMITE = 12;

// Renderizar navbar según estado de sesión
const usuario = getUsuario();
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

async function cargarProductos(pagina = 1) {
  const categoria = document.getElementById('filtroCategoria').value;
  const buscar = document.getElementById('searchInput').value;

  document.getElementById('loadingProductos').classList.remove('d-none');
  document.getElementById('gridProductos').classList.add('d-none');
  document.getElementById('sinProductos').classList.add('d-none');

  try {
    let url = `${API}/productos?pagina=${pagina}&limite=${LIMITE}`;
    if (categoria) url += `&categoria=${encodeURIComponent(categoria)}`;
    if (buscar)    url += `&buscar=${encodeURIComponent(buscar)}`;

    const res = await fetch(url);
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
      <p class="text-muted small">Asegúrate de acceder por <strong>http://localhost:3000</strong> (el gateway),<br>
      no por el puerto 3005. Verifica también que MongoDB esté corriendo.</p>
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
          ${p.tienda ? `<p class="small text-muted mb-2"><span class="material-symbols-outlined icon-sm">store</span> ${p.tienda.nombre_tienda}</p>` : ''}
          ${p.tallas?.length ? `<div class="d-flex flex-wrap gap-1 mb-2">${p.tallas.map(t=>`<span class="badge" style="background:#f0f0f0;color:#444;font-size:.72rem;border:1px solid #ddd">${t}</span>`).join('')}</div>` : ''}
          <div class="d-flex justify-content-between align-items-center mt-auto">
            <span class="h5 fw-bold text-primary mb-0">$${Number(p.precio).toLocaleString('es-CO')}</span>
            <span class="small text-muted">${p.stock > 0 ? `${p.stock} disponibles` : '<span class="text-danger">Agotado</span>'}</span>
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
  let html = '';
  for (let i = 1; i <= pag.paginas; i++) {
    html += `<li class="page-item ${i === pag.pagina ? 'active' : ''}">
      <button class="page-link" onclick="cargarProductos(${i})">${i}</button>
    </li>`;
  }
  document.getElementById('paginacionItems').innerHTML = html;
}

async function agregarCarrito(idProducto) {
  if (!getToken()) { window.location.href = '/login'; return; }
  try {
    const res = await apiFetch(`${API}/carrito/agregar`, {
      method: 'POST',
      body: JSON.stringify({ id_producto: idProducto, cantidad: 1 }),
    });
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
    const res = await apiFetch(`${API}/carrito`);
    if (!res) return;
    const data = await res.json();
    const count = document.getElementById('carritoCount');
    if (data.cantidad > 0) {
      count.textContent = data.cantidad;
      count.classList.remove('d-none');
    }
  } catch {}
}

function mostrarToast(msg, tipo) {
  const toast = document.createElement('div');
  toast.className = `alert alert-${tipo} position-fixed bottom-0 end-0 m-3 shadow-strong`;
  toast.style.zIndex = '9999';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function buscar() { cargarProductos(1); }
function filtrar() { cargarProductos(1); }
function limpiarFiltros() {
  document.getElementById('filtroCategoria').value = '';
  document.getElementById('searchInput').value = '';
  cargarProductos(1);
}

document.getElementById('searchInput').addEventListener('keypress', e => {
  if (e.key === 'Enter') buscar();
});

cargarProductos();
actualizarContadorCarrito();

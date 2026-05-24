const usuario = protegerPagina();

async function cargarCarrito() {
  const container = document.getElementById('carrito-items');
  const emptyMsg  = document.getElementById('carrito-empty');
  const loadingEl = document.getElementById('carrito-loading');

  try {
    const res = await apiFetch(`${API}/carrito`);
    if (loadingEl) loadingEl.classList.add('d-none');
    if (!res) return;
    const data = await res.json();

    if (!data.success || !data.items.length) {
      container.classList.add('d-none');
      emptyMsg.classList.remove('d-none');
      actualizarResumen(0, 0, 0);
      return;
    }

    emptyMsg.classList.add('d-none');
    container.classList.remove('d-none');
    renderItems(data.items);
    const envio = data.total > 100000 ? 0 : 8000;
    actualizarResumen(data.total - envio, envio, data.total);
  } catch (err) {
    console.error('Error cargando carrito:', err);
  }
}

function renderItems(items) {
  document.getElementById('carrito-items').innerHTML = items.map(item => {
    const prod = item.producto || {};
    const nombre  = prod.nombre_producto || 'Producto';
    const imagen  = prod.imagen_url || 'https://via.placeholder.com/80x80?text=img';
    const precio  = Number(item.precio_unitario || prod.precio || 0);
    const subtotal = precio * item.cantidad;
    return `
      <div class="d-flex align-items-center border-bottom py-3 gap-3" id="item-${item.id_carrito}">
        <img src="${imagen}" class="rounded" width="80" height="80" style="object-fit:cover"
             onerror="this.src='https://via.placeholder.com/80x80?text=img'">
        <div class="flex-grow-1">
          <h6 class="mb-0 fw-semibold">${nombre}</h6>
          ${item.talla ? `<div class="text-muted small">Talla: <strong>${item.talla}</strong></div>` : ''}
          <div class="text-primary fw-bold mt-1">$${precio.toLocaleString('es-CO')} c/u</div>
          <div class="text-muted small">Subtotal: $${subtotal.toLocaleString('es-CO')}</div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-outline-secondary btn-sm" onclick="cambiarCantidad(${item.id_carrito}, ${item.cantidad - 1})">
            <span class="material-symbols-outlined icon-sm">remove</span>
          </button>
          <span class="fw-bold px-2">${item.cantidad}</span>
          <button class="btn btn-outline-secondary btn-sm" onclick="cambiarCantidad(${item.id_carrito}, ${item.cantidad + 1})">
            <span class="material-symbols-outlined icon-sm">add</span>
          </button>
          <button class="btn btn-outline-danger btn-sm ms-2" onclick="eliminarItem(${item.id_carrito})">
            <span class="material-symbols-outlined icon-sm">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function actualizarResumen(subtotal, envio, total) {
  document.getElementById('subtotal').textContent  = `$${Number(subtotal).toLocaleString('es-CO')}`;
  document.getElementById('envio').textContent     = envio === 0 ? 'Gratis' : `$${Number(envio).toLocaleString('es-CO')}`;
  document.getElementById('total').textContent     = `$${Number(total).toLocaleString('es-CO')}`;
  document.getElementById('btn-checkout').disabled = total === 0;
}

async function cambiarCantidad(idCarrito, nuevaCantidad) {
  if (nuevaCantidad < 1) { eliminarItem(idCarrito); return; }
  try {
    const res = await apiFetch(`${API}/carrito/${idCarrito}`, {
      method: 'PUT',
      body: JSON.stringify({ cantidad: nuevaCantidad }),
    });
    if (!res) return;
    const data = await res.json();
    if (data.success) cargarCarrito();
  } catch {}
}

async function eliminarItem(idCarrito) {
  try {
    const res = await apiFetch(`${API}/carrito/${idCarrito}`, { method: 'DELETE' });
    if (!res) return;
    const data = await res.json();
    if (data.success) cargarCarrito();
  } catch {}
}

async function vaciarCarrito() {
  if (!confirm('¿Vaciar el carrito?')) return;
  try {
    const res = await apiFetch(`${API}/carrito`, { method: 'DELETE' });
    if (!res) return;
    const data = await res.json();
    if (data.success) cargarCarrito();
  } catch {}
}

function irACheckout() {
  window.location.href = '/checkout';
}

cargarCarrito();

const productId = window.location.pathname.split('/').pop();
let stockMax   = 0;
let esFavorito = false;
let tallaSel   = null; // Talla seleccionada por el comprador

// ── Toast helper ──────────────────────────────────────────────────────────────
function mostrarToast(mensaje, tipo = 'success') {
    const el   = document.getElementById('toast-notif');
    const body = document.getElementById('toast-body');
    if (!el || !body) return;
    body.textContent = mensaje;
    el.className = `toast align-items-center text-white border-0 position-fixed bottom-0 end-0 m-3 bg-${
        tipo === 'success' ? 'success' : tipo === 'danger' ? 'danger' : 'secondary'
    }`;
    bootstrap.Toast.getOrCreateInstance(el, { delay: 2800 }).show();
}

// ── Alert inline helper ───────────────────────────────────────────────────────
function mostrarAlerta(msg, tipo = 'info') {
    const el = document.getElementById('prodAlert');
    if (!el) return;
    el.className = `alert alert-${tipo}`;
    el.textContent = msg;
    el.classList.remove('d-none');
    setTimeout(() => el.classList.add('d-none'), 4000);
}

// ── Helper de estrellas ───────────────────────────────────────────────────────
function renderEstrellas(promedio, max = 5) {
    const full  = Math.floor(promedio);
    const half  = promedio - full >= 0.5 ? 1 : 0;
    const empty = max - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

// ── Cargar detalle del producto ───────────────────────────────────────────────
async function cargarDetalle() {
    if (!productId || isNaN(productId)) return window.location.href = '/marketplace';

    try {
        const res = await apiFetch(`${API}/productos/${productId}`);
        if (!res) { mostrarAlerta('No se pudo cargar el producto. Verifica que los servicios estén activos.', 'danger'); return; }
        const data = await res.json();
        if (!data.success || !data.producto) return window.location.href = '/marketplace';

        const p = data.producto;
        document.title = `${p.nombre_producto} - EmprendeMarket`;
        document.getElementById('prod-nombre').textContent = p.nombre_producto;
        document.getElementById('prod-desc').textContent   = p.descripcion || '';
        document.getElementById('breadcrumb-cat').textContent = p.categoria || 'Producto';
        document.getElementById('prod-img').src = p.imagen_url || '/img/no-image.png';

        if (p.tienda) {
            document.getElementById('tienda-link').textContent = p.tienda.nombre_tienda;
            document.getElementById('tienda-link').href = `/tienda/${p.tienda.id_tienda}`;
        }

        // Calificación promedio
        const resenas = p.resenas || [];
        if (p.calificacion_promedio > 0 || resenas.length > 0) {
            const prom = p.calificacion_promedio || 0;
            document.getElementById('ratingSection').classList.remove('d-none');
            document.getElementById('ratingEstrellas').textContent = renderEstrellas(prom);
            document.getElementById('ratingPromedio').textContent  = prom.toFixed(1);
            document.getElementById('ratingCantidad').textContent  = `(${resenas.length} reseña${resenas.length !== 1 ? 's' : ''})`;
        }

        // Stock global (puede cambiar si se selecciona talla con stock propio)
        stockMax = p.stock || 0;
        document.getElementById('prod-stock').textContent = `${stockMax} unidades disponibles`;
        document.getElementById('input-cant').max = stockMax;

        // Precio / promoción
        if (p.promocion && p.promocion.estado === 'activa') {
            const original  = p.precio;
            const descuento = p.promocion.tipo_descuento === 'porcentaje'
                ? original * (p.promocion.valor_descuento / 100)
                : p.promocion.valor_descuento;
            document.getElementById('precio-actual').textContent   = `$${(original - descuento).toLocaleString('es-CO')}`;
            document.getElementById('precio-original').textContent = `$${original.toLocaleString('es-CO')}`;
            document.getElementById('precio-original').classList.remove('d-none');
            document.getElementById('promo-badge').classList.remove('d-none');
            document.getElementById('promo-desc').textContent = `-${p.promocion.valor_descuento}${p.promocion.tipo_descuento === 'porcentaje' ? '%' : '$'} OFF: ${p.promocion.nombre_promocion}`;
            document.getElementById('promo-desc').classList.remove('d-none');
        } else {
            document.getElementById('precio-actual').textContent = `$${(p.precio || 0).toLocaleString('es-CO')}`;
        }

        // Tallas — soporte nuevo formato [{nombre, stock}] y antiguo [String]
        if (p.tallas && p.tallas.length > 0) {
            document.getElementById('tallasSection').classList.remove('d-none');
            document.getElementById('tallaMsgSel').classList.remove('d-none');
            const tallaContainer = document.getElementById('tallasDisplay');
            tallaContainer.innerHTML = p.tallas.map(t => {
                const nombre     = typeof t === 'string' ? t : t.nombre;
                const stockTalla = typeof t === 'object' && t.stock !== undefined ? t.stock : null;
                const sinStock   = stockTalla !== null && stockTalla <= 0;
                const pocaStock  = stockTalla !== null && stockTalla > 0 && stockTalla <= 3;
                return `<button type="button"
                    class="btn btn-sm btn-outline-secondary talla-btn${sinStock ? ' opacity-50' : ''}"
                    data-talla="${nombre}"
                    data-stock="${stockTalla !== null ? stockTalla : ''}"
                    onclick="${sinStock ? '' : `seleccionarTalla(this)`}"
                    style="border-radius:8px;font-size:.87rem;padding:.3rem .85rem;${sinStock ? 'cursor:not-allowed' : ''}"
                    title="${sinStock ? 'Sin stock' : stockTalla !== null ? `Stock: ${stockTalla}` : ''}"
                >${nombre}${pocaStock ? ' <small style="font-size:.7rem;color:#d97706">¡Poco!</small>' : ''}${sinStock ? ' <small style="font-size:.7rem">(agotado)</small>' : ''}</button>`;
            }).join('');
        }

        // Reseñas
        renderResenas(resenas);

        // Estado del favorito
        if (getToken()) cargarEstadoFavorito();

    } catch (err) {
        console.error('Error cargando detalle:', err);
        mostrarAlerta('Error inesperado al cargar el producto.', 'danger');
    }
}

// ── Selección de talla ────────────────────────────────────────────────────────
function seleccionarTalla(el) {
    document.querySelectorAll('.talla-btn').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline-secondary');
    });
    el.classList.remove('btn-outline-secondary');
    el.classList.add('btn-primary');
    tallaSel = el.dataset.talla;

    // Si la talla tiene stock propio, actualizar stockMax
    const ts = el.dataset.stock;
    if (ts !== '') {
        stockMax = parseInt(ts) || 0;
        document.getElementById('prod-stock').textContent = `${stockMax} disponibles en talla ${tallaSel}`;
        document.getElementById('input-cant').max = stockMax;
        document.getElementById('input-cant').value = Math.min(parseInt(document.getElementById('input-cant').value) || 1, stockMax || 1);
    }
    document.getElementById('tallaMsgSel')?.classList.add('d-none');
}

// ── Cantidad ──────────────────────────────────────────────────────────────────
function cambiarCant(val) {
    const input    = document.getElementById('input-cant');
    const nuevaCant = parseInt(input.value) + val;
    if (nuevaCant >= 1 && nuevaCant <= (stockMax || 99)) input.value = nuevaCant;
}

// ── Carrito ───────────────────────────────────────────────────────────────────
async function agregarAlCarrito() {
    if (!getToken()) return window.location.href = '/login';
    if (stockMax === 0) { mostrarAlerta('Producto sin stock disponible.', 'warning'); return; }

    // Validar talla si el producto la requiere
    const tieneTallas = document.querySelectorAll('.talla-btn').length > 0;
    if (tieneTallas && !tallaSel) {
        mostrarAlerta('Por favor selecciona una talla antes de agregar al carrito.', 'warning');
        document.getElementById('tallaMsgSel')?.classList.remove('d-none');
        document.getElementById('tallasDisplay').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
    }

    const btn     = document.getElementById('btnAgregarCarrito');
    const cantidad = parseInt(document.getElementById('input-cant').value);

    btn.disabled  = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Agregando...`;

    try {
        const res = await apiFetch(`${API}/carrito/agregar`, {
            method: 'POST',
            body: JSON.stringify({ id_producto: productId, cantidad, talla: tallaSel }),
        });

        if (!res) {
            mostrarToast('No se pudo conectar. ¿Están activos los servicios?', 'danger');
        } else {
            const data = await res.json();
            if (data.success) mostrarToast(`¡Producto añadido al carrito!${tallaSel ? ` Talla: ${tallaSel}` : ''}`, 'success');
            else mostrarToast(data.message || 'Error al añadir al carrito', 'danger');
        }
    } catch (err) {
        mostrarToast('Error inesperado al añadir al carrito', 'danger');
    } finally {
        btn.disabled  = false;
        btn.innerHTML = `<span class="material-symbols-outlined align-middle me-1">add_shopping_cart</span>Añadir al carrito`;
    }
}

// ── Reseñas ───────────────────────────────────────────────────────────────────
function renderResenas(resenas) {
    if (!resenas || !resenas.length) return;

    const sec = document.getElementById('seccionResenas');
    const lista = document.getElementById('listaResenas');
    if (!sec || !lista) return;
    sec.classList.remove('d-none');

    lista.innerHTML = resenas.map(r => {
        const estrellas = '★'.repeat(r.calificacion || 0) + '☆'.repeat(5 - (r.calificacion || 0));
        const fecha     = r.fecha_resena
            ? new Date(r.fecha_resena).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
            : '';
        const foto      = r.foto_url
            ? `<img src="${r.foto_url}" class="rounded mt-2" style="max-height:140px;max-width:100%;object-fit:cover;cursor:pointer"
                    onclick="this.style.maxHeight=this.style.maxHeight==='none'?'140px':'none'"
                    onerror="this.style.display='none'" alt="Foto de reseña">`
            : '';
        const nombre    = r.nombre_comprador || 'Comprador';

        return `<div class="border-bottom pb-3 mb-3">
            <div class="d-flex align-items-start gap-3">
                <div class="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center flex-shrink-0"
                     style="width:40px;height:40px;font-size:1.1rem;font-weight:600">
                    ${nombre.charAt(0).toUpperCase()}
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
                        <span class="fw-semibold small">${nombre}</span>
                        <span class="text-muted" style="font-size:.75rem">${fecha}</span>
                    </div>
                    <div class="text-warning mb-1" style="font-size:1rem;letter-spacing:.05em">${estrellas}</div>
                    ${r.comentario ? `<p class="mb-1 small text-dark">${r.comentario}</p>` : ''}
                    ${foto}
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── Favoritos ─────────────────────────────────────────────────────────────────
async function cargarEstadoFavorito() {
    try {
        const res = await apiFetch(`${API}/favoritos`);
        if (!res) return;
        const data = await res.json();
        esFavorito  = (data.favoritos || []).some(f => String(f.id_producto) === String(productId));
        actualizarBtnFav();
    } catch {}
}

function actualizarBtnFav() {
    const icon = document.getElementById('iconFav');
    const btn  = document.getElementById('btnFav');
    if (!icon || !btn) return;
    if (esFavorito) {
        icon.textContent = 'favorite';
        icon.style.fontVariationSettings = "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24";
        btn.classList.add('btn-danger');
        btn.classList.remove('btn-outline-danger');
        btn.title = 'Quitar de favoritos';
    } else {
        icon.textContent = 'favorite_border';
        icon.style.fontVariationSettings = "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-outline-danger');
        btn.title = 'Añadir a favoritos';
    }
}

async function toggleFavorito() {
    if (!getToken()) return window.location.href = '/login';
    try {
        if (esFavorito) {
            const res = await apiFetch(`${API}/favoritos/${productId}`, { method: 'DELETE' });
            if (!res) return;
            const data = await res.json();
            if (data.success) { esFavorito = false; actualizarBtnFav(); mostrarToast('Eliminado de favoritos', 'secondary'); }
        } else {
            const res = await apiFetch(`${API}/favoritos`, {
                method: 'POST',
                body: JSON.stringify({ id_producto: productId }),
            });
            if (!res) return;
            const data = await res.json();
            if (data.success) { esFavorito = true; actualizarBtnFav(); mostrarToast('¡Añadido a favoritos!', 'success'); }
            else mostrarToast(data.message || 'Error', 'danger');
        }
    } catch (err) {
        mostrarToast('Error al actualizar favorito', 'danger');
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────
window.onload = () => {
    cargarDetalle();
    renderNavbarUsuario('nav-user');
};

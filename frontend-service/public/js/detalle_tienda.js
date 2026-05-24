const tiendaId = window.location.pathname.split('/').pop();

async function cargarTienda() {
    if (!tiendaId) return window.location.href = '/marketplace';

    try {
        const res = await apiFetch(`/api/tiendas/${tiendaId}`);
        const data = await res.json();

        if (!data.success || !data.tienda) {
            document.getElementById('tienda-contenido').innerHTML = '<div class="alert alert-warning">Tienda no encontrada.</div>';
            return;
        }

        const t = data.tienda;
        document.title = `${t.nombre_tienda} | EmprendeMarket`;

        document.getElementById('tienda-nombre').textContent = t.nombre_tienda;
        document.getElementById('tienda-descripcion').textContent = t.descripcion || 'Sin descripción.';
        document.getElementById('tienda-categoria').textContent = t.categoria || 'General';

        if (t.horario_atencion) {
            document.getElementById('tienda-horario').textContent = t.horario_atencion;
        } else {
            document.getElementById('fila-horario').classList.add('d-none');
        }

        if (t.telefono_contacto) {
            document.getElementById('tienda-telefono').textContent = t.telefono_contacto;
        } else {
            document.getElementById('fila-telefono').classList.add('d-none');
        }

        const productos = t.productos || [];
        document.getElementById('stat-productos').textContent = productos.length;
        document.getElementById('stat-fecha').textContent = t.fecha_creacion
            ? new Date(t.fecha_creacion).getFullYear()
            : '—';

        renderProductos(productos);
    } catch (err) {
        console.error('Error al cargar tienda:', err);
        document.getElementById('tienda-contenido').innerHTML = '<div class="alert alert-danger">Error al cargar la tienda.</div>';
    }
}

function renderProductos(productos) {
    const grid = document.getElementById('productos-grid');

    if (productos.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center py-5 text-muted"><span class="material-symbols-outlined icon-xl">inventory_2</span><p class="mt-2">Esta tienda aún no tiene productos.</p></div>';
        return;
    }

    grid.innerHTML = productos.map(p => `
        <div class="col-sm-6 col-lg-4">
            <div class="producto-card">
                <div class="producto-imagen">
                    <img src="${p.imagen_url || '/img/no-image.png'}" alt="${p.nombre_producto}" onerror="this.src='/img/no-image.png'">
                </div>
                <div class="p-3">
                    <h6 class="fw-semibold text-truncate mb-1">${p.nombre_producto}</h6>
                    <p class="small text-muted text-truncate mb-2">${p.descripcion || ''}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold text-primary">$${(p.precio || 0).toLocaleString()}</span>
                        <span class="small text-muted">${p.stock > 0 ? `Stock: ${p.stock}` : '<span class="text-danger">Agotado</span>'}</span>
                    </div>
                    <a href="/producto/${p.id_producto}" class="btn btn-primary btn-sm w-100 mt-3">
                        <span class="material-symbols-outlined icon-sm me-1">visibility</span>Ver producto
                    </a>
                </div>
            </div>
        </div>
    `).join('');
}

window.onload = cargarTienda;
const tiendaId = window.location.pathname.split('/').pop();

// Colores de banner por categoría
const BANNER_GRADIENTS = {
  'Ropa':                'linear-gradient(135deg,#fce7f3,#fbcfe8)',
  'Zapatos / Calzado':   'linear-gradient(135deg,#fef9c3,#fde68a)',
  'Ropa Infantil':       'linear-gradient(135deg,#dcfce7,#bbf7d0)',
  'Bolsos y Accesorios': 'linear-gradient(135deg,#ede9fe,#ddd6fe)',
  'Deportes':            'linear-gradient(135deg,#cffafe,#a5f3fc)',
  'Alimentos':           'linear-gradient(135deg,#ffedd5,#fed7aa)',
  'Artesanías':          'linear-gradient(135deg,#ede9fe,#c4b5fd)',
  'Tecnología':          'linear-gradient(135deg,#dbeafe,#bfdbfe)',
  'Hogar':               'linear-gradient(135deg,#d1fae5,#a7f3d0)',
  'Belleza':             'linear-gradient(135deg,#fce7f3,#f9a8d4)',
  'Joyería':             'linear-gradient(135deg,#fef9c3,#fde68a)',
  'General':             'linear-gradient(135deg,#f3f4f6,#e5e7eb)',
};

async function cargarTienda() {
  if (!tiendaId) return (window.location.href = '/marketplace');

  try {
    const res  = await fetch(`/api/tiendas/${tiendaId}`);
    const data = await res.json();

    if (!data.success || !data.tienda) {
      document.getElementById('tienda-contenido').innerHTML =
        '<div class="alert alert-warning">Tienda no encontrada.</div>';
      return;
    }

    const t = data.tienda;
    document.title = `${t.nombre_tienda} | EmprendeMarket`;

    // Banner con gradiente de color de categoría
    const banner = document.getElementById('tienda-banner');
    banner.style.background = BANNER_GRADIENTS[t.categoria] || BANNER_GRADIENTS['General'];

    // Logo de la tienda
    const logoWrap = document.getElementById('tienda-logo-wrap');
    if (t.logo_url) {
      logoWrap.innerHTML = `
        <img src="${t.logo_url}" alt="${t.nombre_tienda}"
             style="width:90px;height:90px;object-fit:cover;border-radius:50%;border:4px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,.15)"
             onerror="this.outerHTML='<div class=\'rounded-circle bg-white d-flex align-items-center justify-content-center shadow\' style=\'width:90px;height:90px;border:4px solid #fff\'><span class=\'material-symbols-outlined text-primary\' style=\'font-size:42px\'>store</span></div>'">`;
    }

    // Info básica
    document.getElementById('tienda-nombre').textContent      = t.nombre_tienda;
    document.getElementById('tienda-descripcion').textContent = t.descripcion || 'Sin descripción.';
    document.getElementById('tienda-categoria').textContent   = t.categoria   || 'General';

    // Propietario
    if (t.propietario) {
      const nombre = `${t.propietario.nombre || ''} ${t.propietario.apellido || ''}`.trim();
      document.getElementById('propietario-nombre').textContent = nombre || '—';

      if (t.propietario.foto_perfil) {
        document.getElementById('propietario-foto-wrap').innerHTML =
          `<img src="${t.propietario.foto_perfil}" alt="${nombre}"
                style="width:56px;height:56px;object-fit:cover;border-radius:50%"
                onerror="this.outerHTML='<span class=\'material-symbols-outlined text-white\' style=\'font-size:28px\'>person</span>'">`;
      }
    }

    // Horario y teléfono
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

    // Stats
    const productos = t.productos || [];
    document.getElementById('stat-productos').textContent = productos.length;
    document.getElementById('stat-fecha').textContent     = t.fecha_creacion
      ? new Date(t.fecha_creacion).getFullYear() : '—';

    renderProductos(productos);

  } catch (err) {
    console.error('Error al cargar tienda:', err);
    document.getElementById('tienda-contenido').innerHTML =
      '<div class="alert alert-danger">Error al cargar la tienda. Inténtalo de nuevo.</div>';
  }
}

function renderProductos(productos) {
  const grid = document.getElementById('productos-grid');

  if (!productos.length) {
    grid.innerHTML = `
      <div class="col-12 text-center py-5 text-muted">
        <span class="material-symbols-outlined icon-xl">inventory_2</span>
        <p class="mt-2">Esta tienda aún no tiene productos.</p>
        <a href="/marketplace" class="btn btn-outline-primary btn-sm mt-2">Ver otros productos</a>
      </div>`;
    return;
  }

  grid.innerHTML = productos.map(p => `
    <div class="col-sm-6 col-lg-4">
      <div class="producto-card">
        <div class="producto-imagen">
          <img src="${p.imagen_url || 'https://via.placeholder.com/400x300?text=Producto'}"
               alt="${p.nombre_producto}"
               onerror="this.src='https://via.placeholder.com/400x300?text=Sin+imagen'">
          ${p.stock <= 0 ? `<span class="badge bg-danger position-absolute top-0 end-0 m-2">Agotado</span>` : ''}
        </div>
        <div class="p-3">
          <h6 class="fw-semibold text-truncate mb-1">${p.nombre_producto}</h6>
          <p class="small text-muted text-truncate mb-2">${p.descripcion || ''}</p>
          ${p.tallas?.length ? `<div class="d-flex flex-wrap gap-1 mb-2">${p.tallas.map(t => `<span class="badge bg-light text-dark border" style="font-size:.7rem">${typeof t === 'object' ? t.nombre : t}</span>`).join('')}</div>` : ''}
          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="fw-bold text-primary">$${(p.precio || 0).toLocaleString('es-CO')}</span>
            <span class="small text-muted">${p.stock > 0 ? `${p.stock} disp.` : '<span class="text-danger fw-semibold">Agotado</span>'}</span>
          </div>
          <a href="/producto/${p.id_producto}" class="btn btn-primary btn-sm w-100">
            <span class="material-symbols-outlined icon-sm me-1">visibility</span>Ver producto
          </a>
        </div>
      </div>
    </div>
  `).join('');
}

window.onload = cargarTienda;

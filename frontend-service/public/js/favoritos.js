async function cargarFavoritos() {
    protegerPagina(['comprador']);
    const grid = document.getElementById('favoritos-grid');

    try {
        const res = await apiFetch('/api/favoritos');
        const data = await res.json();
        const favoritos = data.favoritos || [];

        if (favoritos.length === 0) {
            grid.innerHTML = '<div class="col-12 text-center py-5"><span class="material-symbols-outlined icon-xl text-muted">favorite_border</span><h5 class="mt-3 text-muted">No tienes productos favoritos aún.</h5></div>';
            return;
        }

        grid.innerHTML = favoritos.map(f => `
            <div class="col-md-3 col-sm-6" id="fav-${f.id_producto}">
                <div class="card h-100 shadow-soft border-0">
                    <img src="${f.imagen_url || '/img/no-image.png'}" class="card-img-top" style="height:180px;object-fit:cover">
                    <div class="card-body">
                        <h6 class="card-title text-truncate">${f.nombre_producto}</h6>
                        <p class="fw-bold text-primary mb-3">$${(f.precio || 0).toLocaleString()}</p>
                        <div class="d-grid gap-2">
                            <a href="/producto/${f.id_producto}" class="btn btn-sm btn-primary">Ver producto</a>
                            <button onclick="quitarFavorito(${f.id_producto})" class="btn btn-sm btn-outline-danger">
                                <span class="material-symbols-outlined icon-sm me-1">heart_minus</span>Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        grid.innerHTML = '<div class="col-12"><div class="alert alert-danger">Error al cargar favoritos.</div></div>';
    }
}

async function quitarFavorito(id) {
    try {
        const res = await apiFetch(`/api/favoritos/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) document.getElementById(`fav-${id}`)?.remove();
    } catch (err) {
        console.error('Error al quitar favorito:', err);
    }
}

window.onload = cargarFavoritos;

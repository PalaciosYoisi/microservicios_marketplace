async function cargarNotificaciones() {
    protegerPagina();
    const lista = document.getElementById('notificaciones-lista');

    try {
        const res = await apiFetch('/api/notificaciones');
        const data = await res.json();
        const notificaciones = data.notificaciones || [];

        if (notificaciones.length === 0) {
            lista.innerHTML = '<div class="list-group-item text-center py-5 text-muted"><span class="material-symbols-outlined icon-xl">notifications_off</span><p class="mt-2 mb-0">No tienes notificaciones</p></div>';
            return;
        }

        lista.innerHTML = notificaciones.map(n => `
            <div class="notificacion-item ${n.leida ? '' : 'no-leida'}">
                <div class="notificacion-icono ${n.tipo || 'sistema'}">
                    <span class="material-symbols-outlined icon-sm">${iconoTipo(n.tipo)}</span>
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-start">
                        <strong class="small">${n.titulo || 'Notificación'}</strong>
                        <span class="notificacion-fecha">${formatearFecha(n.fecha_creacion)}</span>
                    </div>
                    <p class="mb-0 small text-muted">${n.mensaje || ''}</p>
                </div>
            </div>
        `).join('');
    } catch (err) {
        lista.innerHTML = '<div class="alert alert-danger m-3">Error al cargar notificaciones</div>';
    }
}

function iconoTipo(tipo) {
    const iconos = { pedido: 'shopping_bag', resena: 'star', tienda: 'store', sistema: 'info' };
    return iconos[tipo] || 'notifications';
}

function formatearFecha(fecha) {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function marcarTodasLeidas() {
    try {
        const res = await apiFetch('/api/notificaciones/marcar-todas-leidas', { method: 'POST' });
        const data = await res.json();
        if (data.success) cargarNotificaciones();
    } catch (err) {
        console.error('Error al marcar notificaciones:', err);
    }
}

window.onload = cargarNotificaciones;

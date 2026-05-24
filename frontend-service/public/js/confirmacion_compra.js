async function cargarConfirmacion() {
    protegerPagina(['comprador']);
    const urlParams = new URLSearchParams(window.location.search);
    const pedidoId = urlParams.get('pedido_id');

    if (!pedidoId) return window.location.href = '/marketplace';

    try {
        const res = await apiFetch(`/api/comprador/pedidos/${pedidoId}`);
        if (!res) return;
        const data = await res.json();

        if (data.success && data.pedido) {
            document.getElementById('conf-pedido-id').textContent = `#${data.pedido.id_pedido}`;
            document.getElementById('conf-total').textContent     = `$${(data.pedido.total || 0).toLocaleString('es-CO')}`;
        }
    } catch (err) {
        console.error('Error al cargar confirmación:', err);
    }
}

window.onload = cargarConfirmacion;
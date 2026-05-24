document.addEventListener('DOMContentLoaded', () => {
    protegerPagina();

    document.getElementById('form-reporte').onsubmit = async (e) => {
        e.preventDefault();
        const alertEl = document.getElementById('reporte-alert');
        const btn = e.target.querySelector('button[type="submit"]');

        const formData = {
            motivo: document.getElementById('tipo_reporte').value,
            descripcion: document.getElementById('descripcion').value
        };

        try {
            btn.disabled = true;
            const res = await apiFetch('/api/reportes', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            alertEl.className = `alert mt-3 alert-${data.success ? 'success' : 'danger'}`;
            alertEl.textContent = data.message || (data.success ? 'Reporte enviado con éxito.' : 'Error al enviar.');
            alertEl.classList.remove('d-none');
            if (data.success) e.target.reset();
        } catch (err) {
            alertEl.className = 'alert mt-3 alert-danger';
            alertEl.textContent = 'Error al conectar con el servidor.';
            alertEl.classList.remove('d-none');
        } finally {
            btn.disabled = false;
        }
    };
});
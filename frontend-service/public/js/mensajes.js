let chatActivo = null;
let destinatarioActivo = null;
let miId = null;

async function cargarConversaciones() {
    const usuario = protegerPagina();
    if (!usuario) return;
    miId = usuario.id;

    try {
        const res = await apiFetch('/api/mensajes');
        const data = await res.json();
        const conversaciones = data.conversaciones || [];

        const lista = document.getElementById('chats-list');
        if (conversaciones.length === 0) {
            lista.innerHTML = '<div class="p-3 text-center text-muted small">Sin conversaciones</div>';
            return;
        }

        lista.innerHTML = conversaciones.map(c => {
            const otro = c.otro_usuario || {};
            const nombre = `${otro.nombre || ''} ${otro.apellido || ''}`.trim() || 'Usuario';
            const ultimo = c.ultimo_mensaje?.contenido || '';
            const fecha = formatearFecha(c.ultimo_mensaje?.fecha_envio);
            const noLeidos = c.no_leidos || 0;

            return `<div class="conversacion-item" onclick="abrirChat('${c.id_conversacion}', '${nombre}', ${otro.id_usuario || 0})">
                <div class="conversacion-avatar">${nombre.charAt(0).toUpperCase()}</div>
                <div class="flex-grow-1 overflow-hidden">
                    <div class="d-flex justify-content-between">
                        <strong class="small">${nombre}</strong>
                        <span class="text-muted" style="font-size:0.7rem">${fecha}</span>
                    </div>
                    <p class="mb-0 text-truncate text-muted small">${ultimo}</p>
                </div>
                ${noLeidos > 0 ? `<span class="badge bg-primary rounded-pill">${noLeidos}</span>` : ''}
            </div>`;
        }).join('');
    } catch (e) {
        console.error('Error al cargar conversaciones:', e);
    }
}

async function abrirChat(convId, nombre, destId) {
    chatActivo = convId;
    destinatarioActivo = destId;
    document.getElementById('chat-user-name').textContent = nombre;
    document.getElementById('input-msg').disabled = false;
    document.getElementById('btn-send').disabled = false;

    try {
        const res = await apiFetch(`/api/mensajes/${convId}`);
        const data = await res.json();
        const mensajes = data.mensajes || [];

        const container = document.getElementById('messages-container');
        container.innerHTML = mensajes.map(m => {
            const esMio = m.id_remitente === miId;
            return `<div class="d-flex ${esMio ? 'justify-content-end' : 'justify-content-start'}">
                <div class="burbuja ${esMio ? 'enviado' : 'recibido'}">
                    ${m.contenido}
                    <div class="text-end opacity-75" style="font-size:0.65rem;margin-top:4px">${formatearFecha(m.fecha_envio)}</div>
                </div>
            </div>`;
        }).join('');
        container.scrollTop = container.scrollHeight;
    } catch (e) {
        console.error('Error al abrir chat:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('form-msg').onsubmit = async (e) => {
        e.preventDefault();
        const input = document.getElementById('input-msg');
        const text = input.value.trim();
        if (!text || !destinatarioActivo) return;

        try {
            await apiFetch('/api/mensajes/enviar', {
                method: 'POST',
                body: JSON.stringify({ id_destinatario: destinatarioActivo, contenido: text })
            });
            input.value = '';
            abrirChat(chatActivo, document.getElementById('chat-user-name').textContent, destinatarioActivo);
        } catch (e) {
            console.error('Error al enviar mensaje:', e);
        }
    };
});

function formatearFecha(fecha) {
    if (!fecha) return '';
    return new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

window.onload = cargarConversaciones;
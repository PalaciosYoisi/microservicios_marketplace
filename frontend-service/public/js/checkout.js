protegerPagina(['comprador']);

// ── Estado global ─────────────────────────────────────────────────────────────
let carritoData   = null;      // { items, total, subtotal }
let metodoPago    = 'tarjeta_credito';
let direccionFinal = '';
let telefonoFinal  = '';

// ── Toast helper ──────────────────────────────────────────────────────────────
function toast(msg, tipo = 'success') {
  const el   = document.getElementById('toast-notif');
  const body = document.getElementById('toast-body');
  if (!el || !body) return;
  body.textContent = msg;
  el.className = `toast align-items-center text-white border-0 position-fixed bottom-0 end-0 m-3 bg-${tipo === 'success' ? 'success' : tipo === 'danger' ? 'danger' : 'secondary'}`;
  bootstrap.Toast.getOrCreateInstance(el, { delay: 3200 }).show();
}

function alertaEl(id, msg, tipo = 'danger') {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${tipo}`;
  el.textContent = msg;
  el.classList.remove('d-none');
  setTimeout(() => el.classList.add('d-none'), 5000);
}

// ── Pasos ─────────────────────────────────────────────────────────────────────
function setStep(n) {
  [1, 2, 3].forEach(i => {
    document.getElementById(`paso${i}`)?.classList.toggle('d-none', i !== n);
    const dot = document.getElementById(`dot${i}`);
    if (dot) {
      dot.classList.remove('active', 'done');
      if (i < n)  dot.classList.add('done');
      if (i === n) dot.classList.add('active');
    }
    if (i < 3) {
      document.getElementById(`line${i}`)?.classList.toggle('done', i < n);
    }
  });
  const labels = { 1: 'Entrega', 2: 'Pago', 3: 'Procesando…' };
  document.getElementById('step-label').textContent = labels[n] || '';
}

function irPaso1() { setStep(1); }

function irPaso2() {
  const sel     = document.getElementById('select-direccion');
  const calle   = document.getElementById('nueva-calle')?.value?.trim();
  const numero  = document.getElementById('nueva-numero')?.value?.trim();
  const ciudad  = document.getElementById('nueva-ciudad')?.value?.trim();

  // Si el formulario de nueva dirección está abierto y tiene datos, usar esa
  const formAbierto = document.getElementById('nuevaDirForm')?.classList.contains('show');
  if (formAbierto && calle && ciudad) {
    direccionFinal = `${calle} ${numero || ''}, ${ciudad}`.trim();
  } else if (sel.value) {
    direccionFinal = sel.value;
  } else {
    alertaEl('alertaPaso1', 'Selecciona o ingresa una dirección de entrega.', 'warning');
    return;
  }

  telefonoFinal = document.getElementById('input-telefono')?.value?.trim() || '';
  setStep(2);
}

// ── Selección de método ───────────────────────────────────────────────────────
function seleccionarMetodo(card) {
  document.querySelectorAll('.metodo-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  metodoPago = card.dataset.metodo;
}

// ── Iniciar pago según método ─────────────────────────────────────────────────
function iniciarPago() {
  const total = carritoData?.total || 0;
  const fmt   = `$${total.toLocaleString('es-CO')}`;

  switch (metodoPago) {
    case 'tarjeta_credito':
    case 'tarjeta_debito':
      document.getElementById('wMontoLabel').textContent = fmt;
      new bootstrap.Modal(document.getElementById('wompiModal')).show();
      break;
    case 'nequi':
      document.getElementById('nequiMontoLabel').textContent = fmt;
      new bootstrap.Modal(document.getElementById('nequiModal')).show();
      break;
    case 'pse':
      document.getElementById('pseMontoLabel').textContent = fmt;
      new bootstrap.Modal(document.getElementById('pseModal')).show();
      break;
    case 'contraentrega':
      confirmarContraentrega();
      break;
    default:
      alertaEl('alertaPago', 'Selecciona un método de pago.', 'warning');
  }
}

// ── Pago contraentrega (sin modal) ────────────────────────────────────────────
async function confirmarContraentrega() {
  if (!confirm('¿Confirmas tu pedido con pago contraentrega? El repartidor cobrará en efectivo al entregar.')) return;
  setStep(3);
  await crearPedido('contraentrega');
}

// ── Formateo de tarjeta ───────────────────────────────────────────────────────
function formatCardNum(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 16);
  input.value = v.replace(/(.{4})/g, '$1 ').trim();
  document.getElementById('wCardNumDisplay').textContent =
    (v.padEnd(16, '•')).replace(/(.{4})/g, '$1 ').trim();

  // Detectar marca
  let brand = 'VISA';
  if (/^4/.test(v))             brand = 'VISA';
  else if (/^5[1-5]/.test(v))  brand = 'MC';
  else if (/^3[47]/.test(v))   brand = 'AMEX';
  else if (/^6/.test(v))       brand = 'DINERS';
  document.getElementById('wBrandLabel').textContent  = brand;
  document.getElementById('wCardBrand').textContent   = brand;
}

function formatExp(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 4);
  if (v.length >= 3) v = v.substring(0, 2) + '/' + v.substring(2);
  input.value = v;
  document.getElementById('wCardExpDisplay').textContent = v || 'MM/AA';
}

// ── Validar tarjeta (Luhn simplificado) ───────────────────────────────────────
function luhnCheck(num) {
  const digits = num.replace(/\D/g, '').split('').reverse().map(Number);
  const sum = digits.reduce((acc, d, i) => {
    if (i % 2 !== 0) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    return acc + d;
  }, 0);
  return sum % 10 === 0;
}

// ── Pago Wompi ────────────────────────────────────────────────────────────────
async function pagarWompi(e) {
  e.preventDefault();
  const num    = document.getElementById('wCardNum').value.replace(/\s/g, '');
  const holder = document.getElementById('wCardHolder').value.trim();
  const exp    = document.getElementById('wCardExp').value;
  const cvv    = document.getElementById('wCardCvv').value;
  const cuotas = document.getElementById('wCuotas').value;

  document.getElementById('alertaWompi').classList.add('d-none');

  // Validaciones básicas
  if (num.length < 15) {
    alertaEl('alertaWompi', 'Número de tarjeta inválido.', 'danger'); return;
  }
  if (!luhnCheck(num)) {
    alertaEl('alertaWompi', 'El número de tarjeta no es válido. Verifica los datos.', 'danger'); return;
  }
  if (!/^\d{2}\/\d{2}$/.test(exp)) {
    alertaEl('alertaWompi', 'Fecha de vencimiento inválida.', 'danger'); return;
  }
  // Verificar que no esté vencida
  const [mm, yy] = exp.split('/').map(Number);
  const hoy = new Date();
  if (mm < 1 || mm > 12 || (yy + 2000) < hoy.getFullYear() ||
      ((yy + 2000) === hoy.getFullYear() && mm < hoy.getMonth() + 1)) {
    alertaEl('alertaWompi', 'La tarjeta está vencida.', 'danger'); return;
  }
  if (cvv.length < 3) {
    alertaEl('alertaWompi', 'CVV inválido.', 'danger'); return;
  }

  // Mostrar overlay
  const overlay  = document.getElementById('wompiOverlay');
  const msgEl    = document.getElementById('wompiOverlayMsg');
  const btnPagar = document.getElementById('btnWompiPagar');
  overlay.classList.remove('d-none');
  btnPagar.disabled = true;

  // Simular flujo de verificación
  const pasos = [
    'Verificando datos de la tarjeta…',
    'Consultando con el banco emisor…',
    'Aplicando validación 3D Secure…',
    'Autorizando transacción…',
  ];
  for (const paso of pasos) {
    msgEl.textContent = paso;
    await delay(700 + Math.random() * 400);
  }

  // Simular resultado (98% éxito en demo)
  const exito = Math.random() > 0.02;
  if (!exito) {
    overlay.classList.add('d-none');
    btnPagar.disabled = false;
    alertaEl('alertaWompi',
      'Pago rechazado por el banco. Verifica los datos o usa otro método.', 'danger');
    return;
  }

  // Cerrar modal y crear pedido
  bootstrap.Modal.getInstance(document.getElementById('wompiModal'))?.hide();
  await delay(300);
  setStep(3);
  const txnId = `WOMPI-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  await crearPedido('tarjeta_credito', txnId, { cuotas, ultimos4: num.slice(-4) });
}

// ── Pago Nequi ────────────────────────────────────────────────────────────────
async function pagarNequi(e) {
  e.preventDefault();
  const tel = document.getElementById('nequiTel').value.trim();
  document.getElementById('alertaNequi').classList.add('d-none');

  if (!/^3\d{9}$/.test(tel)) {
    alertaEl('alertaNequi', 'Ingresa un número de celular colombiano válido (10 dígitos, empieza con 3).', 'danger');
    return;
  }

  const overlay = document.getElementById('nequiOverlay');
  const msgEl   = document.getElementById('nequiOverlayMsg');
  overlay.classList.remove('d-none');

  const pasos = [
    `Verificando número +57 ${tel}…`,
    'Consultando cuenta Nequi…',
    'Enviando notificación push a tu app…',
    'Esperando confirmación del usuario…',
    'Procesando débito…',
  ];
  for (const paso of pasos) {
    msgEl.textContent = paso;
    await delay(600 + Math.random() * 500);
  }

  const exito = Math.random() > 0.03;
  if (!exito) {
    overlay.classList.add('d-none');
    alertaEl('alertaNequi', 'El pago fue rechazado. Verifica saldo o intenta de nuevo.', 'danger');
    return;
  }

  bootstrap.Modal.getInstance(document.getElementById('nequiModal'))?.hide();
  await delay(300);
  setStep(3);
  const txnId = `NEQUI-${Date.now()}-${tel.slice(-4)}`;
  await crearPedido('nequi', txnId);
}

// ── Pago PSE ──────────────────────────────────────────────────────────────────
async function pagarPSE(e) {
  e.preventDefault();
  const banco   = document.getElementById('pseBanco').value;
  const doc     = document.getElementById('pseDoc').value.trim();
  const tipoDoc = document.getElementById('pseTipoDoc').value;
  document.getElementById('alertaPSE').classList.add('d-none');

  if (!banco) {
    alertaEl('alertaPSE', 'Selecciona tu banco.', 'danger'); return;
  }
  if (!doc || doc.length < 5) {
    alertaEl('alertaPSE', 'Ingresa un número de documento válido.', 'danger'); return;
  }

  const overlay = document.getElementById('pseOverlay');
  const msgEl   = document.getElementById('pseOverlayMsg');
  overlay.classList.remove('d-none');

  const pasos = [
    `Conectando con ${banco.replace('_', ' ')}…`,
    'Verificando identidad del titular…',
    'Procesando débito bancario…',
    'Confirmando transacción con ACH Colombia…',
  ];
  for (const paso of pasos) {
    msgEl.textContent = paso;
    await delay(800 + Math.random() * 600);
  }

  const exito = Math.random() > 0.02;
  if (!exito) {
    overlay.classList.add('d-none');
    alertaEl('alertaPSE', 'La transacción PSE fue rechazada. Intenta de nuevo.', 'danger');
    return;
  }

  bootstrap.Modal.getInstance(document.getElementById('pseModal'))?.hide();
  await delay(300);
  setStep(3);
  const txnId = `PSE-${Date.now()}-${banco.toUpperCase().substring(0, 4)}`;
  await crearPedido('pse', txnId);
}

// ── Crear pedido en backend ───────────────────────────────────────────────────
async function crearPedido(metodo, txnId = null, extras = {}) {
  try {
    const body = {
      direccion_envio: direccionFinal,
      telefono:        telefonoFinal,
      metodo_pago:     metodo,
    };
    if (txnId) body.transaccion_id = txnId;
    if (extras.cuotas) body.cuotas = extras.cuotas;
    if (extras.ultimos4) body.ultimos4_tarjeta = extras.ultimos4;

    const res = await apiFetch(`${API}/checkout/procesar`, {
      method: 'POST',
      body:   JSON.stringify(body),
    });

    if (!res) {
      setStep(2);
      toast('No se pudo conectar con el servidor. ¿Están activos los servicios?', 'danger');
      return;
    }

    const data = await res.json();
    if (data.success) {
      window.location.href = `/confirmacion-compra?pedido_id=${data.pedido.id_pedido}`;
    } else {
      setStep(2);
      toast(data.message || 'Error al procesar el pedido.', 'danger');
    }
  } catch (err) {
    console.error('[checkout] crearPedido:', err);
    setStep(2);
    toast('Error inesperado al crear el pedido.', 'danger');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Inicialización ────────────────────────────────────────────────────────────
async function inicializarCheckout() {
  try {
    const [resCarrito, resDirecciones] = await Promise.all([
      apiFetch(`${API}/carrito`),
      apiFetch(`${API}/comprador/direcciones`),
    ]);

    // Carrito
    if (resCarrito) {
      const cd = await resCarrito.json();
      const items    = cd.items || [];
      const subtotal = items.reduce((s, i) => {
        const precio = Number(i.precio_unitario || i.producto?.precio || 0);
        return s + precio * i.cantidad;
      }, 0);
      const envio = subtotal > 100000 ? 0 : 8000;
      const total = subtotal + envio;

      carritoData = { items, total, subtotal };

      document.getElementById('resumen-items').innerHTML = items.length
        ? items.map(i => {
            const nombre  = i.producto?.nombre_producto || 'Producto';
            const precio  = Number(i.precio_unitario || i.producto?.precio || 0);
            return `<div class="d-flex justify-content-between mb-2 small">
              <span class="text-dark">${i.cantidad}× <span class="fw-medium">${nombre}</span></span>
              <span class="fw-semibold">$${(precio * i.cantidad).toLocaleString('es-CO')}</span>
            </div>`;
          }).join('')
        : '<p class="text-muted small text-center">Tu carrito está vacío.</p>';

      document.getElementById('resumen-subtotal').textContent = `$${subtotal.toLocaleString('es-CO')}`;
      document.getElementById('resumen-envio').textContent    = envio === 0 ? 'Gratis 🎉' : `$${envio.toLocaleString('es-CO')}`;
      document.getElementById('checkout-total').textContent   = `$${total.toLocaleString('es-CO')}`;

      if (!items.length) {
        document.getElementById('btnPagar')?.setAttribute('disabled', true);
        toast('Tu carrito está vacío.', 'secondary');
      }
    } else {
      toast('No se pudo cargar el carrito.', 'danger');
    }

    // Direcciones guardadas
    if (resDirecciones) {
      const dd = await resDirecciones.json();
      const dirs = dd.direcciones || [];
      const sel  = document.getElementById('select-direccion');
      sel.innerHTML = dirs.length
        ? dirs.map(d => `<option value="${d.direccion || d.calle || ''}, ${d.ciudad || ''}">${d.descripcion || d.direccion || d.calle || 'Dirección'}, ${d.ciudad || ''}</option>`).join('')
        : '<option value="">— Sin direcciones guardadas —</option>';
    }

  } catch (err) {
    console.error('[checkout] Error inicializando:', err);
    toast('Error al cargar el checkout.', 'danger');
  }
}

window.onload = inicializarCheckout;

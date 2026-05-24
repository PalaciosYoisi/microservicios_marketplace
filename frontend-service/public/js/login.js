const API = '/api';

function mostrarLogin() {
  document.getElementById('loginForm').classList.replace('form-hidden', 'form-visible');
  document.getElementById('registerForm').classList.replace('form-visible', 'form-hidden');
  document.getElementById('login-tab').classList.add('tab-active');
  document.getElementById('register-tab').classList.remove('tab-active');
}

function mostrarRegistro() {
  document.getElementById('registerForm').classList.replace('form-hidden', 'form-visible');
  document.getElementById('loginForm').classList.replace('form-visible', 'form-hidden');
  document.getElementById('register-tab').classList.add('tab-active');
  document.getElementById('login-tab').classList.remove('tab-active');
}

function seleccionarRol(rol) {
  document.getElementById('regRol').value = rol;
  document.getElementById('opt-comprador').classList.toggle('selected', rol === 'comprador');
  document.getElementById('opt-emprendedor').classList.toggle('selected', rol === 'emprendedor');
}

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('.material-symbols-outlined');
  if (input.type === 'password') {
    input.type = 'text';
    icon.textContent = 'visibility_off';
  } else {
    input.type = 'password';
    icon.textContent = 'visibility';
  }
}

function mostrarAlerta(id, mensaje, tipo) {
  const el = document.getElementById(id);
  el.className = `alert alert-${tipo}`;
  el.textContent = mensaje;
  el.classList.remove('d-none');
}

function ocultarAlerta(id) {
  document.getElementById(id).classList.add('d-none');
}

async function handleLogin(e) {
  e.preventDefault();
  ocultarAlerta('loginAlert');
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Ingresando...';

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correo: document.getElementById('loginEmail').value,
        contrasena: document.getElementById('loginPassword').value,
      }),
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      mostrarAlerta('loginAlert', data.message, 'success');
      setTimeout(() => window.location.href = data.redirect, 800);
    } else {
      mostrarAlerta('loginAlert', data.message || 'Credenciales incorrectas.', 'danger');
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined icon-sm me-2">login</span>Iniciar Sesión';
    }
  } catch {
    mostrarAlerta('loginAlert', 'Error de conexión. Verifica que los servicios estén corriendo.', 'danger');
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined icon-sm me-2">login</span>Iniciar Sesión';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  ocultarAlerta('registerAlert');

  const rol = document.getElementById('regRol').value;
  if (!rol) {
    mostrarAlerta('registerAlert', 'Por favor selecciona un tipo de cuenta.', 'warning');
    return;
  }

  const btn = document.getElementById('registerBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creando cuenta...';

  try {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: document.getElementById('regNombre').value,
        apellido: document.getElementById('regApellido').value,
        correo: document.getElementById('regEmail').value,
        cedula: document.getElementById('regCedula').value,
        contrasena: document.getElementById('regPassword').value,
        rol,
      }),
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      mostrarAlerta('registerAlert', data.message, 'success');
      setTimeout(() => window.location.href = data.redirect, 800);
    } else {
      const errMsg = data.errors ? Object.values(data.errors).flat().join(' ') : data.message;
      mostrarAlerta('registerAlert', errMsg, 'danger');
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined icon-sm me-2">person_add</span>Crear Cuenta';
    }
  } catch {
    mostrarAlerta('registerAlert', 'Error de conexión.', 'danger');
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined icon-sm me-2">person_add</span>Crear Cuenta';
  }
}

// Si ya está logueado, redirigir
if (localStorage.getItem('token')) {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const rol = usuario.rol || '';
  if (rol === 'administrador') window.location.href = '/admin/dashboard';
  else if (rol === 'emprendedor') window.location.href = '/vendedor/dashboard';
  else window.location.href = '/marketplace';
}

# Scripts de seed — EmprendeMarket

## Requisitos previos
- MongoDB corriendo en `127.0.0.1:27017`
- Node.js instalado

## Instalación (solo la primera vez)

```bash
cd scripts
npm install
```

---

## Paso 1 — Crear tiendas y usuarios

```bash
node seed_tiendas.js
```

Crea **10 usuarios emprendedores** y sus **tiendas en estado `pendiente`**.

| Campo         | Detalle                                         |
|---------------|-------------------------------------------------|
| Contraseñas   | Ver columna `propietario_contrasena` en tiendas.csv |
| Estado tienda | `pendiente` → debes aprobarla como admin        |

---

## Paso 2 — Aprobar tiendas como admin

1. Inicia los servicios: `npm run dev` en cada servicio
2. Abre **http://localhost:3000/admin/dashboard**
3. Ve a la sección **Tiendas**
4. Aprueba las 10 tiendas (botón ✅ Aprobar)

---

## Paso 3 — Crear productos

```bash
node seed_productos.js
```

Inserta **10 productos por tienda** (100 productos en total) con imágenes reales de Unsplash.

> ⚠️ Si una tienda no está `activa`, sus productos serán omitidos con una advertencia.

---

## Archivos

| Archivo             | Descripción                              |
|---------------------|------------------------------------------|
| `tiendas.csv`       | 10 tiendas con logos, categorías y dueños |
| `productos.csv`     | 100 productos con imágenes y tallas       |
| `seed_tiendas.js`   | Inserta usuarios + tiendas               |
| `seed_productos.js` | Inserta productos en tiendas activas     |

---

## Tiendas incluidas

| # | Nombre              | Categoría          | Propietario               |
|---|---------------------|--------------------|---------------------------|
| 1 | ModaMujer Boutique  | Ropa               | María del Carmen Silva    |
| 2 | Pisadas Style       | Zapatos / Calzado  | Carlos Eduardo Martínez   |
| 3 | Pequeños Gigantes   | Ropa Infantil      | Ana Lucía Herrera         |
| 4 | Bolsos & Chic       | Bolsos y Accesorios| Valentina Ospina          |
| 5 | SportMax Colombia   | Deportes           | Andrés Felipe Ruiz        |
| 6 | Sabores del Campo   | Alimentos          | Carmen Rosa Díaz          |
| 7 | Arte y Manos        | Artesanías         | Rosa Elena Vargas         |
| 8 | TechZone CO         | Tecnología         | Felipe Andrés Torres      |
| 9 | Casa Ideal Hogar    | Hogar              | Sandra Patricia Pérez     |
|10 | Glam Beauty Studio  | Belleza            | Daniela Catalina Castro   |

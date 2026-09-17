# Sistema de gestión de solicitudes bibliográficas — Open Source

Este repositorio contiene una versión **sanitizada y replicable** de un sistema de gestión de solicitudes bibliográficas originalmente implementado con Google Apps Script, HTML/CSS/JavaScript y Google Sheets.

## Objetivo

Permitir que otra institución pueda comprender y reconstruir la solución sin recibir:

- datos personales reales;
- correos institucionales reales;
- claves de acceso;
- IDs reales de Google Drive/Sheets;
- URLs reales de despliegue;
- catálogos institucionales;
- información operativa privada.

La lógica funcional y la estructura técnica se mantienen como referencia.

## Estado de este paquete

Incluye los 2 archivos disponibles actualmente:

- `src/Código.gs` — backend de Google Apps Script.
- `src/Biblioteca.html` — panel administrativo.

**Falta el tercer archivo de la aplicación**, que debe incorporarse cuando esté disponible (en el código actual el punto de entrada espera también una vista llamada `Index`).

## Sistemas incluidos

El repositorio documenta **dos instalaciones** del mismo núcleo funcional. Cada
una es un proyecto de Apps Script independiente (hoja de cálculo, implementación
web y Script Properties propias).

| Sistema | Archivos | Particularidades |
|---|---|---|
| Valledupar (base) | `Código.gs`, `Biblioteca.html` | Implementación original |
| Bogotá | `bogota/` | Interfaz completa · 16–20 proveedores · página puente de QR · plan B de contingencia |

El sistema de Bogotá conserva la misma estructura y metodología, y agrega:

1. **Página puente para códigos QR** (`bogota/Abrir.html`), para cuando el QR se
   escanea desde el navegador interno de otra app.
   → `docs/bogota-qr-safari.md`
2. **Plantilla descargable (CSV/Excel) y cargue masivo**, como plan B ante una
   caída de internet durante la jornada.
   → `docs/bogota-cargue-masivo.md`
3. **Columna `Origen`** en la hoja `Pedidos` (única diferencia de esquema).
4. **Hoja "Por Proveedor"** en el Excel de resumen.
5. **Buscador público** (`bogota/Index.html`), la vista que en la instalación
   base todavía está pendiente de incorporar.
6. **`configurarSistema()`**, que verifica la hoja de cálculo antes de publicar.
7. **Lectura flexible del catálogo**: las columnas se identifican por nombre y
   no por posición, y la búsqueda ignora las tildes
   (`docs/bogota-catalogo.md`).

Ver `bogota/README.md` y `docs/bogota-instalacion.md` para instalar esa variante.

## Arquitectura funcional

```text
Usuario
  │
  ├── Interfaz pública
  │       └── Index.html  [pendiente de incorporar]
  │
  └── Panel administrativo
          └── Biblioteca.html
                    │
                    ▼
            Google Apps Script
                    │
        ┌───────────┼────────────┐
        ▼           ▼            ▼
   Google Sheets   Drive      CacheService
        │
        ├── Catálogo
        ├── Solicitudes
        └── Libros deseados
```

## Funciones principales

1. Consulta y búsqueda del catálogo.
2. Filtros por sede, proveedor y temática.
3. Registro de solicitudes.
4. Gestión de solicitudes de libros.
5. Registro de libros que no aparecen en catálogo.
6. Cambio de estados.
7. Panel administrativo.
8. Conteo de solicitudes, ejemplares, pendientes y valor.
9. Exportación de resumen a Excel.
10. Caché del catálogo para reducir lecturas repetidas de Google Sheets.
11. Validación de entradas.
12. Separación entre configuración y lógica.

## Datos esperados

El catálogo utiliza conceptualmente campos como:

`Proveedor, Sede, Titulo, Autor, Editorial, Categoria, Programa, Precio, ISBN, Stock, Observaciones, HojaOrigen`

Las solicitudes utilizan:

`Fecha, Sede, Nombre, Documento, Email, TipoUsuario, Facultad, Programa, Asignatura, Titulo, Autor, Categoria, ISBN, Proveedor, Precio, Cantidad, ID, Estado`

Los libros deseados utilizan:

`Fecha, Sede, Nombre, Documento, Email, TipoUsuario, Facultad, Programa, Asignatura, Titulo, Autor, ISBN, Proveedor, Comentario, Cantidad, ID, Estado`

## Configuración

Los valores sensibles deben configurarse mediante **Script Properties** de Google Apps Script.

Variables previstas:

- `CLAVE_BIBLIOTECA`
- `CORREO_BIBLIOTECA`
- `ID_LOGO`

Los IDs de hojas, nombres de pestañas, sedes y demás parámetros que una instalación necesite modificar deben mantenerse como configuración, no como secretos dentro del repositorio.

## Regla de seguridad

Nunca subir al repositorio:

- contraseñas;
- tokens;
- API keys;
- IDs privados;
- datos personales;
- correos reales;
- archivos exportados de producción;
- catálogos reales;
- URLs privadas de administración.

## Instalación conceptual

1. Crear un proyecto de Google Apps Script.
2. Copiar los archivos de `src/`.
3. Incorporar el tercer archivo cuando esté disponible.
4. Crear las hojas con los encabezados definidos en `docs/estructura-datos.md`.
5. Configurar Script Properties.
6. Crear o seleccionar el archivo de logo de la instalación.
7. Revisar nombres de hojas.
8. Ejecutar una prueba con datos ficticios.
9. Publicar como Web App según las políticas de la institución.

## Importante

Este repositorio documenta la **arquitectura y lógica**, no constituye una copia de los datos ni de la infraestructura privada de ninguna institución.


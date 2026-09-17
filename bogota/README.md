# Sistema Bogotá · Selecciones con Sentido

Sistema de gestión de solicitudes bibliográficas para la operación de **Bogotá**.

Es un **proyecto de Apps Script independiente** del de Valledupar: otra hoja de
cálculo, otra implementación web y otras Script Properties. Comparte la misma
estructura y metodología, y agrega dos capacidades propias.

## Archivos

| Archivo | Rol |
|---|---|
| `Código.gs` | Backend completo (catálogo, solicitudes, panel, plan B, QR) |
| `Biblioteca.html` | Panel interno del personal de biblioteca |
| `Abrir.html` | Página puente de los códigos QR |
| `Config.example.gs` | Configuración de referencia. No contiene secretos |
| `Index.html` | **Pendiente.** Buscador público, aún no disponible en el repositorio |

En Apps Script los archivos van todos al mismo nivel del proyecto; la carpeta
`bogota/` solo existe para separarlo de Valledupar dentro de este repositorio.

## Qué cambia respecto a Valledupar

### 1. Proveedores: 16 a 20

El catálogo `IndiceGlobal` consolida entre 16 y 20 proveedores. Eso trajo tres
ajustes:

- `verificarProveedores()` — diagnóstico ejecutable desde el editor: lista los
  proveedores realmente cargados, cuántos títulos aporta cada uno, y avisa si el
  total quedó fuera del rango esperado (típicamente, un proveedor sin consolidar
  o un mismo proveedor escrito de dos formas distintas). **No bloquea nada.**
- `getFacetsData()` agrega `proveedoresConConteo`, `totalProveedores` y
  `avisoProveedores`. Los campos originales se conservan intactos, para no
  romper ninguna vista que ya los use.
- El Excel de resumen incluye una hoja **"Por Proveedor"** (títulos distintos,
  solicitudes, copias y valor por proveedor).

### 2. Página puente para los códigos QR

El enlace del QR (`...?qr=1`) pasa primero por `Abrir.html`, que detecta si la
persona llegó desde el navegador interno de otra app (Instagram, Facebook,
WhatsApp) y, en ese caso, le ofrece abrir el sistema en Safari o en el navegador
del sistema antes de continuar.

→ **Leer `docs/bogota-qr-safari.md` antes de imprimir los QR.** Tiene
advertencias importantes sobre los límites de este enfoque y una lista de
pruebas a realizar en dispositivos reales.

### 3. Plan B: plantilla descargable y cargue masivo

Si se cae el internet durante la jornada, el personal sigue registrando en una
plantilla local (Excel o CSV) descargada previamente desde el panel. Al volver
el servicio, sube ese archivo y todo entra de una sola vez, con revisión previa
y protección contra el doble cargue.

→ Detalle completo en `docs/bogota-cargue-masivo.md`.

### 4. Columna `Origen` en la hoja `Pedidos`

Columna 19, con valores `Web` o `Cargue masivo`. Permite distinguir lo
registrado en línea de lo que entró por contingencia.

Es la **única diferencia de esquema** respecto a Valledupar, y existe
únicamente porque el cargue masivo la necesita.

## Instalación

1. Crear un proyecto de Apps Script **nuevo**, asociado a la hoja de cálculo de
   Bogotá (no reutilizar el de Valledupar).
2. Copiar `Código.gs`, `Biblioteca.html` y `Abrir.html` al proyecto.
3. Incorporar `Index.html` cuando esté disponible.
4. Crear las hojas con los encabezados definidos en `docs/estructura-datos.md`,
   más la columna `Origen` en `Pedidos`.
5. Configurar las Script Properties (ver abajo).
6. Publicar como Web App según las políticas de la institución.
7. Ejecutar `obtenerUrlsSistema()` desde el editor y anotar la URL marcada como
   "URL PARA IMPRIMIR EN EL QR".
8. Ejecutar `verificarProveedores()` y confirmar que el catálogo quedó dentro
   del rango 16–20.
9. Probar con datos ficticios: `probarRegistrarPedido()` y
   `probarCargueMasivo()`.

## Script Properties

| Propiedad | Para qué |
|---|---|
| `CLAVE_BIBLIOTECA` | Clave compartida del Panel de Biblioteca |
| `CORREO_BIBLIOTECA` | Correo que recibe las notificaciones |
| `ID_LOGO` | ID en Drive del archivo de logo |
| `URL_APP_WEB` | Respaldo de la URL de la app, para cuando `ScriptApp.getService().getUrl()` no está disponible (por ejemplo, al ejecutar `obtenerUrlsSistema()` desde el editor) |

Ninguno de estos valores debe escribirse dentro de los archivos versionados.

## Sobre la clave del panel

`CLAVE_BIBLIOTECA` **no es autenticación real**: cualquiera que conozca la URL
exacta y la clave puede entrar, y la validación ocurre del lado del cliente
antes de pedir los datos. Sirve para que un usuario normal no llegue al panel
por error, no para proteger información sensible frente a alguien que la busque
deliberadamente. Si se necesita control de acceso real, hay que resolverlo con
los permisos de publicación de la Web App o con una capa de autenticación
propia.

## Qué falta

- **`Index.html`** — el buscador público no está en el repositorio. El backend
  ya lo espera en `doGet()` y mantiene el mismo contrato de funciones que
  Valledupar (`getFacetsData`, `buscarLibros`, `registrarPedido`,
  `registrarDeseo`, `obtenerHistorialPedidos`).
- Verificación en dispositivos reales del salto a Safari desde el QR
  (ver la lista de pruebas en `docs/bogota-qr-safari.md`).
- Verificación en Apps Script real de la generación del `.xlsx` de la plantilla
  y del correo de resumen del cargue masivo.

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
| `Index.html` | Buscador público: catálogo, filtros, solicitud, historial |
| `Config.example.gs` | Configuración de referencia. No contiene secretos. No se pega en el proyecto |

En Apps Script los archivos van todos al mismo nivel del proyecto; la carpeta
`bogota/` solo existe para separarlo de Valledupar dentro de este repositorio.

**Para instalarlo sobre el archivo que ya tiene el catálogo de proveedores, ver
`docs/bogota-instalacion.md`** (paso a paso desde Extensiones → Apps Script).

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

Guía completa y paso a paso: **`docs/bogota-instalacion.md`**.

Resumen:

1. Abrir la hoja de cálculo con el catálogo → **Extensiones → Apps Script**
   (si el archivo es `.xlsx`, convertirlo antes a Hojas de cálculo de Google).
2. Pegar `Código.gs` y crear tres archivos HTML: `Index`, `Biblioteca`, `Abrir`.
3. Configurar las Script Properties (ver abajo).
4. Ejecutar **`configurarSistema()`** desde el editor: revisa el catálogo
   columna por columna, crea las pestañas que falten y dice qué corregir.
5. Publicar como Web App según las políticas de la institución.
6. Ejecutar `obtenerUrlsSistema()` y anotar la URL marcada como
   "URL PARA IMPRIMIR EN EL QR".
7. Probar con datos ficticios: `probarRegistrarPedido()` y `probarCargueMasivo()`.
8. Ejecutar `medirRendimiento()` y confirmar que la caché del catálogo funciona.

### Los catálogos se consolidan solos

Cada proveedor va en su propia pestaña, con las columnas como las mande.
`revisarConsolidacion()` informa qué aportaría cada una y `consolidarCatalogo()`
las une en `IndiceGlobal`. Al llegar un proveedor nuevo se repite, sin
reformatear nada. Ver `docs/bogota-catalogo.md`.

### El catálogo se adapta al archivo, no al revés

`leerCatalogoDesdeHoja_()` identifica las columnas **por el nombre del
encabezado**, ignorando mayúsculas, tildes y signos. El orden no importa, las
columnas que sobran se ignoran y las que faltan toman un valor por defecto.
Solo `Titulo` y `Proveedor` son obligatorias.

La búsqueda ignora las tildes, el filtro de Temática se recorta a las temáticas
con peso real, y los títulos sin precio se muestran como "Precio por confirmar"
sin sumar al total. El detalle y las mediciones que respaldan cada decisión
están en **`docs/bogota-catalogo.md`**.

## Script Properties

| Propiedad | Para qué |
|---|---|
| `CLAVE_BIBLIOTECA` | Clave compartida del Panel de Biblioteca |
| `CORREO_BIBLIOTECA` | Correo que recibe las notificaciones |
| `ID_LOGO` | ID en Drive del archivo de logo |
| `URL_APP_WEB` | Respaldo de la URL de la app, para cuando `ScriptApp.getService().getUrl()` no está disponible (por ejemplo, al ejecutar `obtenerUrlsSistema()` desde el editor) |
| `CORREOS_ADMIN` | Correos autorizados para las funciones de mantenimiento, separados por comas. Sin ella, cualquier cuenta identificada puede ejecutarlas |

Ninguno de estos valores debe escribirse dentro de los archivos versionados.

## Control de acceso

`google.script.run` puede llamar a **cualquier** función del servidor que no
termine en guion bajo, no solo a las que usa la página. Cualquiera que abra la
app web puede abrir la consola del navegador y llamar a lo que quiera. Por eso:

- **Cada función del panel verifica la clave en el servidor**, en su primera
  línea. Comprobarla solo en el cliente no protegería nada.
- **Las funciones de mantenimiento** (consolidar, refrescar la caché, medir,
  las de prueba) exigen que quien las ejecute esté identificado y, si está
  configurada `CORREOS_ADMIN`, que su correo esté en esa lista.
- El motor del cargue masivo es privado (`procesarCargueMasivo_`), no
  alcanzable desde el cliente.

### Lo que esto NO es

`CLAVE_BIBLIOTECA` sigue siendo **una clave compartida, no autenticación
real**: la misma para todo el personal, viaja en cada llamada y no deja rastro
de quién hizo qué. Sirve para que nadie llegue a los datos por accidente o por
curiosear. Para control de acceso de verdad (saber quién hizo qué, revocar a
una persona) hay que usar los permisos de publicación de la Web App o una capa
de autenticación propia.

### Limitación conocida

`obtenerHistorialPedidos(email)` es pública a propósito: así una persona
consulta sus propias solicitudes. Eso significa que **quien conozca el correo
de alguien puede ver qué libros solicitó**. Es inherente al diseño de esa
función; si no resulta aceptable, hay que cambiarla (por ejemplo, pidiendo
también el documento).

## Qué falta

- Verificación en dispositivos reales del salto a Safari desde el QR
  (ver la lista de pruebas en `docs/bogota-qr-safari.md`).
- Verificación en Apps Script real de la generación del `.xlsx` de la plantilla
  y del correo de resumen del cargue masivo.

# Bogotá · Instalación sobre el Excel de proveedores

Guía para montar el sistema encima del archivo que ya tiene consolidados los
catálogos de los proveedores de Bogotá.

## Antes de empezar: el archivo debe ser Google Sheets, no .xlsx

**Extensiones → Apps Script solo aparece en archivos nativos de Google Sheets.**
Si el archivo es un `.xlsx` subido a Drive, aunque se abra con Hojas de cálculo,
el menú de Apps Script normalmente no está disponible.

Si ese es el caso: con el archivo abierto, **Archivo → Guardar como Hojas de
cálculo de Google**. Eso crea una copia nativa; trabaja sobre esa copia.

> No puedo verificar desde aquí el comportamiento exacto de tu archivo. Si al
> abrir **Extensiones** ya ves **Apps Script**, sigue de largo; si no lo ves,
> el paso de convertir es lo primero que hay que hacer.

## Paso 1 · Preparar la pestaña del catálogo

El sistema espera una pestaña llamada **`IndiceGlobal`** con **estas 12 columnas
en este orden exacto**:

| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Proveedor | Sede | Titulo | Autor | Editorial | Categoria | Programa | Precio | ISBN | Stock | Observaciones | HojaOrigen |

### Por qué el orden importa tanto

El catálogo se lee **por posición**, no por el nombre del encabezado
(`leerCatalogoDesdeHoja_` toma `fila[0]` como Proveedor, `fila[1]` como Sede,
y así). Si las columnas están en otro orden, el sistema **no da ningún error**:
simplemente muestra los datos cambiados de lugar, por ejemplo el autor donde
debería ir la editorial.

Por eso el paso 4 de esta guía incluye una verificación automática.

### Qué hacer con tu archivo

- Si la pestaña del catálogo tiene otro nombre: renómbrala a `IndiceGlobal`,
  **o** cambia la constante `NOMBRE_HOJA_CATALOGO` al principio de `Código.gs`.
- Si tienes un catálogo por proveedor en pestañas separadas: hay que
  consolidarlos en una sola pestaña. La columna `HojaOrigen` existe justamente
  para no perder de qué hoja vino cada fila.
- Columnas que no uses (`Stock`, `Observaciones`, `HojaOrigen`): déjalas
  creadas aunque vayan vacías, para que las posiciones no se corran.
- La fila 1 debe ser el encabezado. Los datos empiezan en la fila 2.

## Paso 2 · Abrir el editor de Apps Script

Con el archivo abierto: **Extensiones → Apps Script**.

Se abre un proyecto vacío con un archivo `Código.gs` que trae una función
`myFunction()` de ejemplo.

## Paso 3 · Pegar los archivos

Hay que crear **cuatro archivos** dentro del proyecto. Los nombres importan:
`doGet()` los busca por nombre exacto.

| En el editor | Cómo se crea | Qué pegar |
|---|---|---|
| `Código.gs` | Ya existe: borra todo su contenido | `bogota/Código.gs` |
| `Index` | Archivo → Nuevo → **Archivo HTML** | `bogota/Index.html` |
| `Biblioteca` | Archivo → Nuevo → **Archivo HTML** | `bogota/Biblioteca.html` |
| `Abrir` | Archivo → Nuevo → **Archivo HTML** | `bogota/Abrir.html` |

Al crear un archivo HTML, Apps Script agrega la extensión `.html` solo. Escribe
el nombre **sin** la extensión: `Index`, no `Index.html`.

`Config.example.gs` **no se pega**: es solo documentación de referencia.

Guarda (💾 o Ctrl+S).

## Paso 4 · Configurar las claves y correos

**Configuración del proyecto** (el engranaje ⚙ en la barra izquierda) →
**Propiedades del script** → **Agregar propiedad de script**:

| Propiedad | Valor | ¿Obligatoria? |
|---|---|---|
| `CLAVE_BIBLIOTECA` | La clave que usará el personal para entrar al panel | Sí |
| `CORREO_BIBLIOTECA` | Correo que recibirá las notificaciones | Sí |
| `ID_LOGO` | ID del archivo del logo en Drive | No |
| `URL_APP_WEB` | Se llena después del paso 6 | No |

Estos valores **nunca** se escriben dentro del código.

El `ID_LOGO` es la parte larga de la URL del archivo en Drive:
`https://drive.google.com/file/d/`**`ESTO_DE_AQUÍ`**`/view`

## Paso 5 · Verificar que todo quedó bien

En el editor, selecciona la función **`configurarSistema`** en el desplegable de
arriba y pulsa **Ejecutar**.

La primera vez pedirá autorización: es normal, el script necesita permiso para
leer la hoja, crear pestañas, enviar correo y leer el logo de Drive.

Luego abre **Registro de ejecución**. Vas a ver un informe que:

- lista las pestañas del archivo;
- revisa **columna por columna** si el catálogo está en el orden correcto, y
  dice exactamente cuál está mal si no lo está;
- cuenta los proveedores y avisa si no están entre 16 y 20;
- **crea** las pestañas `Pedidos` y `LibrosDeseados` si faltan (si ya existen,
  no toca sus datos);
- revisa las Script Properties y los cuatro archivos del proyecto.

`configurarSistema()` **nunca modifica el catálogo**. Solo lo lee.

Si el informe termina en "FALTAN COSAS POR CORREGIR", corrige lo que indica y
vuelve a ejecutarla. Repite hasta que diga **TODO LISTO**.

## Paso 6 · Publicar la aplicación web

**Implementar → Nueva implementación → ⚙ → Aplicación web**.

| Campo | Qué poner |
|---|---|
| Descripción | Selecciones con Sentido Bogotá |
| Ejecutar como | **Yo** (para que el script pueda escribir en la hoja) |
| Quién tiene acceso | Según la política de la institución |

Sobre "Quién tiene acceso": si se elige una opción que exige cuenta de Google,
quien abra el enlace desde el navegador interno de otra app puede encontrarse
con un error de Google. Eso es justamente lo que atiende la página puente del
QR — leer `docs/bogota-qr-safari.md`.

Copia la URL que entrega y pégala en la Script Property `URL_APP_WEB`.

## Paso 7 · Anotar los enlaces

Ejecuta **`obtenerUrlsSistema()`** y mira el Registro de ejecución. Entrega:

- **App web** — el buscador, para los usuarios.
- **URL PARA IMPRIMIR EN EL QR** (`...?qr=1`) — es **esta** la que va en el
  código QR, no la anterior.
- **Panel de Biblioteca** (`...?panel=biblioteca`) — solo para el personal.

El código QR se genera con la herramienta que prefiera la institución; el
sistema no lo genera.

## Paso 8 · Probar antes de la jornada

- [ ] Abrir el buscador y comprobar que aparecen los títulos, y que los datos
      de cada tarjeta están en el campo que les corresponde (autor donde va el
      autor, editorial donde va la editorial).
- [ ] Filtrar por proveedor y confirmar que aparecen los 16–20.
- [ ] Enviar una solicitud de prueba con datos ficticios y verificar que llega
      el correo y que la fila aparece en la pestaña `Pedidos`.
- [ ] Entrar al panel con la clave y ver esa solicitud.
- [ ] Descargar la plantilla de contingencia (plan B) y guardarla.
- [ ] Escanear el QR desde la cámara del teléfono y desde Instagram
      (ver la lista completa en `docs/bogota-qr-safari.md`).
- [ ] **Borrar las solicitudes de prueba** de la pestaña `Pedidos` antes de
      empezar la jornada real.

## Después de actualizar el catálogo

El catálogo se guarda en caché **30 minutos** para no releer la hoja en cada
búsqueda. Si se agrega o corrige algo en `IndiceGlobal` y se quiere ver de
inmediato, ejecutar **`refrescarCacheCatalogo()`** desde el editor.

## Funciones útiles desde el editor

| Función | Para qué |
|---|---|
| `configurarSistema()` | Verificación completa de la instalación |
| `verificarProveedores()` | Lista los proveedores y cuántos títulos aporta cada uno |
| `refrescarCacheCatalogo()` | Aplica ya los cambios hechos en el catálogo |
| `obtenerUrlsSistema()` | Muestra los enlaces del sistema |
| `probarRegistrarPedido()` | Registra una solicitud de prueba con datos ficticios |
| `probarCargueMasivo()` | Prueba el cargue masivo sin escribir nada |

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| "No se encontró la pestaña 'IndiceGlobal'" | La pestaña del catálogo tiene otro nombre |
| Los datos salen en el campo equivocado | Las columnas del catálogo están en otro orden → ejecutar `configurarSistema()` |
| El buscador no muestra cambios recientes | La caché de 30 minutos → `refrescarCacheCatalogo()` |
| No llegan los correos | Falta `CORREO_BIBLIOTECA`, o se agotó la cuota diaria de `MailApp` |
| El panel dice "Clave incorrecta" | Falta `CLAVE_BIBLIOTECA` en las Script Properties |
| El logo no aparece | Falta `ID_LOGO`, o el archivo no es accesible para la cuenta que ejecuta el script |

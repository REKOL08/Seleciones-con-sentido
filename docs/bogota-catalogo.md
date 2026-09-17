# Bogotá · Cómo lee el sistema el catálogo

## El catálogo se mapea por nombre de columna

`leerCatalogoDesdeHoja_()` identifica cada columna por el **texto de su
encabezado**, no por su posición. Eso significa que:

- el orden de las columnas en el archivo **no importa**;
- las columnas que el sistema no usa se ignoran sin estorbar;
- las columnas que falten se rellenan con un valor por defecto;
- reordenar una columna **no** cambia los datos en silencio.

La comparación ignora mayúsculas, tildes y signos: `ÁREA`, `area` y `Área`
son lo mismo.

## Encabezados que reconoce cada campo

| Campo del sistema | Encabezados aceptados | Si falta |
|---|---|---|
| `titulo` | Titulo, Nombre del libro | **Obligatorio** |
| `proveedor` | Proveedor, Distribuidor | **Obligatorio** |
| `autor` | Autor, Autores | queda vacío |
| `editorial` | Editorial, Sello | queda vacío |
| `precio` | Precio, Precio unitario, Valor, Precio público | se trata como sin precio |
| `isbn` | ISBN, ISBN13 | queda vacío |
| `anio` | Año, Anio, Año de edición, Edición | queda vacío |
| `sede` | Sede | se usa la ciudad de la instalación |
| `stock` | Stock, Existencias, Cantidad, Disponibles | queda vacío |
| `observaciones` | Observaciones, Notas, Comentarios | queda vacío |
| `hojaOrigen` | HojaOrigen, Origen, Fuente | queda vacío |
| `categoria` | **Área**, Categoria, Tematica, Tema | queda vacío |
| `programa` | **Programa**, Subcategoria, Subárea, Categoria, Especialidad | queda vacío |

### Las dos columnas temáticas

`categoria` y `programa` son las dos columnas de tema, de lo más general a lo
más específico. El reparto depende de qué traiga el archivo:

| El archivo tiene… | `categoria` toma | `programa` toma |
|---|---|---|
| `Categoria` y `Programa` | Categoria | Programa |
| `ÁREA` y `CATEGORIA` | ÁREA (la general) | CATEGORIA (la específica) |
| solo `ÁREA` | ÁREA | vacío |

Una misma columna nunca se asigna a dos campos: el primero que la reclama se
la queda y el siguiente pasa a su alias alternativo. Por eso `categoria`
prefiere `ÁREA`, y `programa` se queda con `CATEGORIA` cuando sobró.

El buscador de texto busca en **ambas**, y el filtro de Temática también.

## Limpieza automática al leer

| Qué | Por qué |
|---|---|
| Se quitan espacios sobrantes al inicio y al final | `'EDUCACIÓN '` y `'EDUCACIÓN'` contarían como dos temáticas distintas y el filtro exacto fallaría |
| El ISBN numérico se pasa a texto | Excel suele guardarlo como número; como texto se puede buscar tal como la persona lo escribe |
| Las filas sin título se descartan | Filas vacías o de relleno al final de la hoja |

## Búsqueda sin tildes

La búsqueda de texto ignora las tildes en ambos sentidos: escribir
`psicologia` encuentra `PSICOLOGÍA`, y al revés.

En un catálogo escrito en mayúsculas con tildes esto no es un detalle
cosmético. Sobre un catálogo real de ~18.700 títulos, la diferencia medida fue:

| Se escribe | Sin la corrección | Con la corrección |
|---|---|---|
| `psicologia` | 36 | 827 |
| `educacion` | 64 | 684 |
| `ingenieria` | 73 | 371 |
| `administracion` | 86 | 196 |
| `enfermeria` | 3 | 42 |

La normalización se hace **en el momento de comparar**, no se guarda
precalculada en la caché. Se midieron las dos opciones: guardarla dejaría las
búsquedas casi instantáneas, pero la caché del catálogo pasaría de unos 12 a
unos 24 trozos. Si la caché no cabe, se descarta en silencio y **cada**
búsqueda vuelve a leer la hoja entera, que es mucho peor que unos milisegundos
de más. Está anotado en el código por si alguien quiere reconsiderarlo con
mediciones propias.

También se cubren las tildes escritas como carácter combinante aparte
(una `ó` guardada como `o` + acento). Son pocas, pero existen en archivos
consolidados a mano.

## El filtro de Temática viene recortado

Un catálogo consolidado de varios proveedores puede traer **miles** de
temáticas distintas, la mayoría con uno o dos títulos. Una lista desplegable
con miles de opciones no sirve para nada.

Por eso `getFacetsData()` deja en el filtro solo las temáticas con al menos
`TEMATICA_MIN_TITULOS` títulos (10 por defecto). El buscador de texto sigue
llegando a todas las demás, y el buscador avisa en pantalla de que la lista
está recortada, para que nadie concluya que un tema no está en el catálogo.

En el catálogo real de referencia esto dejó 240 temáticas en el filtro, de
5.673 existentes. Ajustable con esa constante.

## Títulos sin precio

Si un proveedor no envía precios, esas filas llegan con `0`. El sistema:

- **no los descarta**: se pueden solicitar igual;
- los muestra como **"Precio por confirmar"**, no como `$ 0`, para no dar a
  entender que son gratis;
- **no los suma** al total estimado, y avisa cuántos quedaron fuera;
- `configurarSistema()` reporta el porcentaje y **de qué proveedor** vienen,
  que es lo que permite pedirle la lista de precios a quien corresponde.

## Tamaño y caché

El catálogo completo se guarda comprimido en `CacheService` durante 30 minutos
y se reparte en trozos de 90.000 caracteres (el límite por clave es 100 KB).

Como referencia, un catálogo de ~18.700 títulos ocupa unos 5,5 MB en JSON y
cerca de 1 MB ya comprimido y codificado: unos 12 trozos de caché.

Después de modificar el catálogo, ejecutar `refrescarCacheCatalogo()` para no
esperar a que la caché expire sola.

## Qué revisar con `configurarSistema()`

Reporta, sin tocar el catálogo:

- qué columna del archivo quedó asignada a cada campo del sistema;
- qué campos no están y qué valor por defecto tomarán;
- cuántos títulos se leyeron;
- qué porcentaje no tiene precio, y de qué proveedores;
- cuántas temáticas hay y cuántas quedan en el filtro;
- cuántos proveedores hay y si están en el rango esperado.

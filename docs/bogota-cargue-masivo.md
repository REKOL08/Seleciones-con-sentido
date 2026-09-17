# Bogotá · Plan B: plantilla de contingencia y cargue masivo

## Qué problema resuelve

Durante una jornada de Selecciones con Sentido, el sistema depende de internet:
el buscador lee el catálogo desde Google Sheets y cada solicitud se escribe en
línea. Si el servicio se cae, la jornada se detiene.

El plan B permite seguir atendiendo sin conexión y volcar después, de una sola
vez, todo lo que se registró durante la caída.

```text
ANTES de la jornada        DURANTE la caída           CUANDO VUELVE EL SERVICIO
───────────────────        ────────────────           ─────────────────────────
Descargar la plantilla  →  Llenarla en el equipo   →  Subirla al Panel
(Excel o CSV)              (una fila por libro)       Revisar → Confirmar
```

## Dónde está

Panel de Biblioteca → sección **🛟 Plan B · sin internet**.

## Formato de la plantilla

| # | Columna | Obligatoria | Notas |
|---|---|---|---|
| 1 | Fecha | No | `dd/mm/aaaa` o `dd/mm/aaaa hh:mm`. Vacía → fecha del cargue |
| 2 | Sede | Sí | Debe coincidir exactamente con una sede válida |
| 3 | Nombre | Sí | |
| 4 | Documento | Sí | |
| 5 | Email | Sí | Debe tener formato de correo válido |
| 6 | Tipo de Usuario | Sí | Docente / Estudiante / Administrativo |
| 7 | Facultad | Sí | |
| 8 | Programa | Sí | |
| 9 | Asignatura | Sí | |
| 10 | Titulo | Sí | |
| 11 | Autor | No | |
| 12 | Categoria | No | |
| 13 | ISBN | No | |
| 14 | Proveedor | No | |
| 15 | Precio | No | Solo el número. Vacío → 0 |
| 16 | Cantidad | No | Entero ≥ 1. Vacío → 1 |
| 17 | Grupo Solicitud | No | Junta varias filas en una sola solicitud |

Los encabezados se reconocen **sin importar el orden ni las tildes**: `Título`,
`Titulo`, `Correo`, `Email`, `Temática`, `Categoria` y varios alias más se
mapean solos (ver `mapearColumnasCargue_` en `bogota/Código.gs`).

### La columna "Grupo Solicitud"

Es la única columna que no existe en la hoja `Pedidos`. Sirve para que varios
libros queden agrupados en **una sola solicitud**, igual que un pedido hecho
desde la web:

```text
Grupo  Persona        Libro
G1     Ana Pérez      Libro uno     ┐
G1     Ana Pérez      Libro dos     ┘ → una sola solicitud, 2 libros
G2     Carlos Gómez   Libro tres      → otra solicitud
```

Si se deja vacía, **cada fila es una solicitud independiente**.

La agrupación real se hace por: día + documento + email + asignatura + grupo.

## Cómo funciona el cargue

El cargue es de **dos pasos**, a propósito:

1. **Revisar archivo** — lee y valida todo, **sin escribir nada**. Devuelve un
   reporte con filas leídas, filas correctas, filas con error (con el número de
   fila tal como se ve en Excel y qué corregir en cada una), solicitudes nuevas
   y solicitudes que ya estaban registradas.
2. **Confirmar cargue** — pide confirmación y recién ahí escribe en la hoja
   `Pedidos`, bajo el mismo candado (`LockService`) que usan las solicitudes
   normales, para que un cargue grande no pise lo que alguien esté enviando
   desde la web en ese momento.

### Política ante filas con errores

Por defecto es **todo o nada**: si una sola fila tiene un error, no se escribe
nada. En el reporte aparece una casilla para cargar únicamente las filas
correctas e ignorar las demás.

### Protección contra el doble cargue

El ID de cada solicitud cargada es **determinístico**:

```text
SOL-CM-<aaaammdd>-<hash corto de: día|documento|email|asignatura|grupo>
```

Como el ID depende solo del contenido de agrupación, subir el mismo archivo dos
veces produce los mismos IDs; el sistema detecta que ya están en la hoja y omite
esas solicitudes en vez de duplicarlas, avisando cuántas omitió.

Los IDs se releen **con el candado ya tomado**, justo antes de escribir, para
cubrir también el caso de dos personas confirmando el mismo archivo a la vez.

### Qué se ignora solo

- La fila de **EJEMPLO** que trae la plantilla (se detecta porque el nombre
  empieza por "EJEMPLO").
- Las filas completamente vacías que Excel suele dejar al final.

Ninguna de las dos cuenta como error.

## Diferencia de esquema respecto a Valledupar

La hoja `Pedidos` de Bogotá tiene una columna **19: `Origen`**, con dos valores
posibles:

- `Web` — registrado desde el buscador, en línea.
- `Cargue masivo` — entró por la plantilla de contingencia.

En el Panel de Biblioteca, lo que vino por cargue masivo lleva una etiqueta
naranja junto al ID. En el Excel de resumen aparece como columna en la hoja
"Detalle Completo".

## Correos

El cargue masivo envía **un solo correo de resumen**, no uno por solicitud.
Enviar decenas de correos de golpe agotaría la cuota diaria de `MailApp`.

Si el correo falla (por ejemplo, por cuota agotada), **el cargue no se deshace**:
los datos ya están en la hoja y el reporte lo advierte explícitamente.

## Límites

Son topes que pusimos nosotros, **no límites documentados de la plataforma**:

- Máximo 3.000 filas por archivo (`CARGUE_MAX_FILAS`).
- Máximo ~2 millones de caracteres (`CARGUE_MAX_CARACTERES`).
- Se reportan como máximo 200 errores por revisión; si hay más, el reporte
  lo advierte.

Para volúmenes mayores, partir el archivo y cargarlo por tandas.

## Codificación de caracteres

El archivo se lee como **UTF-8**. Por eso:

- La plantilla CSV se entrega con BOM UTF-8.
- Desde Excel hay que guardar como **"CSV UTF-8 (delimitado por comas)"**.

Si se guarda como CSV "normal" en un Windows en español, las tildes y las ñ
pueden llegar dañadas al sistema.

El delimitador se detecta solo: coma, punto y coma o tabulación.

## Alcance: qué NO cubre

El cargue masivo cubre **solicitudes de catálogo** (hoja `Pedidos`).

**No** cubre libros deseados (hoja `LibrosDeseados`). Lo que se haya registrado
en papel sobre títulos fuera de catálogo debe ingresarse a mano desde el
buscador cuando vuelva el servicio.

## Verificación realizada

La lógica de parseo, validación, agrupación, escritura y protección contra
doble cargue se ejercitó con un arnés de pruebas en Node.js que sustituye las
APIs de Apps Script por stubs (57 verificaciones, todas en verde).

Ese arnés **no está versionado**: es de apoyo, no parte del sistema. Lo que sí
queda en el repositorio es `probarCargueMasivo()` en `bogota/Código.gs`, que
corre el mismo escenario en modo validación desde el editor de Apps Script, con
datos ficticios y sin escribir nada.

Pendiente de probar **en el entorno real de Apps Script** (no se puede simular
aquí): la generación del `.xlsx` de la plantilla, la descarga desde el navegador
y el envío del correo de resumen.

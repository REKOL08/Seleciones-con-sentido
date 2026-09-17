# Estructura de datos

Este documento describe la estructura conceptual observada en el código. Los datos reales no forman parte del repositorio.

## Hoja: IndiceGlobal

| Columna | Campo |
|---|---|
| 1 | Proveedor |
| 2 | Sede |
| 3 | Titulo |
| 4 | Autor |
| 5 | Editorial |
| 6 | Categoria |
| 7 | Programa |
| 8 | Precio |
| 9 | ISBN |
| 10 | Stock |
| 11 | Observaciones |
| 12 | HojaOrigen |

## Hoja: Pedidos

| Columna | Campo |
|---|---|
| 1 | Fecha |
| 2 | Sede |
| 3 | Nombre |
| 4 | Documento |
| 5 | Email |
| 6 | TipoUsuario |
| 7 | Facultad |
| 8 | Programa |
| 9 | Asignatura |
| 10 | Titulo |
| 11 | Autor |
| 12 | Categoria |
| 13 | ISBN |
| 14 | Proveedor |
| 15 | Precio |
| 16 | Cantidad |
| 17 | ID |
| 18 | Estado |

## Hoja: LibrosDeseados

| Columna | Campo |
|---|---|
| 1 | Fecha |
| 2 | Sede |
| 3 | Nombre |
| 4 | Documento |
| 5 | Email |
| 6 | TipoUsuario |
| 7 | Facultad |
| 8 | Programa |
| 9 | Asignatura |
| 10 | Titulo |
| 11 | Autor |
| 12 | ISBN |
| 13 | Proveedor |
| 14 | Comentario |
| 15 | Cantidad |
| 16 | ID |
| 17 | Estado |

## Variante de Bogotá: hoja Pedidos

El sistema de Bogotá (`bogota/`) usa el mismo esquema con **una columna
adicional**:

| Columna | Campo | Valores |
|---|---|---|
| 19 | Origen | `Web` · `Cargue masivo` |

Distingue lo registrado en línea desde el buscador de lo que entró por la
plantilla de contingencia. Existe únicamente porque el cargue masivo la
necesita; ver `docs/bogota-cargue-masivo.md`.

Las hojas `IndiceGlobal` y `LibrosDeseados` son idénticas en las dos
instalaciones.

## Plantilla de cargue masivo (solo Bogotá)

No es una hoja del sistema: es el archivo que el personal descarga, llena sin
conexión y vuelve a subir. Sus columnas son las de `Pedidos` sin `Estado` ni
`Origen` (los pone el sistema), más una columna de apoyo:

| Columna | Campo | Notas |
|---|---|---|
| 17 | Grupo Solicitud | Agrupa varias filas en una sola solicitud |

## Datos demo

El repositorio debe utilizar datos ficticios para pruebas. Nunca copiar registros de producción.

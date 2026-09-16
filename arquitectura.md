# Arquitectura del sistema

## Capas

### 1. Presentación

`Biblioteca.html` contiene la interfaz del panel administrativo:

- pantalla de acceso;
- resumen de indicadores;
- listado de solicitudes;
- listado de libros deseados;
- actualización de estados;
- exportación;
- mensajes de éxito/error;
- diseño responsive.

La comunicación con Apps Script se realiza mediante `google.script.run`.

### 2. Aplicación / backend

`Código.gs` concentra las funciones del sistema.

Responsabilidades observadas:

- entrada de la Web App mediante `doGet`;
- lectura del catálogo;
- búsqueda;
- filtros;
- gestión de solicitudes;
- gestión de libros deseados;
- actualización de estados;
- exportación;
- generación de identificadores;
- caché;
- validaciones.

### 3. Persistencia

Google Sheets actúa como almacenamiento tabular.

Hojas conceptuales:

- `IndiceGlobal`: catálogo.
- `Pedidos`: solicitudes.
- `LibrosDeseados`: solicitudes especiales.

### 4. Caché

`CacheService` mantiene una versión temporal del catálogo.

El sistema:

1. intenta leer desde caché;
2. si existe una versión válida, la reutiliza;
3. si no existe, lee Google Sheets;
4. serializa el catálogo;
5. comprime con gzip;
6. codifica en Base64;
7. divide el contenido en fragmentos;
8. guarda los fragmentos en caché;
9. reconstruye el catálogo cuando vuelve a solicitarse.

Esto reduce lecturas repetidas de la hoja.

## Flujo de solicitud

```text
Usuario
  ↓
Selecciona / busca libros
  ↓
Backend valida datos
  ↓
Se registra solicitud
  ↓
Se genera ID
  ↓
Se guarda en hoja Pedidos
  ↓
Personal consulta panel
  ↓
Se cambia estado
  ↓
Solicitud completada
```

## Flujo de libro no encontrado

```text
Usuario no encuentra título
  ↓
Formulario de libro deseado
  ↓
Validación
  ↓
Registro en LibrosDeseados
  ↓
Personal revisa solicitud
  ↓
Se consigue el libro
  ↓
Estado = Conseguido
```

## Principio de replicabilidad

La implementación debe separar:

```text
LÓGICA
   ≠
CONFIGURACIÓN
   ≠
DATOS
```

Esto permite reutilizar el mismo núcleo en otra institución sin transportar información privada.

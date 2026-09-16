// ────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN GENERAL
// ────────────────────────────────────────────────────────────────────────

const TAMANO_PAGINA = 9;
const NOMBRE_HOJA_CATALOGO = "IndiceGlobal";
const NOMBRE_HOJA_PEDIDOS = "Pedidos";
const CORREO_BIBLIOTECA = PropertiesService.getScriptProperties()
  .getProperty('CORREO_BIBLIOTECA') || 'biblioteca@example.org';
// Piloto: por ahora el sistema solo opera para la sede Sede Demo. La lista
// sigue siendo un array (no una constante fija) para que reactivar Sede Demo/
// Sede Demo más adelante sea tan simple como agregarlas de nuevo aquí.
const SEDES_VALIDAS = ["Sede Demo"];
const TIPOS_USUARIO_VALIDOS = ["Docente", "Estudiante", "Administrativo"];
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Clave compartida para entrar al Panel de Biblioteca (Biblioteca.html).
// No es una autenticación real (cualquiera con la URL exacta y la clave
// puede entrar), solo evita que un usuario normal llegue ahí por error.
// Cámbiala aquí cuando quieras, y avísale al personal de biblioteca.
const CLAVE_BIBLIOTECA = PropertiesService.getScriptProperties()
  .getProperty('CLAVE_BIBLIOTECA') || 'CAMBIAR_EN_SCRIPT_PROPERTIES';

// Columnas de la hoja "Pedidos" (1-indexadas).
// La hoja se limpió por completo el 24 de agosto de 2026 (con autorización
// expresa) y de nuevo el 27 de agosto, así que este esquema es el vigente;
// no hay filas viejas con un orden distinto que proteger.
const COL_PEDIDO_FECHA = 1;
const COL_PEDIDO_SEDE = 2;
const COL_PEDIDO_NOMBRE = 3;
const COL_PEDIDO_DOCUMENTO = 4;
const COL_PEDIDO_EMAIL = 5;
const COL_PEDIDO_TIPOUSUARIO = 6;
const COL_PEDIDO_FACULTAD = 7;
const COL_PEDIDO_PROGRAMA = 8;
const COL_PEDIDO_ASIGNATURA = 9;
const COL_PEDIDO_TITULO = 10;
const COL_PEDIDO_AUTOR = 11;
const COL_PEDIDO_CATEGORIA = 12;
const COL_PEDIDO_ISBN = 13;
const COL_PEDIDO_PROVEEDOR = 14;
const COL_PEDIDO_PRECIO = 15;
const COL_PEDIDO_CANTIDAD = 16;
const COL_PEDIDO_ID = 17;
const COL_PEDIDO_ESTADO = 18;
const TOTAL_COLUMNAS_PEDIDOS = 18;

// Columnas de la hoja "LibrosDeseados" (1-indexadas). Guarda solicitudes de
// libros que NO están en ninguno de los catálogos de los proveedores (se
// crea automáticamente la primera vez que alguien usa el botón "¿No lo
// encuentras? ¡Pídelo aquí!"). ISBN y Proveedor son opcionales (la persona
// puede no conocerlos si el libro no está en ningún catálogo).
const NOMBRE_HOJA_DESEOS = "LibrosDeseados";
const COL_DESEO_FECHA = 1;
const COL_DESEO_SEDE = 2;
const COL_DESEO_NOMBRE = 3;
const COL_DESEO_DOCUMENTO = 4;
const COL_DESEO_EMAIL = 5;
const COL_DESEO_TIPOUSUARIO = 6;
const COL_DESEO_FACULTAD = 7;
const COL_DESEO_PROGRAMA = 8;
const COL_DESEO_ASIGNATURA = 9;
const COL_DESEO_TITULO = 10;
const COL_DESEO_AUTOR = 11;
const COL_DESEO_ISBN = 12;
const COL_DESEO_PROVEEDOR = 13;
const COL_DESEO_COMENTARIO = 14;
const COL_DESEO_CANTIDAD = 15;
const COL_DESEO_ID = 16;
const COL_DESEO_ESTADO = 17;
const TOTAL_COLUMNAS_DESEOS = 17;

// ────────────────────────────────────────────────────────────────────────
// PUNTO DE ENTRADA DE LA APLICACIÓN WEB
// ────────────────────────────────────────────────────────────────────────
function doGet(e) {
  const vista = (e && e.parameter && e.parameter.panel) ? e.parameter.panel.toString() : '';
  const logoDataUri = obtenerLogoDataUri_();

  if (vista === 'biblioteca') {
    const plantilla = HtmlService.createTemplateFromFile('Biblioteca');
    plantilla.logoDataUri = logoDataUri;
    return plantilla.evaluate()
      .setTitle('Panel de Biblioteca · Bibliotecas Demo')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  const plantilla = HtmlService.createTemplateFromFile('Index');
  plantilla.logoDataUri = logoDataUri;
  return plantilla.evaluate()
    .setTitle('Solicitud de Libros · Mesas Curriculares')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Descarga el logo institucional desde Drive y lo devuelve como data URI
// (el iframe sandbox de Apps Script bloquea imágenes externas por cookies
// de terceros, así que se incrusta directo en el HTML). Se guarda en caché
// por 6 horas para no volver a leerlo de Drive en cada carga de página.
function obtenerLogoDataUri_() {
  const id = PropertiesService.getScriptProperties()
    .getProperty('ID_LOGO');
  return id ? obtenerLogoDataUriPorId_(id) : '';
}

function obtenerLogoDataUriPorId_(id) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'logoDataUri_' + id;
  const cacheado = cache.get(cacheKey);
  if (cacheado) return cacheado;

  try {
    const blob = DriveApp.getFileById(id).getBlob();
    const dataUri = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    cache.put(cacheKey, dataUri, 21600); // 6 horas, el máximo permitido
    return dataUri;
  } catch (err) {
    return ''; // si falla, el <img> queda vacío en vez de romper la página
  }
}

// Verifica la clave de acceso al Panel de Biblioteca. Se llama desde
// Biblioteca.html antes de mostrar cualquier dato de solicitudes.
function validarClaveBiblioteca(clave) {
  return (clave || '').toString() === CLAVE_BIBLIOTECA;
}

// ────────────────────────────────────────────────────────────────────────
// LECTURA DEL CATÁLOGO (hoja "IndiceGlobal")
// Columnas: Proveedor, Sede, Titulo, Autor, Editorial, Categoria,
//           Programa, Precio, ISBN, Stock, Observaciones, HojaOrigen
//
// Con muchas personas usando el buscador a la vez, leer 12.000+ filas de
// la hoja en CADA solicitud (cada carga de página hace dos lecturas:
// getFacetsData() + buscarLibros(); cada filtro o cambio de página, una
// más) es lo que realmente puede hacer lento o colapsar el sistema bajo
// carga. Por eso el catálogo ya parseado se guarda comprimido en
// CacheService.getScriptCache() (compartido entre TODAS las personas que
// usan la app, no por usuario) y se reutiliza durante CATALOGO_CACHE_TTL
// segundos: la mayoría de las solicitudes ya no tocan la hoja para nada.
// Si algo falla al leer o guardar la caché, se sigue leyendo la hoja
// directamente sin romper la búsqueda (nunca dependemos 100% de la caché).
// ────────────────────────────────────────────────────────────────────────
const CATALOGO_CACHE_PREFIJO = 'catalogo_v1_';
const CATALOGO_CACHE_TTL = 1800; // 30 minutos (máximo permitido: 21600 = 6h)
const CATALOGO_CACHE_TAM_CHUNK = 90000; // CacheService limita cada valor a 100KB; dejamos margen

function leerCatalogo_() {
  const cache = CacheService.getScriptCache();
  const desdeCache = leerCatalogoDesdeCache_(cache);
  if (desdeCache) return desdeCache;

  const libros = leerCatalogoDesdeHoja_();
  guardarCatalogoEnCache_(cache, libros);
  return libros;
}

function leerCatalogoDesdeHoja_() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_HOJA_CATALOGO);

  if (!hoja) {
    throw new Error("No se encontró la pestaña '" + NOMBRE_HOJA_CATALOGO + "'. Verifica el nombre exacto en tu Sheet.");
  }

  const valores = hoja.getDataRange().getValues();
  const filas = valores.slice(1); // saltamos la fila de encabezados

  return filas
    .map(function (fila) {
      return {
        proveedor: fila[0],
        sede: fila[1],
        titulo: fila[2],
        autor: fila[3],
        editorial: fila[4],
        categoria: fila[5],
        programa: fila[6],
        precio: fila[7],
        isbn: fila[8],
        stock: fila[9],
        observaciones: fila[10],
        hojaOrigen: fila[11]
      };
    })
    .filter(function (libro) { return libro.titulo; }); // descarta filas vacías
}

// Comprime el catálogo (gzip + base64) y lo parte en varios trozos de
// CATALOGO_CACHE_TAM_CHUNK caracteres, porque CacheService no acepta un
// valor de más de 100KB por clave. Si algo sale mal (por ejemplo, el
// catálogo crece tanto que ni siquiera comprimido cabe), simplemente no
// se guarda nada: la próxima solicitud volverá a leer la hoja.
function guardarCatalogoEnCache_(cache, libros) {
  try {
    const json = JSON.stringify(libros);
    const comprimido = Utilities.gzip(Utilities.newBlob(json, 'application/json'));
    const base64 = Utilities.base64Encode(comprimido.getBytes());
    const totalChunks = Math.ceil(base64.length / CATALOGO_CACHE_TAM_CHUNK);

    const paquete = {};
    for (let i = 0; i < totalChunks; i++) {
      paquete[CATALOGO_CACHE_PREFIJO + i] =
        base64.substring(i * CATALOGO_CACHE_TAM_CHUNK, (i + 1) * CATALOGO_CACHE_TAM_CHUNK);
    }
    paquete[CATALOGO_CACHE_PREFIJO + 'meta'] = String(totalChunks);
    cache.putAll(paquete, CATALOGO_CACHE_TTL);
  } catch (err) {
    // Sin caché disponible, la app sigue funcionando (solo más lenta).
  }
}

// Reconstruye el catálogo desde los trozos guardados en caché. Devuelve
// null si no hay nada cacheado, si algún trozo ya expiró, o si algo no
// se puede leer/descomprimir — en cualquiera de esos casos, leerCatalogo_()
// vuelve a leer la hoja directamente.
function leerCatalogoDesdeCache_(cache) {
  try {
    const totalChunksTexto = cache.get(CATALOGO_CACHE_PREFIJO + 'meta');
    if (!totalChunksTexto) return null;

    const totalChunks = parseInt(totalChunksTexto, 10);
    const claves = [];
    for (let i = 0; i < totalChunks; i++) claves.push(CATALOGO_CACHE_PREFIJO + i);

    const partes = cache.getAll(claves);
    let base64 = '';
    for (let i = 0; i < totalChunks; i++) {
      const parte = partes[CATALOGO_CACHE_PREFIJO + i];
      if (!parte) return null; // un trozo faltante invalida todo el conjunto
      base64 += parte;
    }

    const bytes = Utilities.base64Decode(base64);
    const json = Utilities.ungzip(Utilities.newBlob(bytes, 'application/x-gzip')).getDataAsString();
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
}

// Utilidad para el personal de biblioteca: después de actualizar el
// catálogo "IndiceGlobal" directamente en la hoja, ejecutar esta función
// una vez desde el editor de Apps Script (menú Ejecutar) para que la app
// muestre los cambios de inmediato, en vez de esperar hasta 30 minutos a
// que la caché expire por sí sola.
function refrescarCacheCatalogo() {
  const cache = CacheService.getScriptCache();
  const libros = leerCatalogoDesdeHoja_();
  guardarCatalogoEnCache_(cache, libros);
  Logger.log('Caché del catálogo actualizada: ' + libros.length + ' títulos.');
}

// TEMPORAL: mide el efecto real de la caché. Se ejecuta una vez desde el
// editor y luego se borra (no forma parte de la app en producción).
function benchmarkTemporal() {
  const cache = CacheService.getScriptCache();
  cache.remove(CATALOGO_CACHE_PREFIJO + 'meta'); // fuerza una lectura fría de la hoja

  const t0 = new Date().getTime();
  getFacetsData();
  const t1 = new Date().getTime();
  Logger.log('1ra llamada SIN caché (lee la hoja completa): ' + (t1 - t0) + ' ms');

  const tiempos = [];
  for (let i = 0; i < 10; i++) {
    const a = new Date().getTime();
    buscarLibros({ query: 'enfermeria', page: 1 });
    const b = new Date().getTime();
    tiempos.push(b - a);
  }
  const promedio = tiempos.reduce(function (s, x) { return s + x; }, 0) / tiempos.length;
  Logger.log('Siguientes 10 llamadas CON caché tibia: ' + tiempos.join(', ') + ' ms');
  Logger.log('Promedio con caché: ' + promedio.toFixed(1) + ' ms');
}

// Llena los filtros: sede, proveedor y "Temática" (el catálogo "IndiceGlobal"
// tiene dos columnas relacionadas al tema del libro, Categoria y Programa;
// el filtro de Temática debe recoger ambas, unidas en una sola lista).
function getFacetsData() {
  const libros = leerCatalogo_();

  const sedes = Array.from(new Set(libros.map(function (l) { return l.sede; }).filter(Boolean))).sort();
  const proveedores = Array.from(new Set(libros.map(function (l) { return l.proveedor; }).filter(Boolean))).sort();

  // Unimos Categoria + Programa: ambas columnas describen el tema del libro
  // (ej. Categoria="Educación", Programa="Neuroeducación"), así que la
  // Temática debe mostrar y filtrar por cualquiera de las dos.
  const categoriasSet = new Set();
  libros.forEach(function (l) {
    if (l.categoria) categoriasSet.add(l.categoria);
    if (l.programa) categoriasSet.add(l.programa);
  });

  return {
    sedes: sedes,
    proveedores: proveedores,
    categorias: Array.from(categoriasSet).sort(),
    totalTitulos: libros.length
  };
}

// Búsqueda + filtros + paginación
function buscarLibros(opts) {
  opts = opts || {};
  const query = (opts.query || "").toString().trim().toLowerCase();
  const sede = opts.sede || "";
  const proveedor = opts.proveedor || "";
  const categoria = opts.categoria || "";
  const paginaSolicitada = Number(opts.page) || 1;

  let libros = leerCatalogo_();

  if (sede) libros = libros.filter(function (l) { return l.sede === sede; });
  if (proveedor) libros = libros.filter(function (l) { return l.proveedor === proveedor; });
  if (categoria) libros = libros.filter(function (l) { return l.categoria === categoria || l.programa === categoria; });

  if (query) {
    libros = libros.filter(function (l) {
      return (l.titulo && l.titulo.toString().toLowerCase().indexOf(query) !== -1) ||
             (l.autor && l.autor.toString().toLowerCase().indexOf(query) !== -1) ||
             (l.isbn && l.isbn.toString().toLowerCase().indexOf(query) !== -1) ||
             (l.categoria && l.categoria.toString().toLowerCase().indexOf(query) !== -1) ||
             (l.programa && l.programa.toString().toLowerCase().indexOf(query) !== -1);
    });
  }

  const total = libros.length;
  const totalPages = Math.max(1, Math.ceil(total / TAMANO_PAGINA));
  const paginaSegura = Math.min(Math.max(1, paginaSolicitada), totalPages);
  const inicio = (paginaSegura - 1) * TAMANO_PAGINA;

  return {
    items: libros.slice(inicio, inicio + TAMANO_PAGINA),
    total: total,
    page: paginaSegura,
    totalPages: totalPages
  };
}

// ────────────────────────────────────────────────────────────────────────
// REGISTRO Y NOTIFICACIÓN DE PEDIDOS
// ────────────────────────────────────────────────────────────────────────

function registrarPedido(datosPedido) {

  // Si se ejecuta manualmente desde el editor (sin pasar datosPedido),
  // esto evita el error genérico "Cannot read properties of undefined"
  // y explica exactamente qué pasó.
  if (!datosPedido) {
    throw new Error(
      "registrarPedido() se ejecutó sin datos. Esta función debe ser " +
      "llamada desde el formulario web (google.script.run), no desde el " +
      "editor de Apps Script. Para probarla manualmente usa la función " +
      "'probarRegistrarPedido' en su lugar."
    );
  }

  // 1. Validamos y normalizamos los datos recibidos del cliente.
  //    Nunca confiamos en el HTML/JS del navegador: alguien podría llamar
  //    a esta función directamente saltándose las validaciones del modal.
  validarDatosPedido_(datosPedido);

  const sede = datosPedido.sede.toString().trim();
  const nombre = datosPedido.nombre.toString().trim();
  const documento = datosPedido.documento.toString().trim();
  const email = datosPedido.email.toString().trim();
  const tipoUsuario = datosPedido.tipoUsuario.toString().trim();
  const facultad = datosPedido.facultad.toString().trim();
  const programa = datosPedido.programa.toString().trim();
  const asignatura = datosPedido.asignatura.toString().trim();
  const librosUnicos = deduplicarLibros_(datosPedido.libros);

  // 2. Generamos identificador único, timestamp y total del pedido ANTES de
  //    tocar la hoja, para que el bloqueo (paso siguiente) dure lo menos
  //    posible: con muchas personas enviando solicitudes a la vez, cuanto
  //    menos tiempo tenga cada una ocupado el candado, más rápido le toca
  //    su turno a las demás.
  const fecha = new Date();
  const idSolicitud = generarIdSolicitud_(fecha);
  const total = librosUnicos.reduce(function (suma, l) {
    return suma + (Number(l.precio) || 0) * (Number(l.cantidad) || 1);
  }, 0);

  const filasParaInsertar = librosUnicos.map(function (libroItem) {
    return [
      fecha,
      sede,
      nombre,
      documento,
      email,
      tipoUsuario,
      facultad,
      programa,
      asignatura,
      libroItem.titulo,
      libroItem.autor || '',
      libroItem.programa || libroItem.categoria || '',
      libroItem.isbn || '',
      libroItem.proveedor || '',
      Number(libroItem.precio) || 0,
      Number(libroItem.cantidad) || 1,
      idSolicitud,
      'Pendiente'
    ];
  });

  // 3. Escribimos en la hoja bajo un candado (LockService): si dos personas
  //    envían su solicitud en el mismo instante, sin candado ambas podrían
  //    calcular la MISMA "próxima fila libre" y una sobreescribiría los
  //    datos de la otra. El candado obliga a que las escrituras ocurran
  //    una por una. Si el sistema está muy saturado y no consigue el turno
  //    en 10 segundos, avisamos con un mensaje claro en vez de fallar en
  //    silencio o corromper datos.
  const candado = LockService.getScriptLock();
  try {
    candado.waitLock(10000);
  } catch (err) {
    throw new Error("El sistema está recibiendo muchas solicitudes en este momento. Por favor, intenta enviar tu solicitud de nuevo en unos segundos.");
  }

  try {
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hojaPedidos = libro.getSheetByName(NOMBRE_HOJA_PEDIDOS);

    if (!hojaPedidos) {
      throw new Error("No se encontró la pestaña '" + NOMBRE_HOJA_PEDIDOS + "'. Verifica el nombre en el archivo de Sheets.");
    }

    inicializarHojaPedidos_(hojaPedidos);

    hojaPedidos.getRange(
      hojaPedidos.getLastRow() + 1,
      1,
      filasParaInsertar.length,
      filasParaInsertar[0].length
    ).setValues(filasParaInsertar);
  } finally {
    candado.releaseLock();
  }

  // 4. Notificamos únicamente a la biblioteca (no se envía copia a quien
  //    diligencia la solicitud).
  const datosCorreo = {
    idSolicitud: idSolicitud,
    fecha: fecha,
    sede: sede,
    nombre: nombre,
    documento: documento,
    email: email,
    tipoUsuario: tipoUsuario,
    facultad: facultad,
    programa: programa,
    asignatura: asignatura,
    libros: librosUnicos,
    total: total
  };
  enviarCorreoBiblioteca_(datosCorreo);

  // 5. Devolvemos al cliente los datos de confirmación.
  //    Enviamos la fecha como texto ISO: los objetos Date anidados dentro de
  //    la respuesta de google.script.run pueden perder la serialización y
  //    llegar como null al cliente.
  return {
    ok: true,
    idSolicitud: idSolicitud,
    total: total,
    fecha: fecha.toISOString(),
    cantidadLibros: librosUnicos.length
  };
}

// Valida los datos del pedido antes de tocar la hoja o enviar correo.
// Lanza un Error con un mensaje claro apenas encuentra el primer problema.
function validarDatosPedido_(d) {
  if (!d.sede || SEDES_VALIDAS.indexOf(d.sede.toString().trim()) === -1) {
    throw new Error("La sede seleccionada no es válida.");
  }
  if (!d.nombre || !d.nombre.toString().trim()) {
    throw new Error("Falta el nombre completo de quien diligencia la solicitud.");
  }
  if (!d.documento || !d.documento.toString().trim()) {
    throw new Error("Falta el número de documento.");
  }
  if (!d.email || !REGEX_EMAIL.test(d.email.toString().trim())) {
    throw new Error("El correo electrónico no es válido.");
  }
  if (!d.tipoUsuario || TIPOS_USUARIO_VALIDOS.indexOf(d.tipoUsuario.toString().trim()) === -1) {
    throw new Error("Selecciona un tipo de usuario válido.");
  }
  if (!d.facultad || !d.facultad.toString().trim()) {
    throw new Error("Falta la facultad.");
  }
  if (!d.programa || !d.programa.toString().trim()) {
    throw new Error("Falta el programa académico.");
  }
  if (!d.asignatura || !d.asignatura.toString().trim()) {
    throw new Error("Falta la asignatura a la que apoya la solicitud.");
  }
  if (!Array.isArray(d.libros) || d.libros.length === 0) {
    throw new Error("El pedido no contiene libros seleccionados.");
  }
  d.libros.forEach(function (l, i) {
    if (!l || !l.titulo || !l.titulo.toString().trim()) {
      throw new Error("Uno de los libros seleccionados no tiene título válido (posición " + (i + 1) + ").");
    }
  });
}

// Combina libros repetidos dentro del mismo pedido (mismo ISBN, o mismo
// título+autor cuando no hay ISBN) sumando sus cantidades, en vez de
// descartar el duplicado. También normaliza "cantidad": si falta o no es
// un número válido, asume 1 ejemplar; siempre queda como entero >= 1.
function deduplicarLibros_(libros) {
  const indicePorClave = {};
  const resultado = [];
  libros.forEach(function (l) {
    const isbn = l.isbn ? String(l.isbn).trim().toLowerCase() : '';
    const clave = isbn || (String(l.titulo).trim().toLowerCase() + '|' + String(l.autor || '').trim().toLowerCase());
    const cantidad = Math.max(1, Math.round(Number(l.cantidad)) || 1);

    if (indicePorClave.hasOwnProperty(clave)) {
      resultado[indicePorClave[clave]].cantidad += cantidad;
    } else {
      indicePorClave[clave] = resultado.length;
      const copia = {};
      for (const k in l) { copia[k] = l[k]; }
      copia.cantidad = cantidad;
      resultado.push(copia);
    }
  });
  return resultado;
}

// Crea un identificador legible y único para cada solicitud, ej:
// SOL-20260804-141213-A9F2
function generarIdSolicitud_(fecha) {
  const marcaTiempo = Utilities.formatDate(fecha, "GMT-5", "yyyyMMdd-HHmmss");
  const sufijo = Math.random().toString(36).substring(2, 6).toUpperCase();
  return "SOL-" + marcaTiempo + "-" + sufijo;
}

// Escribe/corrige los encabezados de la hoja "Pedidos" sin tocar los datos.
// Si la hoja está vacía, escribe las columnas completas; si ya tiene datos,
// solo corrige la fila de encabezados si no coincide con el esquema actual.
function inicializarHojaPedidos_(hoja) {
  const encabezados = [
    "Fecha", "Sede", "Nombre", "Documento", "Email", "Tipo de Usuario",
    "Facultad", "Programa", "Asignatura", "Titulo", "Autor", "Categoria", "ISBN", "Proveedor",
    "Precio", "Cantidad", "ID Solicitud", "Estado"
  ];

  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, TOTAL_COLUMNAS_PEDIDOS).setValues([encabezados]);
    return;
  }

  const anchoActual = Math.max(hoja.getLastColumn(), TOTAL_COLUMNAS_PEDIDOS);
  const encabezadoActual = hoja.getRange(1, 1, 1, anchoActual).getValues()[0];
  if (encabezadoActual[COL_PEDIDO_ID - 1] !== "ID Solicitud") {
    hoja.getRange(1, 1, 1, TOTAL_COLUMNAS_PEDIDOS).setValues([encabezados]);
  }
}

// Escapa texto para insertarlo de forma segura dentro del HTML del correo.
// Los datos que llegan del cliente nunca deben insertarse tal cual en HTML.
function sanitizarHtml_(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatearPrecioCorreo_(valor) {
  const num = Number(valor) || 0;
  return '$ ' + num.toLocaleString('es-CO');
}

// Construye el encabezado y pie de página compartidos por ambos correos,
// para que se vean como parte del mismo sistema (misma paleta institucional).
function envolverCorreoHtml_(tituloEncabezado, cuerpoInterno) {
  const colorPrincipal = "#7fb536";
  const colorAcento = "#F59C2F";
  const colorTexto = "#000000";
  const colorTextoSuave = "#606060";
  const colorPaper = "#F2ECDD";
  const colorLinea = "#D8CFB4";

  let html = `<div style="font-family: 'Inter', Helvetica, sans-serif; background-color: ${colorPaper}; padding: 30px 15px; color: ${colorTexto};">`;
  html += `<div style="max-width: 700px; margin: 0 auto; background-color: #FFFFFF; border-radius: 4px; overflow: hidden; border: 1px solid ${colorLinea}; box-shadow: 0 4px 15px rgba(0,0,0,.1);">`;
  html += `<div style="background-color: ${colorPrincipal}; padding: 25px 30px; border-bottom: 5px solid ${colorAcento};">
             <p style="color: #FFFFFF; font-family: 'Courier New', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 5px;">Bibliotecas Demo · Mesas Curriculares · Sede Demo</p>
             <h2 style="color: #FFFFFF; margin: 0; font-size: 22px;">${tituloEncabezado}</h2>
            </div>`;
  html += cuerpoInterno;
  html += `<div style="background-color: #E7DFC9; padding: 15px 30px; text-align: center; font-size: 12px; color: ${colorTextoSuave};">
             Este es un mensaje automático generado por Solicitud de Libros (Mesas Curriculares). Conserva el ID de solicitud para hacerle seguimiento.
            </div>`;
  html += `</div></div>`;
  return html;
}

// Tabla HTML de libros solicitados, reutilizada por ambos correos.
// Si se pasa "programaSolicitante", agrega una columna "Programa del libro"
// que compara el programa/categoría del título (tal como está en el catálogo)
// contra el programa académico que declaró quien diligenció la solicitud, para
// detectar de un vistazo si lo que se está pidiendo va alineado con su programa
// (✓ coincide, ⚠ no coincide o el libro no tiene programa registrado).
function tablaLibrosHtml_(libros, programaSolicitante) {
  const colorPrincipal = "#7fb536";
  const colorAcento = "#F59C2F";
  const colorTextoSuave = "#606060";
  const colorLinea = "#D8CFB4";
  const programaNormalizado = (programaSolicitante || '').toString().trim().toLowerCase();

  let tabla = `<table width="100%" cellpadding="12" cellspacing="0" style="border-collapse: collapse; font-size: 14px; text-align: left; margin-top: 8px;">
                <thead>
                  <tr style="background-color: ${colorPrincipal}; color: #FFFFFF;">
                    <th>Título</th>
                    <th>Autor</th>
                    <th>Programa del libro</th>
                    <th>Proveedor</th>
                    <th>Ejemplares</th>
                    <th>Precio unit.</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>`;

  libros.forEach(function (libroItem) {
    const programaLibro = (libroItem.programa || libroItem.categoria || '').toString().trim();
    const coincide = programaNormalizado && programaLibro && programaLibro.toLowerCase() === programaNormalizado;
    const estiloPrograma = !programaLibro
      ? `color: ${colorTextoSuave};`
      : (coincide ? `color: ${colorPrincipal}; font-weight: bold;` : `color: ${colorAcento}; font-weight: bold;`);
    const marca = !programaNormalizado || !programaLibro ? '' : (coincide ? ' ✓' : ' ⚠');
    const cantidad = Math.max(1, Math.round(Number(libroItem.cantidad)) || 1);
    const subtotal = (Number(libroItem.precio) || 0) * cantidad;

    tabla += `<tr style="border-bottom: 1px solid ${colorLinea};">
                <td style="font-weight: bold;">${sanitizarHtml_(libroItem.titulo)}</td>
                <td style="color: ${colorTextoSuave};">${sanitizarHtml_(libroItem.autor) || 'N/A'}</td>
                <td style="${estiloPrograma}">${sanitizarHtml_(programaLibro) || 'N/A'}${marca}</td>
                <td>${sanitizarHtml_(libroItem.proveedor) || 'N/A'}</td>
                <td style="text-align:center; font-weight:bold;">${cantidad}</td>
                <td>${formatearPrecioCorreo_(libroItem.precio)}</td>
                <td style="font-weight:bold;">${formatearPrecioCorreo_(subtotal)}</td>
               </tr>`;
  });

  tabla += `</tbody></table>`;
  return tabla;
}

// ── CORREO A LA BIBLIOTECA (operativo, con todos los datos de la solicitud) ──
function enviarCorreoBiblioteca_(datos) {
  const colorPrincipal = "#7fb536";
  const fechaTexto = Utilities.formatDate(datos.fecha, "GMT-5", "dd/MM/yyyy HH:mm");

  let cuerpo = `<div style="padding: 25px 30px;">
                  <p style="margin-top: 0;">Se ha registrado una nueva solicitud a través de Solicitud de Libros (Mesas Curriculares).</p>
                  <div style="background-color: #FBF8F2; padding: 15px; border-left: 4px solid ${colorPrincipal}; margin-bottom: 20px;">
                    <strong>ID de solicitud:</strong> ${sanitizarHtml_(datos.idSolicitud)}<br>
                    <strong>Fecha:</strong> ${fechaTexto}<br>
                    <strong>Sede:</strong> ${sanitizarHtml_(datos.sede)}<br>
                    <strong>Valor total estimado:</strong> ${formatearPrecioCorreo_(datos.total)}
                  </div>
                  <div style="background-color: #FBF8F2; padding: 15px; border-left: 4px solid ${colorPrincipal}; margin-bottom: 20px;">
                    <strong>Nombre:</strong> ${sanitizarHtml_(datos.nombre)}<br>
                    <strong>Documento:</strong> ${sanitizarHtml_(datos.documento)}<br>
                    <strong>Tipo de usuario:</strong> ${sanitizarHtml_(datos.tipoUsuario)}<br>
                    <strong>Email:</strong> ${sanitizarHtml_(datos.email)}<br>
                    <strong>Facultad:</strong> ${sanitizarHtml_(datos.facultad)}<br>
                    <strong>Programa:</strong> ${sanitizarHtml_(datos.programa)}<br>
                    <strong>Asignatura:</strong> ${sanitizarHtml_(datos.asignatura)}
                  </div>
                  <h3 style="font-size: 16px; margin-bottom: 4px;">Títulos solicitados (${datos.libros.length}):</h3>
                  ${tablaLibrosHtml_(datos.libros, datos.programa)}
                  <p style="font-size: 12px; color: ${colorPrincipal}; margin-top: 10px;">✓ el programa del libro coincide con el programa declarado · <span style="color:#F59C2F;">⚠ no coincide, revisar si aplica igual</span></p>
                 </div>`;

  MailApp.sendEmail({
    to: CORREO_BIBLIOTECA,
    replyTo: datos.email,
    subject: `Nueva solicitud de catálogo [${datos.idSolicitud}] - ${datos.sede} (${datos.nombre})`,
    htmlBody: envolverCorreoHtml_("Nueva Solicitud de Material", cuerpo)
  });
}

// ────────────────────────────────────────────────────────────────────────
// LIBROS DESEADOS (títulos que NO están en ningún catálogo de proveedores)
// Botón "¿No lo encuentras? ¡Pídelo aquí!" del buscador público. Se guarda
// en una hoja aparte ("LibrosDeseados") para no mezclarlo con los pedidos
// normales del catálogo, y así la biblioteca puede llevar un listado propio
// de qué títulos le están pidiendo comprar a futuro.
// ────────────────────────────────────────────────────────────────────────

// Crea la hoja "LibrosDeseados" si todavía no existe (primera vez que se usa
// la función), y corrige el encabezado si no coincide con el esquema actual.
function inicializarHojaDeseos_(hoja) {
  const encabezados = [
    "Fecha", "Sede", "Nombre", "Documento", "Email", "Tipo de Usuario",
    "Facultad", "Programa", "Asignatura", "Titulo Deseado", "Autor Deseado",
    "ISBN Deseado", "Proveedor Deseado", "Comentario", "Cantidad", "ID Deseo", "Estado"
  ];

  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, TOTAL_COLUMNAS_DESEOS).setValues([encabezados]);
    return;
  }

  const anchoActual = Math.max(hoja.getLastColumn(), TOTAL_COLUMNAS_DESEOS);
  const encabezadoActual = hoja.getRange(1, 1, 1, anchoActual).getValues()[0];
  if (encabezadoActual[COL_DESEO_ID - 1] !== "ID Deseo") {
    hoja.getRange(1, 1, 1, TOTAL_COLUMNAS_DESEOS).setValues([encabezados]);
  }
}

// Registra una solicitud especial de un libro que no está en ningún catálogo.
function registrarDeseo(datos) {
  if (!datos) {
    throw new Error(
      "registrarDeseo() se ejecutó sin datos. Debe ser llamada desde el " +
      "formulario web (google.script.run), no desde el editor de Apps Script."
    );
  }

  if (!datos.sede || SEDES_VALIDAS.indexOf(datos.sede.toString().trim()) === -1) {
    throw new Error("La sede seleccionada no es válida.");
  }
  if (!datos.nombre || !datos.nombre.toString().trim()) {
    throw new Error("Falta el nombre completo.");
  }
  if (!datos.documento || !datos.documento.toString().trim()) {
    throw new Error("Falta el número de documento.");
  }
  if (!datos.email || !REGEX_EMAIL.test(datos.email.toString().trim())) {
    throw new Error("El correo electrónico no es válido.");
  }
  if (!datos.tipoUsuario || TIPOS_USUARIO_VALIDOS.indexOf(datos.tipoUsuario.toString().trim()) === -1) {
    throw new Error("Selecciona un tipo de usuario válido.");
  }
  if (!datos.facultad || !datos.facultad.toString().trim()) {
    throw new Error("Falta la facultad.");
  }
  if (!datos.programa || !datos.programa.toString().trim()) {
    throw new Error("Falta el programa académico.");
  }
  if (!datos.tituloDeseado || !datos.tituloDeseado.toString().trim()) {
    throw new Error("Falta el título del libro que deseas solicitar.");
  }

  const sede = datos.sede.toString().trim();
  const nombre = datos.nombre.toString().trim();
  const documento = datos.documento.toString().trim();
  const email = datos.email.toString().trim();
  const tipoUsuario = datos.tipoUsuario.toString().trim();
  const facultad = datos.facultad.toString().trim();
  const programa = datos.programa.toString().trim();
  const asignatura = (datos.asignatura || '').toString().trim();
  const tituloDeseado = datos.tituloDeseado.toString().trim();
  const autorDeseado = (datos.autorDeseado || '').toString().trim();
  const isbnDeseado = (datos.isbnDeseado || '').toString().trim();
  const proveedorDeseado = (datos.proveedorDeseado || '').toString().trim();
  const comentario = (datos.comentario || '').toString().trim();
  const cantidad = Math.max(1, parseInt(datos.cantidad, 10) || 1);

  const fecha = new Date();
  const idDeseo = "DES-" + Utilities.formatDate(fecha, "GMT-5", "yyyyMMdd-HHmmss") +
    "-" + Math.random().toString(36).substring(2, 6).toUpperCase();

  // Mismo candado que registrarPedido(): evita que dos solicitudes especiales
  // enviadas al mismo tiempo se pisen entre sí al escribir en la hoja.
  const candado = LockService.getScriptLock();
  try {
    candado.waitLock(10000);
  } catch (err) {
    throw new Error("El sistema está recibiendo muchas solicitudes en este momento. Por favor, intenta enviar tu solicitud de nuevo en unos segundos.");
  }

  try {
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    let hoja = libro.getSheetByName(NOMBRE_HOJA_DESEOS);
    if (!hoja) {
      hoja = libro.insertSheet(NOMBRE_HOJA_DESEOS);
    }
    inicializarHojaDeseos_(hoja);

    hoja.appendRow([
      fecha, sede, nombre, documento, email, tipoUsuario, facultad, programa,
      asignatura, tituloDeseado, autorDeseado, isbnDeseado, proveedorDeseado,
      comentario, cantidad, idDeseo, 'Pendiente'
    ]);
  } finally {
    candado.releaseLock();
  }

  enviarCorreoDeseo_({
    idDeseo: idDeseo, fecha: fecha, sede: sede, nombre: nombre, documento: documento,
    email: email, tipoUsuario: tipoUsuario, facultad: facultad, programa: programa,
    asignatura: asignatura, tituloDeseado: tituloDeseado, autorDeseado: autorDeseado,
    isbnDeseado: isbnDeseado, proveedorDeseado: proveedorDeseado, comentario: comentario,
    cantidad: cantidad
  });

  // Igual que registrarPedido: enviamos la fecha como texto ISO para que no
  // se pierda al viajar dentro de la respuesta de google.script.run.
  return { ok: true, idDeseo: idDeseo, fecha: fecha.toISOString() };
}

// ── CORREO A LA BIBLIOTECA (solicitud especial, libro fuera de catálogo) ──
function enviarCorreoDeseo_(datos) {
  const colorAcento = "#F59C2F";
  const colorAcentoSecundario = "#e6007e";
  const fechaTexto = Utilities.formatDate(datos.fecha, "GMT-5", "dd/MM/yyyy HH:mm");

  let cuerpo = `<div style="padding: 25px 30px;">
                  <p style="margin-top: 0;">Se registró una <strong>solicitud especial</strong>: un libro que la persona no encontró en ninguno de los catálogos de los proveedores.</p>
                  <div style="background-color: #FBF8F2; padding: 15px; border-left: 4px solid ${colorAcentoSecundario}; margin-bottom: 20px;">
                    <strong>ID de solicitud:</strong> ${sanitizarHtml_(datos.idDeseo)}<br>
                    <strong>Fecha:</strong> ${fechaTexto}<br>
                    <strong>Sede:</strong> ${sanitizarHtml_(datos.sede)}
                  </div>
                  <div style="background-color: #FBF8F2; padding: 15px; border-left: 4px solid ${colorAcento}; margin-bottom: 20px;">
                    <strong>Título deseado:</strong> ${sanitizarHtml_(datos.tituloDeseado)}<br>
                    <strong>Autor:</strong> ${sanitizarHtml_(datos.autorDeseado) || 'No especificado'}<br>
                    <strong>ISBN:</strong> ${sanitizarHtml_(datos.isbnDeseado) || 'No especificado'}<br>
                    <strong>Proveedor sugerido:</strong> ${sanitizarHtml_(datos.proveedorDeseado) || 'No especificado'}<br>
                    <strong>Ejemplares sugeridos:</strong> ${datos.cantidad || 1}
                    ${datos.comentario ? '<br><strong>Comentario:</strong> ' + sanitizarHtml_(datos.comentario) : ''}
                  </div>
                  <div style="background-color: #FBF8F2; padding: 15px; border-left: 4px solid ${colorAcentoSecundario};">
                    <strong>Nombre:</strong> ${sanitizarHtml_(datos.nombre)}<br>
                    <strong>Documento:</strong> ${sanitizarHtml_(datos.documento)}<br>
                    <strong>Tipo de usuario:</strong> ${sanitizarHtml_(datos.tipoUsuario)}<br>
                    <strong>Email:</strong> ${sanitizarHtml_(datos.email)}<br>
                    <strong>Facultad:</strong> ${sanitizarHtml_(datos.facultad)}<br>
                    <strong>Programa:</strong> ${sanitizarHtml_(datos.programa)}${datos.asignatura ? '<br><strong>Asignatura:</strong> ' + sanitizarHtml_(datos.asignatura) : ''}
                  </div>
                 </div>`;

  MailApp.sendEmail({
    to: CORREO_BIBLIOTECA,
    replyTo: datos.email,
    subject: `📚 Solicitud especial (no está en catálogo) [${datos.idDeseo}] - ${datos.sede} (${datos.nombre})`,
    htmlBody: envolverCorreoHtml_("Libro no encontrado en catálogo", cuerpo)
  });
}

// Devuelve todas las solicitudes especiales registradas (uso interno del
// Panel de Biblioteca), la más reciente primero.
function obtenerListaDeseos() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_HOJA_DESEOS);
  if (!hoja || hoja.getLastRow() < 2) return [];

  const filas = hoja.getDataRange().getValues().slice(1);
  return filas
    .filter(function (f) { return f[COL_DESEO_ID - 1]; })
    .map(function (f) {
      const fechaCelda = f[COL_DESEO_FECHA - 1];
      return {
        idDeseo: f[COL_DESEO_ID - 1],
        fecha: (fechaCelda instanceof Date) ? fechaCelda.toISOString() : fechaCelda,
        sede: f[COL_DESEO_SEDE - 1],
        nombre: f[COL_DESEO_NOMBRE - 1],
        documento: f[COL_DESEO_DOCUMENTO - 1],
        email: f[COL_DESEO_EMAIL - 1],
        tipoUsuario: f[COL_DESEO_TIPOUSUARIO - 1],
        facultad: f[COL_DESEO_FACULTAD - 1],
        programa: f[COL_DESEO_PROGRAMA - 1],
        asignatura: f[COL_DESEO_ASIGNATURA - 1],
        tituloDeseado: f[COL_DESEO_TITULO - 1],
        autorDeseado: f[COL_DESEO_AUTOR - 1],
        isbnDeseado: f[COL_DESEO_ISBN - 1],
        proveedorDeseado: f[COL_DESEO_PROVEEDOR - 1],
        comentario: f[COL_DESEO_COMENTARIO - 1],
        cantidad: f[COL_DESEO_CANTIDAD - 1] || 1,
        estado: f[COL_DESEO_ESTADO - 1] || 'Pendiente'
      };
    })
    .sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });
}

// Cambia el estado (Pendiente/Conseguido) de una solicitud especial.
function actualizarEstadoDeseo(idDeseo, nuevoEstado) {
  const estadosValidos = ["Pendiente", "Conseguido"];
  if (!idDeseo) {
    throw new Error("Falta el ID de la solicitud especial.");
  }
  if (estadosValidos.indexOf(nuevoEstado) === -1) {
    throw new Error("Estado no válido.");
  }

  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_HOJA_DESEOS);
  if (!hoja) {
    throw new Error("No se encontró la pestaña '" + NOMBRE_HOJA_DESEOS + "'.");
  }

  const valores = hoja.getDataRange().getValues();
  let actualizado = false;
  for (let i = 1; i < valores.length; i++) {
    if (String(valores[i][COL_DESEO_ID - 1]) === String(idDeseo)) {
      hoja.getRange(i + 1, COL_DESEO_ESTADO).setValue(nuevoEstado);
      actualizado = true;
      break;
    }
  }

  if (!actualizado) {
    throw new Error("No se encontró la solicitud especial indicada.");
  }
  return { ok: true, idDeseo: idDeseo, estado: nuevoEstado };
}

// ────────────────────────────────────────────────────────────────────────
// HISTORIAL DE SOLICITUDES
// ────────────────────────────────────────────────────────────────────────

// Agrupa las filas planas de la hoja "Pedidos" en solicitudes completas
// (una solicitud = varias filas que comparten el mismo ID). Las filas
// anteriores al 4 de agosto (formato viejo) o sin ID quedan fuera del
// agrupamiento, pero permanecen intactas en la hoja.
function agruparFilasPedidos_(filas, filtroEmail) {
  const solicitudes = {};

  filas.forEach(function (fila) {
    const id = fila[COL_PEDIDO_ID - 1];
    if (!id) return; // fila vacía, de encabezado, o de un formato anterior sin ID

    const emailFila = String(fila[COL_PEDIDO_EMAIL - 1] || '').trim().toLowerCase();
    if (filtroEmail && emailFila !== filtroEmail) return;

    if (!solicitudes[id]) {
      const fechaCelda = fila[COL_PEDIDO_FECHA - 1];
      solicitudes[id] = {
        idSolicitud: id,
        // Enviamos texto ISO en vez del objeto Date: anidado dentro del array
        // de solicitudes, un Date puede romper la serialización de
        // google.script.run y llegar como null al cliente.
        fecha: (fechaCelda instanceof Date) ? fechaCelda.toISOString() : fechaCelda,
        sede: fila[COL_PEDIDO_SEDE - 1],
        nombre: fila[COL_PEDIDO_NOMBRE - 1],
        documento: fila[COL_PEDIDO_DOCUMENTO - 1],
        email: fila[COL_PEDIDO_EMAIL - 1],
        tipoUsuario: fila[COL_PEDIDO_TIPOUSUARIO - 1],
        facultad: fila[COL_PEDIDO_FACULTAD - 1],
        programa: fila[COL_PEDIDO_PROGRAMA - 1],
        asignatura: fila[COL_PEDIDO_ASIGNATURA - 1],
        estado: fila[COL_PEDIDO_ESTADO - 1] || 'Pendiente',
        libros: [],
        total: 0
      };
    }

    const cantidadFila = Math.max(1, Math.round(Number(fila[COL_PEDIDO_CANTIDAD - 1])) || 1);
    solicitudes[id].libros.push({
      titulo: fila[COL_PEDIDO_TITULO - 1],
      autor: fila[COL_PEDIDO_AUTOR - 1],
      categoria: fila[COL_PEDIDO_CATEGORIA - 1],
      isbn: fila[COL_PEDIDO_ISBN - 1],
      proveedor: fila[COL_PEDIDO_PROVEEDOR - 1],
      precio: fila[COL_PEDIDO_PRECIO - 1],
      cantidad: cantidadFila
    });
    solicitudes[id].total += (Number(fila[COL_PEDIDO_PRECIO - 1]) || 0) * cantidadFila;
  });

  return Object.keys(solicitudes)
    .map(function (id) { return solicitudes[id]; })
    .sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });
}

// Devuelve el historial de solicitudes de un usuario, identificado por su email.
function obtenerHistorialPedidos(email) {
  if (!email || !REGEX_EMAIL.test(email.toString().trim())) {
    throw new Error("Ingresa un correo electrónico válido para consultar tu historial.");
  }
  const emailBuscado = email.toString().trim().toLowerCase();

  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_HOJA_PEDIDOS);
  if (!hoja || hoja.getLastRow() < 2) return [];

  const filas = hoja.getDataRange().getValues().slice(1);
  return agruparFilasPedidos_(filas, emailBuscado);
}

// ────────────────────────────────────────────────────────────────────────
// PANEL DE BIBLIOTECA (uso interno del personal de biblioteca)
// ────────────────────────────────────────────────────────────────────────

// Devuelve todas las solicitudes registradas, sin filtrar por usuario.
function obtenerPanelBibliotecaData() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_HOJA_PEDIDOS);
  if (!hoja || hoja.getLastRow() < 2) return [];

  const filas = hoja.getDataRange().getValues().slice(1);
  return agruparFilasPedidos_(filas, null);
}

// Cambia el estado (Pendiente/Completado) de todas las filas de una solicitud.
function actualizarEstadoPedido(idSolicitud, nuevoEstado) {
  const estadosValidos = ["Pendiente", "Completado"];
  if (!idSolicitud) {
    throw new Error("Falta el ID de la solicitud.");
  }
  if (estadosValidos.indexOf(nuevoEstado) === -1) {
    throw new Error("Estado no válido.");
  }

  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_HOJA_PEDIDOS);
  if (!hoja) {
    throw new Error("No se encontró la pestaña '" + NOMBRE_HOJA_PEDIDOS + "'.");
  }

  const valores = hoja.getDataRange().getValues();
  let actualizados = 0;
  for (let i = 1; i < valores.length; i++) {
    if (String(valores[i][COL_PEDIDO_ID - 1]) === String(idSolicitud)) {
      hoja.getRange(i + 1, COL_PEDIDO_ESTADO).setValue(nuevoEstado);
      actualizados++;
    }
  }

  if (actualizados === 0) {
    throw new Error("No se encontró la solicitud indicada.");
  }
  return { ok: true, actualizados: actualizados, idSolicitud: idSolicitud, estado: nuevoEstado };
}

// ────────────────────────────────────────────────────────────────────────
// EXPORTAR RESUMEN A EXCEL (uso interno del personal de biblioteca)
// Genera un .xlsx con varias hojas: resumen por persona, por programa,
// por libro, y el detalle completo. Se arma en una hoja de cálculo temporal
// (para poder exportarla como Excel real) y se borra apenas se obtienen
// los bytes del archivo.
// ────────────────────────────────────────────────────────────────────────

// Lee "Pedidos" y agrupa la información en las distintas tablas del reporte.
function generarResumenExportable_() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_HOJA_PEDIDOS);
  if (!hoja || hoja.getLastRow() < 2) {
    throw new Error("No hay solicitudes registradas todavía para exportar.");
  }

  const filas = hoja.getDataRange().getValues().slice(1).filter(function (f) {
    return f[COL_PEDIDO_ID - 1]; // descarta filas de formatos anteriores sin ID
  });

  const solicitudesUnicas = new Set();
  const porPersona = {};
  const porPrograma = {};
  const porLibro = {};
  const porCategoria = {};
  let totalValor = 0;

  const detalle = filas.map(function (f) {
    const precio = Number(f[COL_PEDIDO_PRECIO - 1]) || 0;
    const cantidad = Math.max(1, Math.round(Number(f[COL_PEDIDO_CANTIDAD - 1])) || 1);
    const subtotal = precio * cantidad;
    const id = f[COL_PEDIDO_ID - 1];
    const documento = f[COL_PEDIDO_DOCUMENTO - 1];
    const nombre = f[COL_PEDIDO_NOMBRE - 1];
    const email = f[COL_PEDIDO_EMAIL - 1];
    const tipoUsuario = f[COL_PEDIDO_TIPOUSUARIO - 1];
    const facultad = f[COL_PEDIDO_FACULTAD - 1];
    const programa = f[COL_PEDIDO_PROGRAMA - 1];
    const titulo = f[COL_PEDIDO_TITULO - 1];
    const autor = f[COL_PEDIDO_AUTOR - 1];
    const categoria = f[COL_PEDIDO_CATEGORIA - 1];

    solicitudesUnicas.add(id);
    totalValor += subtotal;

    const clavePersona = (documento || email || nombre || '').toString();
    if (!porPersona[clavePersona]) {
      porPersona[clavePersona] = {
        nombre: nombre, documento: documento, email: email, tipoUsuario: tipoUsuario,
        facultad: facultad, programa: programa, solicitudes: new Set(), copias: 0, total: 0
      };
    }
    porPersona[clavePersona].solicitudes.add(id);
    porPersona[clavePersona].copias += cantidad;
    porPersona[clavePersona].total += subtotal;

    const claveProg = (facultad || '') + ' · ' + (programa || '');
    if (!porPrograma[claveProg]) {
      porPrograma[claveProg] = { facultad: facultad, programa: programa, solicitudes: new Set(), copias: 0, total: 0 };
    }
    porPrograma[claveProg].solicitudes.add(id);
    porPrograma[claveProg].copias += cantidad;
    porPrograma[claveProg].total += subtotal;

    const claveLibro = (titulo || '') + '|' + (autor || '');
    if (!porLibro[claveLibro]) {
      porLibro[claveLibro] = { titulo: titulo, autor: autor, veces: 0, copias: 0, total: 0 };
    }
    porLibro[claveLibro].veces += 1;
    porLibro[claveLibro].copias += cantidad;
    porLibro[claveLibro].total += subtotal;

    const claveCategoria = (categoria || 'Sin categoría').toString();
    if (!porCategoria[claveCategoria]) {
      porCategoria[claveCategoria] = { categoria: claveCategoria, solicitudes: new Set(), copias: 0, total: 0 };
    }
    porCategoria[claveCategoria].solicitudes.add(id);
    porCategoria[claveCategoria].copias += cantidad;
    porCategoria[claveCategoria].total += subtotal;

    return [
      f[COL_PEDIDO_FECHA - 1], f[COL_PEDIDO_SEDE - 1], nombre, documento, email, tipoUsuario,
      facultad, programa, f[COL_PEDIDO_ASIGNATURA - 1], titulo, autor, categoria, f[COL_PEDIDO_ISBN - 1],
      f[COL_PEDIDO_PROVEEDOR - 1], precio, cantidad, subtotal, id, f[COL_PEDIDO_ESTADO - 1] || 'Pendiente'
    ];
  });

  return {
    totalSolicitudes: solicitudesUnicas.size,
    totalLibros: detalle.length ? filas.reduce(function (s, f) {
      return s + Math.max(1, Math.round(Number(f[COL_PEDIDO_CANTIDAD - 1])) || 1);
    }, 0) : 0,
    totalValor: totalValor,
    detalle: detalle,
    porPersona: Object.keys(porPersona).map(function (k) {
      const p = porPersona[k];
      return [p.nombre, p.documento, p.email, p.tipoUsuario, p.facultad, p.programa, p.solicitudes.size, p.copias, p.total];
    }).sort(function (a, b) { return b[7] - a[7]; }), // más copias primero
    porPrograma: Object.keys(porPrograma).map(function (k) {
      const p = porPrograma[k];
      return [p.facultad, p.programa, p.solicitudes.size, p.copias, p.total];
    }).sort(function (a, b) { return b[3] - a[3]; }),
    porLibro: Object.keys(porLibro).map(function (k) {
      const l = porLibro[k];
      return [l.titulo, l.autor, l.veces, l.copias, l.total];
    }).sort(function (a, b) { return b[3] - a[3]; }), // más copias primero
    porCategoria: Object.keys(porCategoria).map(function (k) {
      const c = porCategoria[k];
      return [c.categoria, c.solicitudes.size, c.copias, c.total];
    }).sort(function (a, b) { return b[2] - a[2]; }) // más copias primero
  };
}

// Lee las filas de datos de "LibrosDeseados" tal cual están en la hoja (con
// el objeto Date real de la columna Fecha), para escribirlas en el Excel.
function leerFilasDeseos_() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_HOJA_DESEOS);
  if (!hoja || hoja.getLastRow() < 2) return [];
  return hoja.getDataRange().getValues().slice(1)
    .filter(function (f) { return f[COL_DESEO_ID - 1]; })
    .map(function (f) {
      return [
        f[COL_DESEO_FECHA - 1], f[COL_DESEO_SEDE - 1], f[COL_DESEO_NOMBRE - 1], f[COL_DESEO_DOCUMENTO - 1],
        f[COL_DESEO_EMAIL - 1], f[COL_DESEO_TIPOUSUARIO - 1], f[COL_DESEO_FACULTAD - 1], f[COL_DESEO_PROGRAMA - 1],
        f[COL_DESEO_ASIGNATURA - 1], f[COL_DESEO_TITULO - 1], f[COL_DESEO_AUTOR - 1], f[COL_DESEO_ISBN - 1],
        f[COL_DESEO_PROVEEDOR - 1], f[COL_DESEO_COMENTARIO - 1], f[COL_DESEO_CANTIDAD - 1] || 1,
        f[COL_DESEO_ID - 1], f[COL_DESEO_ESTADO - 1] || 'Pendiente'
      ];
    });
}

// Escribe una tabla (encabezados + filas) en una hoja, con el encabezado en negrita.
function escribirTablaEnHoja_(hoja, encabezados, filas) {
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]).setFontWeight('bold').setBackground('#7fb536').setFontColor('#FFFFFF');
  if (filas.length > 0) {
    hoja.getRange(2, 1, filas.length, encabezados.length).setValues(filas);
  }
  hoja.setFrozenRows(1);
  try { hoja.autoResizeColumns(1, encabezados.length); } catch (err) { /* no crítico si falla */ }
}

// Genera el archivo .xlsx completo y lo devuelve como base64 para que el
// navegador lo descargue. Se arma en una hoja de cálculo temporal (creada
// solo para exportarla) que se borra de Drive apenas se obtienen los bytes.
function exportarResumenPedidosExcel() {
  const datos = generarResumenExportable_();
  const marcaTiempo = Utilities.formatDate(new Date(), "GMT-5", "yyyyMMdd_HHmmss");

  const ssTemp = SpreadsheetApp.create('Resumen de solicitudes - ' + marcaTiempo);
  try {
    const hojaResumen = ssTemp.getSheets()[0];
    hojaResumen.setName('Resumen General');
    escribirTablaEnHoja_(hojaResumen, ['Indicador', 'Valor'], [
      ['Total de solicitudes', datos.totalSolicitudes],
      ['Total de libros solicitados', datos.totalLibros],
      ['Valor total estimado', datos.totalValor],
      ['Generado el', Utilities.formatDate(new Date(), 'GMT-5', 'dd/MM/yyyy HH:mm')]
    ]);

    escribirTablaEnHoja_(
      ssTemp.insertSheet('Por Persona'),
      ['Nombre', 'Documento', 'Email', 'Tipo de Usuario', 'Facultad', 'Programa', 'Solicitudes', 'Copias', 'Valor Total'],
      datos.porPersona
    );

    escribirTablaEnHoja_(
      ssTemp.insertSheet('Por Programa'),
      ['Facultad', 'Programa', 'Solicitudes', 'Copias', 'Valor Total'],
      datos.porPrograma
    );

    escribirTablaEnHoja_(
      ssTemp.insertSheet('Por Libro'),
      ['Título', 'Autor', 'Veces Solicitado', 'Copias Solicitadas', 'Valor Total'],
      datos.porLibro
    );

    escribirTablaEnHoja_(
      ssTemp.insertSheet('Por Categoría'),
      ['Categoría / Tema', 'Solicitudes', 'Copias', 'Valor Total'],
      datos.porCategoria
    );

    escribirTablaEnHoja_(
      ssTemp.insertSheet('Detalle Completo'),
      ['Fecha', 'Sede', 'Nombre', 'Documento', 'Email', 'Tipo Usuario', 'Facultad', 'Programa', 'Asignatura',
        'Título', 'Autor', 'Categoría', 'ISBN', 'Proveedor', 'Precio Unit.', 'Cantidad', 'Subtotal', 'ID Solicitud', 'Estado'],
      datos.detalle
    );

    escribirTablaEnHoja_(
      ssTemp.insertSheet('Libros Deseados'),
      ['Fecha', 'Sede', 'Nombre', 'Documento', 'Email', 'Tipo Usuario', 'Facultad', 'Programa', 'Asignatura',
        'Título Deseado', 'Autor', 'ISBN', 'Proveedor', 'Comentario', 'Cantidad', 'ID', 'Estado'],
      leerFilasDeseos_()
    );

    SpreadsheetApp.flush();

    const url = 'https://docs.google.com/spreadsheets/d/' + ssTemp.getId() + '/export?format=xlsx';
    const respuesta = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
    });
    const blob = respuesta.getBlob().setName('Resumen_Solicitudes_' + marcaTiempo + '.xlsx');

    return {
      nombreArchivo: blob.getName(),
      base64: Utilities.base64Encode(blob.getBytes()),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  } finally {
    // Borramos siempre la hoja temporal, incluso si algo falló arriba.
    DriveApp.getFileById(ssTemp.getId()).setTrashed(true);
  }
}

// ────────────────────────────────────────────────────────────────────────
// URLS DEL SISTEMA
// Ejecuta obtenerUrlsSistema() desde el editor (Ejecutar > obtenerUrlsSistema)
// y revisa el resultado en "Registro de ejecución" para tener siempre a la
// mano los enlaces del sistema (evita tener que ir a buscarlos en Implementar
// > Administrar las implementaciones cada vez).
// ────────────────────────────────────────────────────────────────────────

// URL de la única implementación activa de la app web (las demás se
// archivaron el 24 de agosto de 2026 por no tener uso real).
// ScriptApp.getService().getUrl() solo funciona dentro de una solicitud web
// real (devuelve null si se ejecuta manualmente desde el editor), así que
// se deja fija aquí. Si se crea o se borra una implementación, actualiza
// este valor a mano desde Implementar > Administrar las implementaciones.
const URLS_APP_WEB = [
  "https://script.google.com/macros/s/REEMPLAZAR_CON_DEPLOYMENT_ID/exec"
];

function obtenerUrlsSistema() {
  const panelBiblioteca = URLS_APP_WEB.map(function (u) { return u + "?panel=biblioteca"; });

  const urls = {
    appWeb: URLS_APP_WEB,
    panelBiblioteca: panelBiblioteca,
    hojaDeCalculo: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    editorDeAppsScript: "https://script.google.com/home/projects/" + ScriptApp.getScriptId() + "/edit"
  };

  Logger.log(
    "── URLs del sistema · Mesas Curriculares ──\n" +
    "App web (usuarios):\n  " + urls.appWeb.join("\n  ") + "\n" +
    "Panel de Biblioteca (personal, requiere clave " + CLAVE_BIBLIOTECA + "):\n  " + urls.panelBiblioteca.join("\n  ") + "\n" +
    "Hoja de cálculo (Pedidos/Catálogo/LibrosDeseados):\n  " + urls.hojaDeCalculo + "\n" +
    "Editor de Apps Script (código):\n  " + urls.editorDeAppsScript
  );

  return urls;
}

// ────────────────────────────────────────────────────────────────────────
// FUNCIÓN DE PRUEBA
// Ejecuta esta función (no registrarPedido) desde el editor si quieres
// probar el flujo completo sin usar el formulario web.
// ────────────────────────────────────────────────────────────────────────
function probarRegistrarPedido() {
  const datosDePrueba = {
    sede: "Sede Demo",
    nombre: "Ana Pérez",
    documento: "1234567890",
    email: "usuario.demo@example.org",
    tipoUsuario: "Docente",
    facultad: "Ciencias de la Salud",
    programa: "Enfermería",
    asignatura: "Fundamentos de Enfermería",
    libros: [
      {
        titulo: "Fundamentos de Enfermería",
        autor: "María Rodríguez",
        isbn: "9789587051234",
        proveedor: "Editorial Médica",
        precio: 85000,
        cantidad: 3
      }
    ]
  };

  const resultado = registrarPedido(datosDePrueba);
  Logger.log(resultado);
}

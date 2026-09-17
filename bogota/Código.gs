// ════════════════════════════════════════════════════════════════════════
// SELECCIONES CON SENTIDO · SISTEMA BOGOTÁ
// ════════════════════════════════════════════════════════════════════════
// Este archivo es el backend del sistema de Bogotá. Es un proyecto de Apps
// Script SEPARADO del de Valledupar (otra hoja de cálculo, otra
// implementación, otras Script Properties): conserva la misma estructura y
// metodología, y agrega dos capacidades propias de esta sede:
//
//   1. Página puente para códigos QR (ver doGet + Abrir.html), pensada para
//      cuando el QR se escanea desde el navegador interno de otra app.
//   2. Plantilla descargable (CSV/Excel) + cargue masivo, como plan B para
//      seguir atendiendo si se cae el internet durante una jornada.
//
// Diferencias de esquema respecto a Valledupar (documentadas, no silenciosas):
//   · La hoja "Pedidos" tiene una columna adicional "Origen" (19), que
//     distingue lo registrado por la web de lo cargado masivamente.
//   · El export a Excel incluye una hoja "Por Proveedor", porque en Bogotá
//     se trabaja con 16 a 20 proveedores y el consolidado por proveedor
//     deja de ser opcional.
// ────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN GENERAL
// ────────────────────────────────────────────────────────────────────────

const CIUDAD = "Bogotá";
const TAMANO_PAGINA = 9;
const NOMBRE_HOJA_CATALOGO = "IndiceGlobal";
const NOMBRE_HOJA_PEDIDOS = "Pedidos";

const CORREO_BIBLIOTECA = PropertiesService.getScriptProperties()
  .getProperty('CORREO_BIBLIOTECA') || 'biblioteca@example.org';

// Sedes válidas de la operación de Bogotá. Se mantiene como array (no como
// constante fija) para que sumar o quitar sedes sea editar esta línea.
const SEDES_VALIDAS = ["Bogotá"];
const TIPOS_USUARIO_VALIDOS = ["Docente", "Estudiante", "Administrativo"];
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rango de proveedores esperado en Bogotá (16 a 20). NO se usa para
// bloquear nada: sirve como diagnóstico, para avisarle al personal de
// biblioteca si el catálogo cargado quedó por debajo o por encima de lo
// previsto (típicamente, un proveedor que no se consolidó en IndiceGlobal).
const PROVEEDORES_ESPERADOS_MIN = 16;
const PROVEEDORES_ESPERADOS_MAX = 20;

// Mínimo de títulos que debe tener una temática para aparecer en el filtro.
// Los catálogos consolidados de varios proveedores traen miles de temáticas
// distintas (muchas usadas una sola vez), y una lista desplegable con miles de
// opciones es inservible. El filtro muestra las temáticas con peso real y el
// resto se sigue encontrando por el buscador de texto, que también busca
// dentro de categoría y programa. Poner 1 muestra todas.
const TEMATICA_MIN_TITULOS = 10;

// Clave compartida para entrar al Panel de Biblioteca (Biblioteca.html).
// No es autenticación real (cualquiera con la URL exacta y la clave puede
// entrar), solo evita que un usuario normal llegue ahí por error.
const CLAVE_BIBLIOTECA = PropertiesService.getScriptProperties()
  .getProperty('CLAVE_BIBLIOTECA') || 'CAMBIAR_EN_SCRIPT_PROPERTIES';

// Columnas de la hoja "Pedidos" (1-indexadas).
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
const COL_PEDIDO_ORIGEN = 19; // "Web" | "Cargue masivo" (propio de Bogotá)
const TOTAL_COLUMNAS_PEDIDOS = 19;

const ORIGEN_WEB = "Web";
const ORIGEN_CARGUE = "Cargue masivo";

// Columnas de la hoja "LibrosDeseados" (1-indexadas). Guarda solicitudes de
// libros que NO están en ninguno de los catálogos de los proveedores (se
// crea automáticamente la primera vez que alguien usa el botón "¿No lo
// encuentras? ¡Pídelo aquí!"). ISBN y Proveedor son opcionales.
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
// Vistas disponibles:
//   ?panel=biblioteca → Biblioteca.html (panel interno, pide clave)
//   ?qr=1             → Abrir.html      (página puente de los códigos QR)
//   (sin parámetros)  → Index.html      (buscador público)
//
// IMPORTANTE: el objeto "e" de doGet NO incluye los encabezados HTTP de la
// petición, así que aquí NO se puede saber desde qué navegador o app se
// abrió el enlace. Por eso la detección de navegador in-app se hace en el
// cliente, dentro de Abrir.html.
function doGet(e) {
  const parametros = (e && e.parameter) ? e.parameter : {};
  const vista = (parametros.panel || '').toString();
  const logoDataUri = obtenerLogoDataUri_();

  if (vista === 'biblioteca') {
    const plantilla = HtmlService.createTemplateFromFile('Biblioteca');
    plantilla.logoDataUri = logoDataUri;
    return plantilla.evaluate()
      .setTitle('Panel de Biblioteca · Selecciones con Sentido ' + CIUDAD)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  if (parametros.qr) {
    const plantillaQr = HtmlService.createTemplateFromFile('Abrir');
    plantillaQr.logoDataUri = logoDataUri;
    plantillaQr.urlApp = obtenerUrlAppWeb_();
    return plantillaQr.evaluate()
      .setTitle('Abrir Selecciones con Sentido · ' + CIUDAD)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  const plantilla = HtmlService.createTemplateFromFile('Index');
  plantilla.logoDataUri = logoDataUri;
  return plantilla.evaluate()
    .setTitle('Selecciones con Sentido · ' + CIUDAD)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// URL pública de esta implementación. Dentro de una petición web real,
// ScriptApp.getService().getUrl() la devuelve sola; si por alguna razón
// llega vacía, se cae a la Script Property URL_APP_WEB. Nunca se escribe
// una URL real dentro del repositorio.
function obtenerUrlAppWeb_() {
  let url = '';
  try {
    url = ScriptApp.getService().getUrl() || '';
  } catch (err) {
    url = '';
  }
  if (!url) {
    url = PropertiesService.getScriptProperties().getProperty('URL_APP_WEB') || '';
  }
  return url;
}

// Descarga el logo institucional desde Drive y lo devuelve como data URI
// (el iframe sandbox de Apps Script bloquea imágenes externas por cookies
// de terceros, así que se incrusta directo en el HTML). Se guarda en caché
// por 6 horas para no volver a leerlo de Drive en cada carga de página.
function obtenerLogoDataUri_() {
  const id = PropertiesService.getScriptProperties().getProperty('ID_LOGO');
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
// En Bogotá el catálogo consolida entre 16 y 20 proveedores, así que la
// hoja es notablemente más grande que la de una operación de un solo
// proveedor. Leer todas las filas en CADA solicitud (cada carga de página
// hace dos lecturas: getFacetsData() + buscarLibros(); cada filtro o cambio
// de página, una más) es justamente lo que puede colapsar el sistema bajo
// carga. Por eso el catálogo ya parseado se guarda comprimido en
// CacheService.getScriptCache() (compartido entre TODAS las personas que
// usan la app, no por usuario) y se reutiliza durante CATALOGO_CACHE_TTL
// segundos. Si algo falla al leer o guardar la caché, se sigue leyendo la
// hoja directamente sin romper la búsqueda.
// ────────────────────────────────────────────────────────────────────────
const CATALOGO_CACHE_PREFIJO = 'catalogo_bog_v2_';
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

// Campos del catálogo y los encabezados que los identifican, en orden de
// preferencia. El catálogo se mapea por NOMBRE de encabezado, no por posición:
// así el mismo código sirve para archivos con las columnas en distinto orden,
// y reordenar una columna deja de cambiar los datos en silencio.
//
// Sobre "categoria" y "programa": son las dos columnas temáticas, de lo más
// general a lo más específico. En un archivo con columnas ÁREA y CATEGORIA,
// ÁREA es la general (→ categoria) y CATEGORIA la específica (→ programa);
// en uno con Categoria y Programa, cada una va a la suya. Por eso "categoria"
// prefiere ÁREA y "programa" se queda con CATEGORIA si sobró.
const CAMPOS_CATALOGO = [
  { campo: 'proveedor',     alias: ['proveedor', 'distribuidor'] },
  { campo: 'sede',          alias: ['sede'] },
  { campo: 'titulo',        alias: ['titulo', 'nombredellibro'] },
  { campo: 'autor',         alias: ['autor', 'autores'] },
  { campo: 'editorial',     alias: ['editorial', 'sello'] },
  { campo: 'precio',        alias: ['precio', 'preciounitario', 'valor', 'preciopublico'] },
  { campo: 'isbn',          alias: ['isbn', 'isbn13'] },
  { campo: 'anio',          alias: ['ano', 'anio', 'anodeedicion', 'anopublicacion', 'edicion'] },
  { campo: 'stock',         alias: ['stock', 'existencias', 'cantidad', 'disponibles'] },
  { campo: 'observaciones', alias: ['observaciones', 'notas', 'comentarios'] },
  { campo: 'hojaOrigen',    alias: ['hojaorigen', 'origen', 'fuente'] },
  { campo: 'categoria',     alias: ['area', 'categoria', 'tematica', 'tema'] },
  { campo: 'programa',      alias: ['programa', 'subcategoria', 'subarea', 'categoria', 'especialidad'] }
];

// Campos sin los cuales el catálogo no sirve para nada.
const CAMPOS_CATALOGO_OBLIGATORIOS = ['titulo', 'proveedor'];

// Relaciona cada campo con la columna real del archivo. Una misma columna no
// puede quedar asignada a dos campos: el primero que la reclama se la queda,
// y el siguiente pasa a su alias alternativo.
function mapearColumnasCatalogo_(encabezados) {
  const normalizados = encabezados.map(normalizarTextoCargue_);
  const tomadas = {};
  const indices = {};

  CAMPOS_CATALOGO.forEach(function (definicion) {
    indices[definicion.campo] = -1;
    for (let i = 0; i < definicion.alias.length; i++) {
      const posicion = normalizados.indexOf(definicion.alias[i]);
      if (posicion !== -1 && !tomadas[posicion]) {
        indices[definicion.campo] = posicion;
        tomadas[posicion] = definicion.campo;
        break;
      }
    }
  });

  const faltantes = CAMPOS_CATALOGO_OBLIGATORIOS.filter(function (campo) {
    return indices[campo] === -1;
  });

  return { indices: indices, faltantes: faltantes };
}

// Limpia un valor del catálogo: espacios sobrantes al inicio y al final, que
// en los archivos consolidados a mano son frecuentes y hacen que 'EDUCACIÓN '
// y 'EDUCACIÓN' se cuenten como dos temáticas distintas en los filtros.
function limpiarValorCatalogo_(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor;
  if (typeof valor === 'number') return valor;
  return String(valor).trim();
}

// El ISBN suele venir como número cuando el archivo se armó en Excel. Se pasa
// a texto para poder buscarlo tal como la persona lo escribe.
function limpiarIsbnCatalogo_(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') {
    // Los ISBN son enteros de 13 dígitos o menos, así que String() los imprime
    // completos, sin notación científica.
    return String(Math.round(valor));
  }
  return String(valor).trim();
}

function leerCatalogoDesdeHoja_() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_HOJA_CATALOGO);

  if (!hoja) {
    throw new Error("No se encontró la pestaña '" + NOMBRE_HOJA_CATALOGO + "'. Verifica el nombre exacto en tu Sheet.");
  }

  const valores = hoja.getDataRange().getValues();
  if (valores.length < 2) return [];

  const mapeo = mapearColumnasCatalogo_(valores[0]);
  if (mapeo.faltantes.length) {
    throw new Error(
      "A la pestaña '" + NOMBRE_HOJA_CATALOGO + "' le faltan columnas obligatorias: " +
      mapeo.faltantes.join(', ') + ". Revisa la fila de encabezados y vuelve a intentar " +
      "(ejecuta configurarSistema() para ver el detalle)."
    );
  }

  const indices = mapeo.indices;
  const leer = function (fila, campo) {
    const posicion = indices[campo];
    if (posicion === -1 || posicion >= fila.length) return '';
    return limpiarValorCatalogo_(fila[posicion]);
  };

  return valores.slice(1) // saltamos la fila de encabezados
    .map(function (fila) {
      return {
        proveedor: leer(fila, 'proveedor'),
        // Si el archivo no trae columna de sede, se asume la ciudad de esta
        // instalación: el filtro de sede simplemente deja de aportar.
        sede: leer(fila, 'sede') || CIUDAD,
        titulo: leer(fila, 'titulo'),
        autor: leer(fila, 'autor'),
        editorial: leer(fila, 'editorial'),
        categoria: leer(fila, 'categoria'),
        programa: leer(fila, 'programa'),
        precio: leer(fila, 'precio'),
        isbn: limpiarIsbnCatalogo_(indices.isbn === -1 ? '' : fila[indices.isbn]),
        anio: leer(fila, 'anio'),
        stock: leer(fila, 'stock'),
        observaciones: leer(fila, 'observaciones'),
        hojaOrigen: leer(fila, 'hojaOrigen')
      };
    })
    .filter(function (libro) { return libro.titulo; }); // descarta filas vacías
}

// Comprime el catálogo (gzip + base64) y lo parte en varios trozos de
// CATALOGO_CACHE_TAM_CHUNK caracteres, porque CacheService no acepta un
// valor de más de 100KB por clave. Si algo sale mal, simplemente no se
// guarda nada: la próxima solicitud volverá a leer la hoja.
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
// null si no hay nada cacheado, si algún trozo ya expiró, o si algo no se
// puede leer/descomprimir — en cualquiera de esos casos, leerCatalogo_()
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
// catálogo "IndiceGlobal" directamente en la hoja (por ejemplo, al sumar
// el catálogo de un proveedor nuevo), ejecutar esta función una vez desde
// el editor de Apps Script para que la app muestre los cambios de
// inmediato, en vez de esperar hasta 30 minutos a que la caché expire.
function refrescarCacheCatalogo() {
  const cache = CacheService.getScriptCache();
  const libros = leerCatalogoDesdeHoja_();
  guardarCatalogoEnCache_(cache, libros);
  Logger.log('Caché del catálogo actualizada: ' + libros.length + ' títulos.');
}

// Diagnóstico de proveedores. Bogotá opera con 16 a 20 proveedores; esta
// función lista los que realmente quedaron cargados en IndiceGlobal, con
// cuántos títulos aporta cada uno, y avisa si el total quedó fuera de ese
// rango. No bloquea nada: solo informa.
function verificarProveedores() {
  const libros = leerCatalogo_();
  const conteo = {};
  libros.forEach(function (l) {
    const nombre = (l.proveedor || '(sin proveedor)').toString().trim() || '(sin proveedor)';
    conteo[nombre] = (conteo[nombre] || 0) + 1;
  });

  const detalle = Object.keys(conteo)
    .map(function (nombre) { return { proveedor: nombre, titulos: conteo[nombre] }; })
    .sort(function (a, b) { return b.titulos - a.titulos; });

  const total = detalle.length;
  let aviso = '';
  if (total < PROVEEDORES_ESPERADOS_MIN) {
    aviso = 'Hay ' + total + ' proveedores en el catálogo y se esperaban al menos ' +
      PROVEEDORES_ESPERADOS_MIN + '. Revisa si falta consolidar alguno en IndiceGlobal.';
  } else if (total > PROVEEDORES_ESPERADOS_MAX) {
    aviso = 'Hay ' + total + ' proveedores en el catálogo y se esperaban máximo ' +
      PROVEEDORES_ESPERADOS_MAX + '. Revisa si algún proveedor quedó escrito de dos formas distintas.';
  }

  const resultado = {
    total: total,
    esperadoMin: PROVEEDORES_ESPERADOS_MIN,
    esperadoMax: PROVEEDORES_ESPERADOS_MAX,
    dentroDelRango: total >= PROVEEDORES_ESPERADOS_MIN && total <= PROVEEDORES_ESPERADOS_MAX,
    aviso: aviso,
    detalle: detalle
  };

  Logger.log('Proveedores en catálogo: ' + total + (aviso ? ' — ' + aviso : ' — dentro del rango esperado.'));
  detalle.forEach(function (d) { Logger.log('  · ' + d.proveedor + ': ' + d.titulos + ' títulos'); });
  return resultado;
}

// Llena los filtros: sede, proveedor y "Temática" (el catálogo tiene dos
// columnas relacionadas al tema del libro, Categoria y Programa; el filtro
// de Temática recoge ambas, unidas en una sola lista).
//
// Respecto a Valledupar se agregan dos campos: "proveedoresConConteo" y
// "avisoProveedores". Con 16 a 20 proveedores, la lista del filtro es larga
// y saber cuántos títulos aporta cada uno ayuda a elegir. Los campos
// originales (sedes, proveedores, categorias, totalTitulos) se conservan
// igual, para no romper ninguna vista que ya los use.
function getFacetsData() {
  const libros = leerCatalogo_();

  const sedes = Array.from(new Set(libros.map(function (l) { return l.sede; }).filter(Boolean))).sort();

  const conteoProveedores = {};
  libros.forEach(function (l) {
    if (!l.proveedor) return;
    const nombre = l.proveedor.toString().trim();
    if (!nombre) return;
    conteoProveedores[nombre] = (conteoProveedores[nombre] || 0) + 1;
  });
  const proveedores = Object.keys(conteoProveedores).sort();

  // Unimos Categoria + Programa: ambas columnas describen el tema del libro
  // (ej. Categoria="Educación", Programa="Neuroeducación"), así que la
  // Temática debe mostrar y filtrar por cualquiera de las dos.
  //
  // Se cuenta cuántos títulos tiene cada temática y se dejan fuera del filtro
  // las que no llegan a TEMATICA_MIN_TITULOS. En un catálogo consolidado eso
  // es la diferencia entre una lista usable y uno de varios miles de opciones
  // donde no se encuentra nada. Lo excluido sigue siendo accesible desde el
  // buscador de texto.
  const conteoCategorias = {};
  libros.forEach(function (l) {
    const vistas = {};
    [l.categoria, l.programa].forEach(function (valor) {
      const nombre = (valor || '').toString().trim();
      if (!nombre || vistas[nombre]) return; // sin contar dos veces la misma fila
      vistas[nombre] = true;
      conteoCategorias[nombre] = (conteoCategorias[nombre] || 0) + 1;
    });
  });

  const todasLasCategorias = Object.keys(conteoCategorias);
  const categoriasFiltradas = todasLasCategorias
    .filter(function (nombre) { return conteoCategorias[nombre] >= TEMATICA_MIN_TITULOS; })
    .sort();

  let avisoProveedores = '';
  if (proveedores.length && proveedores.length < PROVEEDORES_ESPERADOS_MIN) {
    avisoProveedores = 'El catálogo tiene ' + proveedores.length + ' proveedores (se esperan entre ' +
      PROVEEDORES_ESPERADOS_MIN + ' y ' + PROVEEDORES_ESPERADOS_MAX + ').';
  } else if (proveedores.length > PROVEEDORES_ESPERADOS_MAX) {
    avisoProveedores = 'El catálogo tiene ' + proveedores.length + ' proveedores (se esperan entre ' +
      PROVEEDORES_ESPERADOS_MIN + ' y ' + PROVEEDORES_ESPERADOS_MAX + ').';
  }

  return {
    sedes: sedes,
    proveedores: proveedores,
    proveedoresConConteo: proveedores.map(function (nombre) {
      return { proveedor: nombre, titulos: conteoProveedores[nombre] };
    }),
    categorias: categoriasFiltradas,
    categoriasConConteo: categoriasFiltradas.map(function (nombre) {
      return { categoria: nombre, titulos: conteoCategorias[nombre] };
    }),
    // El cliente necesita saber que la lista está recortada, para decirlo en
    // pantalla en vez de dar a entender que esas son todas las temáticas.
    totalCategorias: todasLasCategorias.length,
    categoriasTruncadas: categoriasFiltradas.length < todasLasCategorias.length,
    tematicaMinTitulos: TEMATICA_MIN_TITULOS,
    totalTitulos: libros.length,
    totalProveedores: proveedores.length,
    avisoProveedores: avisoProveedores
  };
}

// Entrega al formulario público (Index.html) las listas de valores que el
// backend acepta, para que el HTML no tenga que repetirlas por su cuenta y
// quedar desincronizado si alguien agrega una sede o un tipo de usuario.
//
// OJO con la palabra "sede", que aquí significa dos cosas distintas:
//   · SEDES_VALIDAS  → las sedes de la operación. Es lo que se guarda en la
//                      solicitud y lo que validan registrarPedido/registrarDeseo.
//   · facetas.sedes  → los valores de la columna "Sede" del catálogo, que se
//                      usan solo para FILTRAR títulos. Pueden no coincidir.
// Por eso el formulario toma sus opciones de aquí y no de getFacetsData().
function obtenerOpcionesFormulario() {
  return {
    ciudad: CIUDAD,
    sedes: SEDES_VALIDAS.slice(),
    tiposUsuario: TIPOS_USUARIO_VALIDOS.slice(),
    tamanoPagina: TAMANO_PAGINA
  };
}

// Pasa un texto a minúsculas y le quita las tildes, para poder comparar
// "PSICOLOGÍA" con lo que alguien escribe como "psicologia".
//
// Por qué un reemplazo carácter por carácter y no String.normalize('NFD'):
// esta función se ejecuta sobre cada campo de cada título en CADA búsqueda
// (decenas de miles de llamadas por consulta), y el reemplazo directo es
// varias veces más rápido. Cubre las vocales acentuadas y la ñ, que es lo que
// aparece en un catálogo en español.
//
// La alternativa sería guardar el texto ya normalizado dentro de la caché del
// catálogo: las búsquedas quedarían casi instantáneas, pero la caché pasaría a
// ocupar el doble (de ~12 a ~24 trozos). Si la caché no cabe, se descarta en
// silencio y cada búsqueda vuelve a leer la hoja completa, que es un problema
// mucho peor que unos milisegundos de más. Por eso se normaliza al vuelo.
function sinTildes_(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).trim().toLowerCase()
    // Algunas filas traen la tilde como carácter combinante aparte (la "ó" es
    // entonces "o" + U+0301 en vez de un único carácter). Se ven idénticas en
    // pantalla, pero no coinciden con el reemplazo de abajo. Son pocas, y esta
    // línea las cubre.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[áàäâã]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöôõ]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/ç/g, 'c');
}

// Búsqueda + filtros + paginación
function buscarLibros(opts) {
  opts = opts || {};
  // La consulta se normaliza una sola vez; los campos del catálogo, en el
  // momento de compararlos. Así "psicologia" encuentra "PSICOLOGÍA", que en un
  // catálogo escrito en mayúsculas con tildes es la diferencia entre encontrar
  // 36 títulos o encontrar 827.
  const query = sinTildes_(opts.query || "");
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
      // El ISBN no lleva tildes: se compara directo y se evita normalizarlo.
      return (l.titulo && sinTildes_(l.titulo).indexOf(query) !== -1) ||
             (l.autor && sinTildes_(l.autor).indexOf(query) !== -1) ||
             (l.categoria && sinTildes_(l.categoria).indexOf(query) !== -1) ||
             (l.programa && sinTildes_(l.programa).indexOf(query) !== -1) ||
             (l.editorial && sinTildes_(l.editorial).indexOf(query) !== -1) ||
             (l.isbn && l.isbn.toString().toLowerCase().indexOf(query) !== -1);
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
    return construirFilaPedido_({
      fecha: fecha, sede: sede, nombre: nombre, documento: documento, email: email,
      tipoUsuario: tipoUsuario, facultad: facultad, programa: programa, asignatura: asignatura,
      titulo: libroItem.titulo,
      autor: libroItem.autor || '',
      categoria: libroItem.programa || libroItem.categoria || '',
      isbn: libroItem.isbn || '',
      proveedor: libroItem.proveedor || '',
      precio: Number(libroItem.precio) || 0,
      cantidad: Number(libroItem.cantidad) || 1,
      idSolicitud: idSolicitud,
      estado: 'Pendiente',
      origen: ORIGEN_WEB
    });
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

// Arma una fila de la hoja "Pedidos" respetando el orden de columnas
// declarado arriba. Lo usan tanto registrarPedido() como el cargue masivo,
// para que exista un único lugar donde se decide el orden de las columnas.
function construirFilaPedido_(d) {
  const fila = new Array(TOTAL_COLUMNAS_PEDIDOS).fill('');
  fila[COL_PEDIDO_FECHA - 1] = d.fecha;
  fila[COL_PEDIDO_SEDE - 1] = d.sede;
  fila[COL_PEDIDO_NOMBRE - 1] = d.nombre;
  fila[COL_PEDIDO_DOCUMENTO - 1] = d.documento;
  fila[COL_PEDIDO_EMAIL - 1] = d.email;
  fila[COL_PEDIDO_TIPOUSUARIO - 1] = d.tipoUsuario;
  fila[COL_PEDIDO_FACULTAD - 1] = d.facultad;
  fila[COL_PEDIDO_PROGRAMA - 1] = d.programa;
  fila[COL_PEDIDO_ASIGNATURA - 1] = d.asignatura;
  fila[COL_PEDIDO_TITULO - 1] = d.titulo;
  fila[COL_PEDIDO_AUTOR - 1] = d.autor;
  fila[COL_PEDIDO_CATEGORIA - 1] = d.categoria;
  fila[COL_PEDIDO_ISBN - 1] = d.isbn;
  fila[COL_PEDIDO_PROVEEDOR - 1] = d.proveedor;
  fila[COL_PEDIDO_PRECIO - 1] = d.precio;
  fila[COL_PEDIDO_CANTIDAD - 1] = d.cantidad;
  fila[COL_PEDIDO_ID - 1] = d.idSolicitud;
  fila[COL_PEDIDO_ESTADO - 1] = d.estado || 'Pendiente';
  fila[COL_PEDIDO_ORIGEN - 1] = d.origen || ORIGEN_WEB;
  return fila;
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
// SOL-20260916-141213-A9F2
function generarIdSolicitud_(fecha) {
  const marcaTiempo = Utilities.formatDate(fecha, "GMT-5", "yyyyMMdd-HHmmss");
  const sufijo = Math.random().toString(36).substring(2, 6).toUpperCase();
  return "SOL-" + marcaTiempo + "-" + sufijo;
}

// Encabezados de la hoja "Pedidos". Se declaran una sola vez porque los usan
// inicializarHojaPedidos_() y la plantilla de cargue masivo.
const ENCABEZADOS_PEDIDOS = [
  "Fecha", "Sede", "Nombre", "Documento", "Email", "Tipo de Usuario",
  "Facultad", "Programa", "Asignatura", "Titulo", "Autor", "Categoria", "ISBN", "Proveedor",
  "Precio", "Cantidad", "ID Solicitud", "Estado", "Origen"
];

// Escribe/corrige los encabezados de la hoja "Pedidos" sin tocar los datos.
// Si la hoja está vacía, escribe las columnas completas; si ya tiene datos,
// solo corrige la fila de encabezados si no coincide con el esquema actual.
function inicializarHojaPedidos_(hoja) {
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, TOTAL_COLUMNAS_PEDIDOS).setValues([ENCABEZADOS_PEDIDOS]);
    return;
  }

  const anchoActual = Math.max(hoja.getLastColumn(), TOTAL_COLUMNAS_PEDIDOS);
  const encabezadoActual = hoja.getRange(1, 1, 1, anchoActual).getValues()[0];
  if (encabezadoActual[COL_PEDIDO_ID - 1] !== "ID Solicitud" ||
      encabezadoActual[COL_PEDIDO_ORIGEN - 1] !== "Origen") {
    hoja.getRange(1, 1, 1, TOTAL_COLUMNAS_PEDIDOS).setValues([ENCABEZADOS_PEDIDOS]);
  }
}

// ────────────────────────────────────────────────────────────────────────
// CORREOS
// ────────────────────────────────────────────────────────────────────────

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

// Construye el encabezado y pie de página compartidos por los correos, para
// que se vean como parte del mismo sistema (misma paleta institucional que
// la operación de Valledupar; solo cambia la ciudad en el sobretítulo).
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
             <p style="color: #FFFFFF; font-family: 'Courier New', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 5px;">Selecciones con Sentido · ${sanitizarHtml_(CIUDAD)}</p>
             <h2 style="color: #FFFFFF; margin: 0; font-size: 22px;">${tituloEncabezado}</h2>
            </div>`;
  html += cuerpoInterno;
  html += `<div style="background-color: #E7DFC9; padding: 15px 30px; text-align: center; font-size: 12px; color: ${colorTextoSuave};">
             Este es un mensaje automático generado por Selecciones con Sentido (${sanitizarHtml_(CIUDAD)}). Conserva el ID de solicitud para hacerle seguimiento.
            </div>`;
  html += `</div></div>`;
  return html;
}

// Tabla HTML de libros solicitados, reutilizada por los correos.
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
                  <p style="margin-top: 0;">Se ha registrado una nueva solicitud a través de Selecciones con Sentido (${sanitizarHtml_(CIUDAD)}).</p>
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

// ── CORREO A LA BIBLIOTECA (resumen de un cargue masivo) ──
// El cargue masivo NO envía un correo por solicitud: enviaría decenas de
// mensajes de golpe y además agotaría la cuota diaria de MailApp. Envía un
// único correo con el consolidado de lo que entró.
function enviarCorreoCargueMasivo_(reporte) {
  const colorPrincipal = "#7fb536";
  const colorAcento = "#F59C2F";
  const fechaTexto = Utilities.formatDate(new Date(), "GMT-5", "dd/MM/yyyy HH:mm");

  const listaIds = reporte.insertadas.slice(0, 50).map(function (id) {
    return '<li style="font-family: \'Courier New\', monospace; font-size: 12px;">' + sanitizarHtml_(id) + '</li>';
  }).join('');
  const sobrantes = reporte.insertadas.length > 50
    ? '<p style="font-size:12px; color:#606060;">…y ' + (reporte.insertadas.length - 50) + ' solicitudes más.</p>'
    : '';

  let cuerpo = `<div style="padding: 25px 30px;">
                  <p style="margin-top: 0;">Se realizó un <strong>cargue masivo</strong> de solicitudes desde la plantilla de contingencia (plan B por caída de internet).</p>
                  <div style="background-color: #FBF8F2; padding: 15px; border-left: 4px solid ${colorPrincipal}; margin-bottom: 20px;">
                    <strong>Fecha del cargue:</strong> ${fechaTexto}<br>
                    <strong>Archivo:</strong> ${sanitizarHtml_(reporte.nombreArchivo || 'no informado')}<br>
                    <strong>Filas leídas:</strong> ${reporte.filasLeidas}<br>
                    <strong>Solicitudes creadas:</strong> ${reporte.insertadas.length}<br>
                    <strong>Ejemplares registrados:</strong> ${reporte.ejemplaresInsertados}<br>
                    <strong>Valor total estimado:</strong> ${formatearPrecioCorreo_(reporte.valorTotal)}
                  </div>
                  ${reporte.omitidas.length ? `<div style="background-color: #FBF8F2; padding: 15px; border-left: 4px solid ${colorAcento}; margin-bottom: 20px;">
                    <strong>Solicitudes omitidas por estar ya registradas:</strong> ${reporte.omitidas.length}
                  </div>` : ''}
                  <h3 style="font-size: 16px; margin-bottom: 4px;">IDs generados:</h3>
                  <ul>${listaIds}</ul>
                  ${sobrantes}
                 </div>`;

  MailApp.sendEmail({
    to: CORREO_BIBLIOTECA,
    subject: `Cargue masivo de solicitudes - ${CIUDAD} (${reporte.insertadas.length} solicitudes)`,
    htmlBody: envolverCorreoHtml_("Cargue masivo de contingencia", cuerpo)
  });
}

// ────────────────────────────────────────────────────────────────────────
// LIBROS DESEADOS (títulos que NO están en ningún catálogo de proveedores)
// Botón "¿No lo encuentras? ¡Pídelo aquí!" del buscador público. Se guarda
// en una hoja aparte ("LibrosDeseados") para no mezclarlo con los pedidos
// normales del catálogo, y así la biblioteca puede llevar un listado propio
// de qué títulos le están pidiendo comprar a futuro.
//
// NOTA DE ALCANCE: el cargue masivo de contingencia cubre solicitudes de
// catálogo (hoja "Pedidos"), NO libros deseados. Lo trabajado en papel
// durante una caída que corresponda a títulos fuera de catálogo debe
// registrarse a mano en el buscador cuando vuelva el servicio.
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
// (una solicitud = varias filas que comparten el mismo ID). Las filas sin
// ID quedan fuera del agrupamiento, pero permanecen intactas en la hoja.
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
        origen: fila[COL_PEDIDO_ORIGEN - 1] || ORIGEN_WEB,
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
// Genera un .xlsx con varias hojas: resumen general, por persona, por
// programa, por libro, por categoría, POR PROVEEDOR y el detalle completo.
// Se arma en una hoja de cálculo temporal (para poder exportarla como Excel
// real) y se borra apenas se obtienen los bytes del archivo.
//
// La hoja "Por Proveedor" es propia de Bogotá: con 16 a 20 proveedores en
// juego, el consolidado por proveedor es lo que permite saber a quién se le
// pide qué antes de negociar.
// ────────────────────────────────────────────────────────────────────────

// Lee "Pedidos" y agrupa la información en las distintas tablas del reporte.
function generarResumenExportable_() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_HOJA_PEDIDOS);
  if (!hoja || hoja.getLastRow() < 2) {
    throw new Error("No hay solicitudes registradas todavía para exportar.");
  }

  const filas = hoja.getDataRange().getValues().slice(1).filter(function (f) {
    return f[COL_PEDIDO_ID - 1]; // descarta filas sin ID
  });

  const solicitudesUnicas = new Set();
  const porPersona = {};
  const porPrograma = {};
  const porLibro = {};
  const porCategoria = {};
  const porProveedor = {};
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
    const proveedor = (f[COL_PEDIDO_PROVEEDOR - 1] || 'Sin proveedor').toString().trim() || 'Sin proveedor';

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

    if (!porProveedor[proveedor]) {
      porProveedor[proveedor] = { proveedor: proveedor, solicitudes: new Set(), titulos: new Set(), copias: 0, total: 0 };
    }
    porProveedor[proveedor].solicitudes.add(id);
    porProveedor[proveedor].titulos.add((titulo || '') + '|' + (autor || ''));
    porProveedor[proveedor].copias += cantidad;
    porProveedor[proveedor].total += subtotal;

    return [
      f[COL_PEDIDO_FECHA - 1], f[COL_PEDIDO_SEDE - 1], nombre, documento, email, tipoUsuario,
      facultad, programa, f[COL_PEDIDO_ASIGNATURA - 1], titulo, autor, categoria, f[COL_PEDIDO_ISBN - 1],
      f[COL_PEDIDO_PROVEEDOR - 1], precio, cantidad, subtotal, id,
      f[COL_PEDIDO_ESTADO - 1] || 'Pendiente', f[COL_PEDIDO_ORIGEN - 1] || ORIGEN_WEB
    ];
  });

  return {
    totalSolicitudes: solicitudesUnicas.size,
    totalLibros: filas.reduce(function (s, f) {
      return s + Math.max(1, Math.round(Number(f[COL_PEDIDO_CANTIDAD - 1])) || 1);
    }, 0),
    totalValor: totalValor,
    totalProveedores: Object.keys(porProveedor).length,
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
    }).sort(function (a, b) { return b[2] - a[2]; }), // más copias primero
    porProveedor: Object.keys(porProveedor).map(function (k) {
      const p = porProveedor[k];
      return [p.proveedor, p.titulos.size, p.solicitudes.size, p.copias, p.total];
    }).sort(function (a, b) { return b[4] - a[4]; }) // mayor valor primero
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
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados])
    .setFontWeight('bold').setBackground('#7fb536').setFontColor('#FFFFFF');
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

  const ssTemp = SpreadsheetApp.create('Resumen de solicitudes ' + CIUDAD + ' - ' + marcaTiempo);
  try {
    const hojaResumen = ssTemp.getSheets()[0];
    hojaResumen.setName('Resumen General');
    escribirTablaEnHoja_(hojaResumen, ['Indicador', 'Valor'], [
      ['Ciudad', CIUDAD],
      ['Total de solicitudes', datos.totalSolicitudes],
      ['Total de libros solicitados', datos.totalLibros],
      ['Proveedores involucrados', datos.totalProveedores],
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
      ssTemp.insertSheet('Por Proveedor'),
      ['Proveedor', 'Títulos Distintos', 'Solicitudes', 'Copias', 'Valor Total'],
      datos.porProveedor
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
        'Título', 'Autor', 'Categoría', 'ISBN', 'Proveedor', 'Precio Unit.', 'Cantidad', 'Subtotal',
        'ID Solicitud', 'Estado', 'Origen'],
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
    const blob = respuesta.getBlob().setName('Resumen_Solicitudes_' + CIUDAD + '_' + marcaTiempo + '.xlsx');

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

// ════════════════════════════════════════════════════════════════════════
// PLAN B: PLANTILLA DE CONTINGENCIA Y CARGUE MASIVO
// ════════════════════════════════════════════════════════════════════════
// Escenario que resuelve: se cae el internet en plena jornada de Selecciones
// con Sentido. El personal descarga ANTES la plantilla (CSV o Excel), sigue
// atendiendo y registrando en el archivo local, y cuando vuelve el servicio
// sube ese mismo archivo desde el Panel de Biblioteca para incorporar de una
// sola vez todo lo trabajado durante la caída.
//
// Decisiones de diseño, explícitas:
//
//  · El cargue es en DOS PASOS: primero se valida (sin escribir nada) y se
//    muestra un reporte; solo si la persona confirma, se escribe en la hoja.
//  · El ID de cada solicitud se calcula de forma DETERMINÍSTICA a partir del
//    día + documento + email + asignatura + la columna "Grupo Solicitud".
//    Así, si alguien sube el mismo archivo dos veces, los IDs coinciden con
//    los que ya están en la hoja y las filas repetidas se omiten en vez de
//    duplicarse. Es la protección contra el doble cargue.
//  · Cada fila del archivo es un libro. Varias filas con el MISMO valor en
//    "Grupo Solicitud" (y la misma persona, día y asignatura) se agrupan en
//    una sola solicitud, igual que un pedido hecho desde la web.
//  · Lo cargado queda marcado con Origen = "Cargue masivo" en la hoja
//    "Pedidos", para poder distinguirlo después de lo registrado en línea.
//  · Se envía UN correo de resumen, no uno por solicitud (mandar decenas de
//    correos de golpe agotaría la cuota diaria de MailApp).
// ────────────────────────────────────────────────────────────────────────

// Columnas de la plantilla, en orden. "Grupo Solicitud" es la única que no
// existe en la hoja "Pedidos": es un apoyo para agrupar filas.
const PLANTILLA_CARGUE_ENCABEZADOS = [
  "Fecha", "Sede", "Nombre", "Documento", "Email", "Tipo de Usuario",
  "Facultad", "Programa", "Asignatura", "Titulo", "Autor", "Categoria",
  "ISBN", "Proveedor", "Precio", "Cantidad", "Grupo Solicitud"
];

// Límites de precaución del cargue. NO son límites documentados de la
// plataforma: son topes que ponemos nosotros para que un archivo enorme no
// haga fallar la petición a mitad de camino sin explicación. Si se necesita
// cargar más, se parte el archivo en varios.
const CARGUE_MAX_FILAS = 3000;
const CARGUE_MAX_CARACTERES = 2000000;
const CARGUE_MAX_ERRORES_REPORTADOS = 200;

// Fila de ejemplo con datos ficticios, para que quien llene la plantilla vea
// el formato esperado. Se borra antes de cargar (ver esFilaDeEjemplo_).
const PLANTILLA_CARGUE_EJEMPLO = [
  "16/09/2026 10:30", "Bogotá", "EJEMPLO - Ana Pérez", "1234567890",
  "ejemplo@example.org", "Docente", "Ciencias de la Salud", "Enfermería",
  "Fundamentos de Enfermería", "Manual de práctica clínica", "María Rodríguez",
  "Salud", "9789587051234", "Proveedor Demo", "85000", "3", "G1"
];

const PLANTILLA_CARGUE_INSTRUCCIONES = [
  ["Plantilla de contingencia · Selecciones con Sentido · " + CIUDAD],
  [""],
  ["Para qué sirve"],
  ["Si se cae el internet durante la jornada, sigue registrando aquí lo que atiendas."],
  ["Cuando vuelva el servicio, entra al Panel de Biblioteca y sube este mismo archivo"],
  ["en la sección 'Plan B · cargue masivo'. Todo lo diligenciado entrará de una sola vez."],
  [""],
  ["Reglas para llenarla"],
  ["1. Una fila por libro. No borres ni reordenes la fila de encabezados."],
  ["2. Borra la fila de EJEMPLO antes de subir el archivo (o déjala: se ignora sola)."],
  ["3. Fecha: dd/MM/aaaa o dd/MM/aaaa HH:mm. Si la dejas vacía, se usa la fecha del cargue."],
  ["4. Sede: debe ser exactamente una de las sedes válidas (ver la hoja 'Listas válidas')."],
  ["5. Tipo de Usuario: Docente, Estudiante o Administrativo (exactamente así)."],
  ["6. Email: debe ser un correo con formato válido; si no, la fila se rechaza."],
  ["7. Precio: solo el número, sin símbolo de peso. Ej: 85000. Si va vacío se toma 0."],
  ["8. Cantidad: número entero de ejemplares. Si va vacío se toma 1."],
  ["9. Grupo Solicitud: sirve para juntar varios libros en UNA sola solicitud."],
  ["   Escribe el mismo código (G1, G2, A, 1…) en todas las filas de la misma persona"],
  ["   y la misma asignatura. Si lo dejas vacío, cada fila será una solicitud aparte."],
  [""],
  ["Si guardas desde Excel"],
  ["Guarda como 'CSV UTF-8 (delimitado por comas)'. Si guardas como CSV normal,"],
  ["las tildes y las ñ pueden llegar dañadas al sistema."],
  [""],
  ["Doble cargue"],
  ["Subir el mismo archivo dos veces NO duplica las solicitudes: el sistema reconoce"],
  ["las que ya entraron y las omite, avisándote cuántas omitió."]
];

// ── Utilidades de parseo ────────────────────────────────────────────────

// Quita tildes y pasa a minúsculas, para comparar encabezados sin que un
// "Título" con tilde deje de reconocerse frente a un "Titulo" sin ella.
function normalizarTextoCargue_(texto) {
  return sinTildes_(texto).replace(/[^a-z0-9]/g, '');
}

// Detecta si el archivo usa coma o punto y coma como separador. Excel en
// configuración regional de Colombia suele guardar CSV con punto y coma.
function detectarDelimitadorCargue_(texto) {
  const primeraLinea = texto.split(/\r?\n/)[0] || '';
  const comas = (primeraLinea.match(/,/g) || []).length;
  const puntosComa = (primeraLinea.match(/;/g) || []).length;
  const tabs = (primeraLinea.match(/\t/g) || []).length;
  if (tabs > comas && tabs > puntosComa) return '\t';
  return puntosComa > comas ? ';' : ',';
}

// Convierte el texto de la columna Precio a número. Acepta "85000",
// "85.000", "$ 85.000" y "85.000,50". Devuelve null si no logra
// interpretarlo como número (para poder reportar el error con claridad).
function parsearNumeroCargue_(valor) {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === 'number') return valor;

  let texto = String(valor).trim();
  if (!texto) return 0;

  texto = texto.replace(/\s/g, '').replace(/[$COPcop]/g, '');
  const tienePunto = texto.indexOf('.') !== -1;
  const tieneComa = texto.indexOf(',') !== -1;

  if (tienePunto && tieneComa) {
    // Formato colombiano: el punto separa miles y la coma, decimales.
    texto = texto.replace(/\./g, '').replace(',', '.');
  } else if (tieneComa) {
    texto = texto.replace(',', '.');
  } else if (tienePunto) {
    // Un solo punto puede ser separador de miles ("85.000") o decimal
    // ("85.5"). Si lo que sigue al último punto son exactamente 3 dígitos,
    // lo tratamos como separador de miles.
    const partes = texto.split('.');
    const ultima = partes[partes.length - 1];
    if (ultima.length === 3) texto = texto.replace(/\./g, '');
  }

  const numero = Number(texto);
  return isNaN(numero) ? null : numero;
}

// Convierte el texto de la columna Fecha a Date. Acepta dd/MM/yyyy,
// dd/MM/yyyy HH:mm, dd-MM-yyyy y yyyy-MM-dd. Devuelve null si no la
// entiende, y la fecha por defecto si la celda viene vacía.
function parsearFechaCargue_(valor, fechaPorDefecto) {
  if (valor instanceof Date) return valor;
  const texto = (valor === null || valor === undefined) ? '' : String(valor).trim();
  if (!texto) return fechaPorDefecto;

  // dd/MM/yyyy [HH:mm[:ss]]  ·  dd-MM-yyyy [HH:mm[:ss]]
  let m = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const dia = parseInt(m[1], 10);
    const mes = parseInt(m[2], 10);
    const anio = parseInt(m[3], 10);
    const hora = m[4] ? parseInt(m[4], 10) : 0;
    const minuto = m[5] ? parseInt(m[5], 10) : 0;
    const segundo = m[6] ? parseInt(m[6], 10) : 0;
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || hora > 23 || minuto > 59) return null;
    const fecha = new Date(anio, mes - 1, dia, hora, minuto, segundo);
    // Rechaza fechas imposibles que JavaScript "corrige" sola (31/02 → 03/03).
    if (fecha.getDate() !== dia || fecha.getMonth() !== mes - 1) return null;
    return fecha;
  }

  // yyyy-MM-dd [HH:mm[:ss]]
  m = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const anio = parseInt(m[1], 10);
    const mes = parseInt(m[2], 10);
    const dia = parseInt(m[3], 10);
    const hora = m[4] ? parseInt(m[4], 10) : 0;
    const minuto = m[5] ? parseInt(m[5], 10) : 0;
    const segundo = m[6] ? parseInt(m[6], 10) : 0;
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || hora > 23 || minuto > 59) return null;
    const fecha = new Date(anio, mes - 1, dia, hora, minuto, segundo);
    if (fecha.getDate() !== dia || fecha.getMonth() !== mes - 1) return null;
    return fecha;
  }

  return null;
}

// Hash corto y estable de un texto, para construir IDs determinísticos.
function hashCortoCargue_(texto) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, texto, Utilities.Charset.UTF_8);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const byteSinSigno = (bytes[i] + 256) % 256;
    const parcial = byteSinSigno.toString(16);
    hex += (parcial.length === 1 ? '0' : '') + parcial;
  }
  return hex.substring(0, 6).toUpperCase();
}

// ID determinístico de una solicitud cargada masivamente. Mismo contenido
// de agrupación → mismo ID, y por eso un archivo subido dos veces no
// duplica nada. El prefijo CM deja ver de un vistazo que vino del plan B.
function generarIdCargue_(fecha, claveGrupo) {
  const dia = Utilities.formatDate(fecha, "GMT-5", "yyyyMMdd");
  return "SOL-CM-" + dia + "-" + hashCortoCargue_(claveGrupo);
}

// La fila de ejemplo de la plantilla se ignora sola, para que nadie cargue
// a "Ana Pérez" por olvidar borrarla.
function esFilaDeEjemploCargue_(valores) {
  const nombre = normalizarTextoCargue_(valores.nombre || '');
  return nombre.indexOf('ejemplo') === 0;
}

// ── Generación de la plantilla ──────────────────────────────────────────

// Escapa un valor para CSV: si contiene el delimitador, comillas o saltos
// de línea, se encierra entre comillas y se duplican las comillas internas.
function escaparCampoCsv_(valor, delimitador) {
  const texto = (valor === null || valor === undefined) ? '' : String(valor);
  if (texto.indexOf(delimitador) !== -1 || texto.indexOf('"') !== -1 ||
      texto.indexOf('\n') !== -1 || texto.indexOf('\r') !== -1) {
    return '"' + texto.replace(/"/g, '""') + '"';
  }
  return texto;
}

// Plantilla en CSV. Se entrega con BOM UTF-8 al inicio para que Excel
// reconozca la codificación y no dañe las tildes al abrirla.
function generarPlantillaCargueCSV() {
  const delimitador = ',';
  const lineas = [
    PLANTILLA_CARGUE_ENCABEZADOS.map(function (c) { return escaparCampoCsv_(c, delimitador); }).join(delimitador),
    PLANTILLA_CARGUE_EJEMPLO.map(function (c) { return escaparCampoCsv_(c, delimitador); }).join(delimitador)
  ];
  const texto = '﻿' + lineas.join('\r\n') + '\r\n';
  const marcaTiempo = Utilities.formatDate(new Date(), "GMT-5", "yyyyMMdd_HHmmss");

  return {
    nombreArchivo: 'Plantilla_Contingencia_' + CIUDAD + '_' + marcaTiempo + '.csv',
    base64: Utilities.base64Encode(texto, Utilities.Charset.UTF_8),
    mimeType: 'text/csv;charset=utf-8'
  };
}

// Plantilla en Excel (.xlsx), con tres hojas: la plantilla en blanco con su
// fila de ejemplo, las instrucciones y las listas de valores válidos.
// Se arma en una hoja temporal que se borra apenas se obtienen los bytes,
// igual que el export de resumen.
function generarPlantillaCargueExcel() {
  const marcaTiempo = Utilities.formatDate(new Date(), "GMT-5", "yyyyMMdd_HHmmss");
  const ssTemp = SpreadsheetApp.create('Plantilla contingencia ' + CIUDAD + ' - ' + marcaTiempo);

  try {
    const hojaPlantilla = ssTemp.getSheets()[0];
    hojaPlantilla.setName('Plantilla');
    escribirTablaEnHoja_(hojaPlantilla, PLANTILLA_CARGUE_ENCABEZADOS, [PLANTILLA_CARGUE_EJEMPLO]);
    // La fila de ejemplo se pinta distinto para que se note que hay que borrarla.
    hojaPlantilla.getRange(2, 1, 1, PLANTILLA_CARGUE_ENCABEZADOS.length)
      .setBackground('#FDF0D5').setFontColor('#8A5A00').setFontStyle('italic');

    const hojaInstrucciones = ssTemp.insertSheet('Instrucciones');
    hojaInstrucciones.getRange(1, 1, PLANTILLA_CARGUE_INSTRUCCIONES.length, 1)
      .setValues(PLANTILLA_CARGUE_INSTRUCCIONES);
    hojaInstrucciones.getRange(1, 1).setFontWeight('bold').setFontSize(13);
    hojaInstrucciones.setColumnWidth(1, 620);

    const listas = [];
    listas.push(['Sedes válidas', '']);
    SEDES_VALIDAS.forEach(function (s) { listas.push(['', s]); });
    listas.push(['', '']);
    listas.push(['Tipos de usuario válidos', '']);
    TIPOS_USUARIO_VALIDOS.forEach(function (t) { listas.push(['', t]); });
    listas.push(['', '']);
    listas.push(['Proveedores en el catálogo', '']);
    try {
      const facetas = getFacetsData();
      facetas.proveedores.forEach(function (p) { listas.push(['', p]); });
      if (!facetas.proveedores.length) listas.push(['', '(el catálogo no tiene proveedores cargados)']);
    } catch (err) {
      listas.push(['', '(no se pudo leer el catálogo: ' + err.message + ')']);
    }

    const hojaListas = ssTemp.insertSheet('Listas válidas');
    hojaListas.getRange(1, 1, listas.length, 2).setValues(listas);
    hojaListas.setColumnWidth(1, 260);
    hojaListas.setColumnWidth(2, 360);

    SpreadsheetApp.flush();

    const url = 'https://docs.google.com/spreadsheets/d/' + ssTemp.getId() + '/export?format=xlsx';
    const respuesta = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
    });
    const blob = respuesta.getBlob()
      .setName('Plantilla_Contingencia_' + CIUDAD + '_' + marcaTiempo + '.xlsx');

    return {
      nombreArchivo: blob.getName(),
      base64: Utilities.base64Encode(blob.getBytes()),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  } finally {
    DriveApp.getFileById(ssTemp.getId()).setTrashed(true);
  }
}

// ── Lectura y validación del archivo subido ─────────────────────────────

// Relaciona cada campo que necesitamos con la posición real que tiene en el
// archivo subido. Así el cargue no se rompe si alguien reordena columnas o
// escribe "Título" con tilde. Devuelve { indices, faltantes }.
function mapearColumnasCargue_(encabezadosArchivo) {
  // Cada campo acepta varios nombres posibles (alias) ya normalizados.
  const alias = {
    fecha: ['fecha'],
    sede: ['sede'],
    nombre: ['nombre', 'nombrecompleto'],
    documento: ['documento', 'numerodedocumento', 'nodocumento'],
    email: ['email', 'correo', 'correoelectronico'],
    tipoUsuario: ['tipodeusuario', 'tipousuario'],
    facultad: ['facultad'],
    programa: ['programa', 'programaacademico'],
    asignatura: ['asignatura'],
    titulo: ['titulo'],
    autor: ['autor'],
    categoria: ['categoria', 'tematica', 'tema'],
    isbn: ['isbn'],
    proveedor: ['proveedor'],
    precio: ['precio', 'preciounit', 'preciounitario'],
    cantidad: ['cantidad', 'ejemplares'],
    grupo: ['gruposolicitud', 'grupo', 'idsolicitud']
  };

  const normalizados = encabezadosArchivo.map(normalizarTextoCargue_);
  const indices = {};
  Object.keys(alias).forEach(function (campo) {
    indices[campo] = -1;
    for (let i = 0; i < alias[campo].length; i++) {
      const pos = normalizados.indexOf(alias[campo][i]);
      if (pos !== -1) { indices[campo] = pos; break; }
    }
  });

  // Estos son los únicos campos sin los que el cargue no tiene sentido.
  const obligatorios = ['sede', 'nombre', 'documento', 'email', 'tipoUsuario',
    'facultad', 'programa', 'asignatura', 'titulo'];
  const faltantes = obligatorios.filter(function (campo) { return indices[campo] === -1; });

  return { indices: indices, faltantes: faltantes };
}

// Lee los IDs de solicitud que ya están en la hoja "Pedidos", para saber
// qué agrupaciones del archivo ya fueron cargadas antes.
function leerIdsExistentesPedidos_() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_HOJA_PEDIDOS);
  const existentes = new Set();
  if (!hoja || hoja.getLastRow() < 2) return existentes;

  const valores = hoja.getRange(2, COL_PEDIDO_ID, hoja.getLastRow() - 1, 1).getValues();
  valores.forEach(function (fila) {
    const id = fila[0];
    if (id) existentes.add(String(id).trim());
  });
  return existentes;
}

// ── Motor del cargue masivo ─────────────────────────────────────────────
//
// opciones:
//   soloValidar          (bool) true = no escribe nada, solo revisa.
//   omitirFilasConError  (bool) true = carga las filas válidas e ignora las
//                        que tengan error. Por defecto false: si hay UNA
//                        fila mala, no se escribe nada (todo o nada).
//   nombreArchivo        (texto) solo informativo, para el reporte y el correo.
function procesarCargueMasivo(textoArchivo, opciones) {
  opciones = opciones || {};
  const soloValidar = opciones.soloValidar !== false; // por seguridad, validar es el default
  const omitirFilasConError = opciones.omitirFilasConError === true;
  const nombreArchivo = (opciones.nombreArchivo || '').toString();

  if (!textoArchivo || !textoArchivo.toString().trim()) {
    throw new Error("El archivo llegó vacío. Verifica que sea un CSV con datos.");
  }

  let texto = textoArchivo.toString();
  if (texto.length > CARGUE_MAX_CARACTERES) {
    throw new Error("El archivo es demasiado grande para procesarlo de una sola vez. " +
      "Pártelo en varios archivos más pequeños y cárgalos uno por uno.");
  }
  if (texto.charCodeAt(0) === 0xFEFF) texto = texto.substring(1); // quita el BOM

  const delimitador = detectarDelimitadorCargue_(texto);
  let matriz;
  try {
    matriz = Utilities.parseCsv(texto, delimitador);
  } catch (err) {
    throw new Error("No se pudo leer el archivo como CSV. " +
      "Si lo editaste en Excel, guárdalo como 'CSV UTF-8 (delimitado por comas)'. " +
      "Detalle técnico: " + err.message);
  }

  if (!matriz || matriz.length < 2) {
    throw new Error("El archivo no tiene filas de datos: solo se encontró el encabezado.");
  }
  if (matriz.length - 1 > CARGUE_MAX_FILAS) {
    throw new Error("El archivo tiene " + (matriz.length - 1) + " filas y el máximo por cargue es " +
      CARGUE_MAX_FILAS + ". Pártelo en varios archivos.");
  }

  const mapeo = mapearColumnasCargue_(matriz[0]);
  if (mapeo.faltantes.length) {
    throw new Error("Al archivo le faltan columnas obligatorias: " + mapeo.faltantes.join(', ') +
      ". Descarga la plantilla otra vez y vuelve a diligenciarla sin borrar el encabezado.");
  }

  const indices = mapeo.indices;
  const ahora = new Date();
  const errores = [];
  const filasValidas = [];
  let filasIgnoradasEjemplo = 0;
  let filasIgnoradasVacias = 0;
  // Se cuenta aparte del array "errores", que viene recortado a
  // CARGUE_MAX_ERRORES_REPORTADOS para no devolver un reporte gigantesco.
  let totalFilasConError = 0;

  // Paso 1: validar fila por fila y dejar cada una lista para escribir.
  for (let i = 1; i < matriz.length; i++) {
    const fila = matriz[i];
    const numeroFila = i + 1; // número tal como lo ve la persona en Excel

    const leer = function (campo) {
      const pos = indices[campo];
      if (pos === -1 || pos >= fila.length) return '';
      const valor = fila[pos];
      return (valor === null || valor === undefined) ? '' : String(valor).trim();
    };

    const valores = {
      fecha: leer('fecha'), sede: leer('sede'), nombre: leer('nombre'),
      documento: leer('documento'), email: leer('email'), tipoUsuario: leer('tipoUsuario'),
      facultad: leer('facultad'), programa: leer('programa'), asignatura: leer('asignatura'),
      titulo: leer('titulo'), autor: leer('autor'), categoria: leer('categoria'),
      isbn: leer('isbn'), proveedor: leer('proveedor'), precio: leer('precio'),
      cantidad: leer('cantidad'), grupo: leer('grupo')
    };

    // Fila completamente vacía: se salta en silencio (Excel suele dejarlas).
    const tieneAlgo = Object.keys(valores).some(function (k) { return valores[k] !== ''; });
    if (!tieneAlgo) { filasIgnoradasVacias++; continue; }

    // Fila de ejemplo de la plantilla: se ignora sin reportarla como error.
    if (esFilaDeEjemploCargue_(valores)) { filasIgnoradasEjemplo++; continue; }

    const erroresFila = [];

    if (SEDES_VALIDAS.indexOf(valores.sede) === -1) {
      erroresFila.push("Sede no válida ('" + valores.sede + "'). Debe ser: " + SEDES_VALIDAS.join(' / '));
    }
    if (!valores.nombre) erroresFila.push("Falta el nombre.");
    if (!valores.documento) erroresFila.push("Falta el documento.");
    if (!REGEX_EMAIL.test(valores.email)) erroresFila.push("Correo no válido ('" + valores.email + "').");
    if (TIPOS_USUARIO_VALIDOS.indexOf(valores.tipoUsuario) === -1) {
      erroresFila.push("Tipo de usuario no válido ('" + valores.tipoUsuario + "'). Debe ser: " + TIPOS_USUARIO_VALIDOS.join(' / '));
    }
    if (!valores.facultad) erroresFila.push("Falta la facultad.");
    if (!valores.programa) erroresFila.push("Falta el programa.");
    if (!valores.asignatura) erroresFila.push("Falta la asignatura.");
    if (!valores.titulo) erroresFila.push("Falta el título del libro.");

    const fecha = parsearFechaCargue_(valores.fecha, ahora);
    if (fecha === null) {
      erroresFila.push("Fecha no reconocida ('" + valores.fecha + "'). Usa dd/mm/aaaa o dd/mm/aaaa hh:mm.");
    }

    const precio = parsearNumeroCargue_(valores.precio);
    if (precio === null) {
      erroresFila.push("Precio no numérico ('" + valores.precio + "'). Escribe solo el número, ej: 85000.");
    } else if (precio < 0) {
      erroresFila.push("El precio no puede ser negativo.");
    }

    let cantidad = 1;
    if (valores.cantidad !== '') {
      const cantidadNumero = parsearNumeroCargue_(valores.cantidad);
      if (cantidadNumero === null || cantidadNumero < 1) {
        erroresFila.push("Cantidad no válida ('" + valores.cantidad + "'). Debe ser un entero de 1 en adelante.");
      } else {
        cantidad = Math.round(cantidadNumero);
      }
    }

    if (erroresFila.length) {
      totalFilasConError++;
      if (errores.length < CARGUE_MAX_ERRORES_REPORTADOS) {
        errores.push({ fila: numeroFila, titulo: valores.titulo, mensaje: erroresFila.join(' ') });
      }
      continue;
    }

    filasValidas.push({
      numeroFila: numeroFila,
      fecha: fecha,
      sede: valores.sede,
      nombre: valores.nombre,
      documento: valores.documento,
      email: valores.email,
      tipoUsuario: valores.tipoUsuario,
      facultad: valores.facultad,
      programa: valores.programa,
      asignatura: valores.asignatura,
      titulo: valores.titulo,
      autor: valores.autor,
      categoria: valores.categoria,
      isbn: valores.isbn,
      proveedor: valores.proveedor,
      precio: precio,
      cantidad: cantidad,
      grupo: valores.grupo
    });
  }

  // Paso 2: agrupar las filas válidas en solicitudes y asignarles su ID
  // determinístico (misma agrupación → mismo ID, siempre).
  const grupos = {};
  const ordenGrupos = [];
  filasValidas.forEach(function (f) {
    const dia = Utilities.formatDate(f.fecha, "GMT-5", "yyyyMMdd");
    const claveGrupo = [
      dia,
      f.documento.toLowerCase(),
      f.email.toLowerCase(),
      normalizarTextoCargue_(f.asignatura),
      normalizarTextoCargue_(f.grupo)
    ].join('|');

    if (!grupos[claveGrupo]) {
      grupos[claveGrupo] = {
        idSolicitud: generarIdCargue_(f.fecha, claveGrupo),
        fecha: f.fecha,
        filas: []
      };
      ordenGrupos.push(claveGrupo);
    }
    grupos[claveGrupo].filas.push(f);
  });

  // Paso 3: descartar las agrupaciones cuyo ID ya está en la hoja. Esto es
  // lo que hace que subir el mismo archivo dos veces sea inofensivo.
  const idsExistentes = leerIdsExistentesPedidos_();
  const insertadas = [];
  const omitidas = [];
  const filasParaInsertar = [];
  let ejemplaresInsertados = 0;
  let valorTotal = 0;

  ordenGrupos.forEach(function (clave) {
    const grupo = grupos[clave];
    if (idsExistentes.has(grupo.idSolicitud)) {
      omitidas.push({ idSolicitud: grupo.idSolicitud, libros: grupo.filas.length });
      return;
    }
    insertadas.push(grupo.idSolicitud);
    grupo.filas.forEach(function (f) {
      ejemplaresInsertados += f.cantidad;
      valorTotal += f.precio * f.cantidad;
      filasParaInsertar.push(construirFilaPedido_({
        fecha: f.fecha, sede: f.sede, nombre: f.nombre, documento: f.documento, email: f.email,
        tipoUsuario: f.tipoUsuario, facultad: f.facultad, programa: f.programa,
        asignatura: f.asignatura, titulo: f.titulo, autor: f.autor, categoria: f.categoria,
        isbn: f.isbn, proveedor: f.proveedor, precio: f.precio, cantidad: f.cantidad,
        idSolicitud: grupo.idSolicitud, estado: 'Pendiente', origen: ORIGEN_CARGUE
      }));
    });
  });

  const reporte = {
    ok: true,
    soloValidar: soloValidar,
    escrito: false,
    nombreArchivo: nombreArchivo,
    delimitadorDetectado: delimitador === '\t' ? 'tabulación' : delimitador,
    filasLeidas: matriz.length - 1,
    filasValidas: filasValidas.length,
    filasConError: totalFilasConError,
    filasIgnoradasEjemplo: filasIgnoradasEjemplo,
    filasIgnoradasVacias: filasIgnoradasVacias,
    solicitudesNuevas: insertadas.length,
    solicitudesOmitidas: omitidas.length,
    ejemplaresInsertados: ejemplaresInsertados,
    valorTotal: valorTotal,
    errores: errores,
    erroresTruncados: false,
    insertadas: insertadas,
    omitidas: omitidas.map(function (o) { return o.idSolicitud; })
  };

  // Si hubo más errores que los que caben en el reporte, se avisa para que
  // nadie crea que la lista mostrada es la lista completa.
  reporte.erroresTruncados = totalFilasConError > errores.length;

  // Paso 4: escribir (solo si NO es una validación y la persona ya confirmó).
  if (soloValidar) return reporte;

  if (reporte.filasConError > 0 && !omitirFilasConError) {
    throw new Error("El archivo tiene " + reporte.filasConError + " fila(s) con errores. " +
      "Corrígelas y vuelve a subirlo, o marca la opción de cargar únicamente las filas válidas.");
  }

  if (!filasParaInsertar.length) {
    reporte.mensaje = omitidas.length
      ? "No se escribió nada: todas las solicitudes del archivo ya estaban registradas."
      : "No se escribió nada: el archivo no tiene filas válidas por cargar.";
    return reporte;
  }

  // Mismo candado que registrarPedido(): si alguien está enviando una
  // solicitud desde la web justo en este momento, las escrituras se hacen
  // una detrás de otra y ninguna pisa a la otra. El cargue puede ser grande,
  // así que esperamos un poco más por el turno (20 s en vez de 10).
  const candado = LockService.getScriptLock();
  try {
    candado.waitLock(20000);
  } catch (err) {
    throw new Error("El sistema está ocupado escribiendo otras solicitudes. " +
      "Espera unos segundos y vuelve a confirmar el cargue (no se escribió nada todavía).");
  }

  try {
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hojaPedidos = libro.getSheetByName(NOMBRE_HOJA_PEDIDOS);
    if (!hojaPedidos) {
      throw new Error("No se encontró la pestaña '" + NOMBRE_HOJA_PEDIDOS + "'.");
    }
    inicializarHojaPedidos_(hojaPedidos);

    // Releemos los IDs YA con el candado tomado: entre la validación y la
    // confirmación pudo entrar otro cargue con las mismas solicitudes.
    const idsAhora = leerIdsExistentesPedidos_();
    const filasDefinitivas = filasParaInsertar.filter(function (fila) {
      return !idsAhora.has(String(fila[COL_PEDIDO_ID - 1]));
    });

    if (!filasDefinitivas.length) {
      reporte.mensaje = "No se escribió nada: las solicitudes del archivo se registraron mientras validabas.";
      return reporte;
    }

    hojaPedidos.getRange(
      hojaPedidos.getLastRow() + 1, 1,
      filasDefinitivas.length, TOTAL_COLUMNAS_PEDIDOS
    ).setValues(filasDefinitivas);

    reporte.escrito = true;
    reporte.filasEscritas = filasDefinitivas.length;
  } finally {
    candado.releaseLock();
  }

  // Un solo correo de resumen, ya fuera del candado.
  try {
    enviarCorreoCargueMasivo_(reporte);
    reporte.correoEnviado = true;
  } catch (err) {
    // Que falle el correo (por ejemplo, por cuota diaria de MailApp) no debe
    // hacer creer que el cargue falló: los datos ya están en la hoja.
    reporte.correoEnviado = false;
    reporte.avisoCorreo = "El cargue se guardó correctamente, pero no se pudo enviar el correo de resumen: " + err.message;
  }

  return reporte;
}

// Atajos que usa Biblioteca.html, para que el HTML no tenga que acordarse
// de pasar las opciones correctas.
function validarCargueMasivo(textoArchivo, nombreArchivo) {
  return procesarCargueMasivo(textoArchivo, { soloValidar: true, nombreArchivo: nombreArchivo });
}

function confirmarCargueMasivo(textoArchivo, nombreArchivo, omitirFilasConError) {
  return procesarCargueMasivo(textoArchivo, {
    soloValidar: false,
    omitirFilasConError: omitirFilasConError === true,
    nombreArchivo: nombreArchivo
  });
}

// ════════════════════════════════════════════════════════════════════════
// CONSOLIDACIÓN DEL CATÁLOGO (varios proveedores → IndiceGlobal)
// ════════════════════════════════════════════════════════════════════════
// Para armar el catálogo a medida que van llegando los archivos de cada
// proveedor, sin reformatear ninguno a mano.
//
// Cómo se usa:
//   1. Pega el catálogo de cada proveedor en su PROPIA pestaña. El nombre de
//      la pestaña es el nombre del proveedor (se usa si el archivo no trae
//      una columna de proveedor, que es lo habitual: su catálogo es todo suyo).
//   2. Ejecuta revisarConsolidacion() y lee el informe. No escribe nada.
//   3. Si el informe está bien, ejecuta consolidarCatalogo().
//
// Cada pestaña puede tener sus columnas en el orden que sea y con los nombres
// que use ese proveedor: se mapean igual que el catálogo principal, por nombre
// de encabezado (ver CAMPOS_CATALOGO). Lo único indispensable es el título.
//
// IMPORTANTE: al consolidar, "IndiceGlobal" se REESCRIBE a partir de las
// pestañas de origen. Pasa a ser una hoja derivada: no la edites a mano, edita
// la pestaña del proveedor y vuelve a consolidar. Las pestañas de origen nunca
// se tocan ni se borran, así que hacen las veces de respaldo.
//
// Se ignoran siempre: IndiceGlobal, Pedidos, LibrosDeseados y cualquier
// pestaña cuyo nombre empiece por guion bajo ("_notas", "_pruebas"…).
// ────────────────────────────────────────────────────────────────────────

// Orden en que se escribe el catálogo consolidado. Como la lectura mapea por
// nombre, este orden es solo el que queda más cómodo de mirar en la hoja.
const ENCABEZADOS_CATALOGO = [
  "Proveedor", "Sede", "Titulo", "Autor", "Editorial", "Categoria",
  "Programa", "Precio", "ISBN", "Año", "Stock", "Observaciones", "HojaOrigen"
];

// Las filas se escriben por lotes: un setValues() con decenas de miles de
// filas de golpe es la forma más rápida de agotar los 6 minutos que Apps
// Script le da a una ejecución.
const CONSOLIDACION_LOTE_FILAS = 2000;

// Relación medida sobre un catálogo real: unas 1.550 filas por cada trozo de
// caché. Sirve para avisar, antes de que ocurra, de que un catálogo demasiado
// grande puede no caber en CacheService.
const FILAS_POR_TROZO_CACHE_APROX = 1550;
const TROZOS_CACHE_PARA_AVISAR = 20;

function esHojaDelSistema_(nombre) {
  return nombre === NOMBRE_HOJA_CATALOGO ||
         nombre === NOMBRE_HOJA_PEDIDOS ||
         nombre === NOMBRE_HOJA_DESEOS ||
         nombre.charAt(0) === '_';
}

// Lee todas las pestañas de proveedor y arma las filas del catálogo, sin
// escribir nada. Lo usan tanto la revisión como la consolidación, para que
// las dos vean exactamente lo mismo.
function analizarConsolidacion_() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const resultado = {
    hojas: [],        // detalle por pestaña
    filas: [],        // filas ya listas para escribir en IndiceGlobal
    problemas: [],
    avisos: [],
    caracteres: 0
  };

  const hojasOrigen = libro.getSheets().filter(function (h) {
    return !esHojaDelSistema_(h.getName());
  });

  if (!hojasOrigen.length) {
    resultado.problemas.push(
      "No hay ninguna pestaña de proveedor. Pega el catálogo de cada proveedor " +
      "en su propia pestaña (el nombre de la pestaña es el nombre del proveedor) " +
      "y vuelve a intentar."
    );
    return resultado;
  }

  const proveedoresVistos = {}; // para detectar el mismo nombre escrito de dos formas

  hojasOrigen.forEach(function (hoja) {
    const nombreHoja = hoja.getName();
    const detalle = {
      hoja: nombreHoja, filas: 0, omitidasSinTitulo: 0,
      proveedorDesde: '', campos: {}, problema: ''
    };

    if (hoja.getLastRow() < 2 || hoja.getLastColumn() < 1) {
      detalle.problema = "Sin filas de datos: se omite.";
      resultado.hojas.push(detalle);
      return;
    }

    const valores = hoja.getDataRange().getValues();
    const mapeo = mapearColumnasCatalogo_(valores[0]);
    detalle.campos = mapeo.indices;

    // Aquí el proveedor NO es obligatorio: si el archivo no lo trae, se usa el
    // nombre de la pestaña, que es el caso normal al recibir el catálogo de un
    // proveedor (todo el archivo es de él).
    if (mapeo.indices.titulo === -1) {
      detalle.problema = "No se encontró la columna de título. Revisa la fila de encabezados.";
      resultado.problemas.push("Pestaña '" + nombreHoja + "': no se encontró la columna de título.");
      resultado.hojas.push(detalle);
      return;
    }

    detalle.proveedorDesde = mapeo.indices.proveedor === -1
      ? "del nombre de la pestaña"
      : "de la columna '" + String(valores[0][mapeo.indices.proveedor]).trim() + "'";

    const leer = function (fila, campo) {
      const posicion = mapeo.indices[campo];
      if (posicion === -1 || posicion >= fila.length) return '';
      return limpiarValorCatalogo_(fila[posicion]);
    };

    for (let i = 1; i < valores.length; i++) {
      const fila = valores[i];
      const titulo = leer(fila, 'titulo');
      if (!titulo) { detalle.omitidasSinTitulo++; continue; }

      const proveedor = leer(fila, 'proveedor') || nombreHoja;
      const clave = sinTildes_(proveedor);
      if (!proveedoresVistos[clave]) proveedoresVistos[clave] = {};
      proveedoresVistos[clave][proveedor] = true;

      const filaNueva = [
        proveedor,
        leer(fila, 'sede') || CIUDAD,
        titulo,
        leer(fila, 'autor'),
        leer(fila, 'editorial'),
        leer(fila, 'categoria'),
        leer(fila, 'programa'),
        leer(fila, 'precio'),
        limpiarIsbnCatalogo_(mapeo.indices.isbn === -1 ? '' : fila[mapeo.indices.isbn]),
        leer(fila, 'anio'),
        leer(fila, 'stock'),
        leer(fila, 'observaciones'),
        // La hoja de origen permite rastrear de dónde salió cada fila después
        // de consolidar, que es justamente para lo que existe la columna.
        leer(fila, 'hojaOrigen') || nombreHoja
      ];

      filaNueva.forEach(function (v) { resultado.caracteres += String(v).length; });
      resultado.filas.push(filaNueva);
      detalle.filas++;
    }

    resultado.hojas.push(detalle);
  });

  // Un mismo proveedor escrito de dos formas se cuenta como dos proveedores y
  // rompe el filtro. Vale la pena avisarlo antes de consolidar.
  Object.keys(proveedoresVistos).forEach(function (clave) {
    const variantes = Object.keys(proveedoresVistos[clave]);
    if (variantes.length > 1) {
      resultado.avisos.push(
        "El mismo proveedor aparece escrito de varias formas: " +
        variantes.map(function (v) { return "'" + v + "'"; }).join(" y ") +
        ". Unifícalo para que no se cuente dos veces."
      );
    }
  });

  return resultado;
}

// Revisión que NO escribe nada. Ejecutar siempre antes de consolidar.
function revisarConsolidacion() {
  const analisis = analizarConsolidacion_();
  const lineas = [];

  lineas.push("══════════════════════════════════════════════════");
  lineas.push(" Revisión de la consolidación (no se escribió nada)");
  lineas.push("══════════════════════════════════════════════════");

  if (analisis.problemas.length && !analisis.filas.length) {
    analisis.problemas.forEach(function (p) { lineas.push("✗ " + p); });
    Logger.log(lineas.join("\n"));
    return { ok: false, problemas: analisis.problemas, informe: lineas.join("\n") };
  }

  lineas.push("");
  lineas.push("Pestañas de proveedor encontradas: " + analisis.hojas.length);
  analisis.hojas.forEach(function (h) {
    if (h.problema) {
      lineas.push("  ✗ " + h.hoja + " — " + h.problema);
      return;
    }
    lineas.push("  ✓ " + h.hoja + ": " + h.filas + (h.filas === 1 ? " título" : " títulos") +
      " · proveedor tomado " + h.proveedorDesde);
    if (h.omitidasSinTitulo) {
      lineas.push("      · " + h.omitidasSinTitulo + (h.omitidasSinTitulo === 1
        ? " fila sin título que se omitirá" : " filas sin título que se omitirán"));
    }
    const ausentes = CAMPOS_CATALOGO.filter(function (d) { return h.campos[d.campo] === -1; })
      .map(function (d) { return d.campo; });
    if (ausentes.length) {
      lineas.push("      · sin columna para: " + ausentes.join(', ') + " (tomarán valor por defecto)");
    }
  });

  const hojaActual = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_HOJA_CATALOGO);
  const filasActuales = (hojaActual && hojaActual.getLastRow() > 1) ? hojaActual.getLastRow() - 1 : 0;

  lineas.push("");
  lineas.push("Resultado si consolidas ahora:");
  lineas.push("  · '" + NOMBRE_HOJA_CATALOGO + "' pasaría de " + filasActuales + " a " + analisis.filas.length + " títulos.");

  const trozos = Math.ceil(analisis.filas.length / FILAS_POR_TROZO_CACHE_APROX);
  lineas.push("  · Caché estimada: ~" + trozos + " trozo(s).");
  if (trozos > TROZOS_CACHE_PARA_AVISAR) {
    const aviso = "El catálogo consolidado es grande (~" + trozos + " trozos de caché). " +
      "Si CacheService no lo admite, cada búsqueda volverá a leer la hoja completa y el " +
      "buscador se pondrá lento. Mide el tiempo de la primera búsqueda antes de la jornada.";
    analisis.avisos.push(aviso);
  }

  if (filasActuales > analisis.filas.length) {
    lineas.push("");
    lineas.push("  ⚠ El catálogo actual tiene MÁS títulos que el que se armaría.");
    lineas.push("    consolidarCatalogo() se negará a hacerlo para no perder datos.");
    lineas.push("    Si es lo que quieres, usa consolidarCatalogoForzado().");
  }

  if (analisis.problemas.length) {
    lineas.push("");
    lineas.push("Problemas:");
    analisis.problemas.forEach(function (p) { lineas.push("  ✗ " + p); });
  }
  if (analisis.avisos.length) {
    lineas.push("");
    lineas.push("Avisos:");
    analisis.avisos.forEach(function (a) { lineas.push("  ⚠ " + a); });
  }

  lineas.push("");
  lineas.push("Si el informe está bien, ejecuta consolidarCatalogo().");
  lineas.push("══════════════════════════════════════════════════");

  Logger.log(lineas.join("\n"));
  return {
    ok: !analisis.problemas.length,
    titulosResultantes: analisis.filas.length,
    titulosActuales: filasActuales,
    problemas: analisis.problemas,
    avisos: analisis.avisos,
    informe: lineas.join("\n")
  };
}

// Reescribe "IndiceGlobal" con la unión de todas las pestañas de proveedor.
// Las pestañas de origen no se modifican ni se borran.
function consolidarCatalogo(opciones) {
  opciones = opciones || {};
  const forzar = opciones.forzar === true;

  const analisis = analizarConsolidacion_();

  if (analisis.problemas.length) {
    throw new Error(
      "No se consolidó nada porque hay problemas por resolver:\n · " +
      analisis.problemas.join("\n · ") +
      "\nEjecuta revisarConsolidacion() para ver el detalle."
    );
  }
  if (!analisis.filas.length) {
    throw new Error("No se consolidó nada: las pestañas de proveedor no tienen títulos.");
  }

  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(NOMBRE_HOJA_CATALOGO);
  const filasActuales = (hoja && hoja.getLastRow() > 1) ? hoja.getLastRow() - 1 : 0;

  // Red de seguridad: consolidar debería hacer crecer el catálogo. Si el
  // resultado es más pequeño, casi siempre es porque faltó pegar una pestaña
  // o un encabezado no se reconoció, no porque se quiera recortar el catálogo.
  if (!forzar && filasActuales > analisis.filas.length) {
    throw new Error(
      "El catálogo actual tiene " + filasActuales + " títulos y la consolidación " +
      "solo produciría " + analisis.filas.length + ". No se escribió nada, para no " +
      "perder datos.\nRevisa si falta alguna pestaña de proveedor o si algún " +
      "encabezado no se reconoció (ejecuta revisarConsolidacion()).\nSi de verdad " +
      "quieres reemplazarlo, ejecuta consolidarCatalogoForzado()."
    );
  }

  // Mismo candado que el resto del sistema: nadie debería estar escribiendo
  // en la hoja mientras se reconstruye el catálogo.
  const candado = LockService.getScriptLock();
  try {
    candado.waitLock(30000);
  } catch (err) {
    throw new Error("El sistema está ocupado. Espera unos segundos y vuelve a intentar (no se escribió nada).");
  }

  let escritas = 0;
  try {
    if (!hoja) hoja = libro.insertSheet(NOMBRE_HOJA_CATALOGO);

    hoja.clear();
    hoja.getRange(1, 1, 1, ENCABEZADOS_CATALOGO.length)
      .setValues([ENCABEZADOS_CATALOGO])
      .setFontWeight('bold').setBackground('#7fb536').setFontColor('#FFFFFF');

    // Por lotes, para no agotar el tiempo de ejecución con catálogos grandes.
    for (let inicio = 0; inicio < analisis.filas.length; inicio += CONSOLIDACION_LOTE_FILAS) {
      const lote = analisis.filas.slice(inicio, inicio + CONSOLIDACION_LOTE_FILAS);
      hoja.getRange(2 + inicio, 1, lote.length, ENCABEZADOS_CATALOGO.length).setValues(lote);
      escritas += lote.length;
    }
    hoja.setFrozenRows(1);
  } finally {
    candado.releaseLock();
  }

  // El catálogo cambió: la caché vieja ya no sirve.
  let avisoCache = '';
  try {
    refrescarCacheCatalogo();
  } catch (err) {
    avisoCache = "El catálogo se consolidó bien, pero no se pudo refrescar la caché: " +
      err.message + ". Ejecuta refrescarCacheCatalogo() aparte.";
  }

  const lineas = [];
  lineas.push("Catálogo consolidado: " + escritas + " títulos desde " +
    analisis.hojas.filter(function (h) { return !h.problema; }).length + " pestaña(s).");
  analisis.hojas.forEach(function (h) {
    if (!h.problema) lineas.push("  · " + h.hoja + ": " + h.filas);
  });
  if (avisoCache) lineas.push("⚠ " + avisoCache);
  analisis.avisos.forEach(function (a) { lineas.push("⚠ " + a); });
  lineas.push("");
  lineas.push("Recuerda: 'IndiceGlobal' es ahora una hoja derivada. No la edites a");
  lineas.push("mano; edita la pestaña del proveedor y vuelve a consolidar.");
  Logger.log(lineas.join("\n"));

  return {
    ok: true,
    titulos: escritas,
    hojas: analisis.hojas.filter(function (h) { return !h.problema; }).length,
    avisos: analisis.avisos,
    avisoCache: avisoCache,
    informe: lineas.join("\n")
  };
}

// Consolida aunque el resultado sea más pequeño que el catálogo actual.
// Usar solo cuando se sabe que el recorte es intencional.
function consolidarCatalogoForzado() {
  return consolidarCatalogo({ forzar: true });
}

// ════════════════════════════════════════════════════════════════════════
// PUESTA EN MARCHA SOBRE UNA HOJA DE CÁLCULO EXISTENTE
// ════════════════════════════════════════════════════════════════════════
// Para cuando ya se tiene el archivo con el catálogo consolidado de los
// proveedores y se quiere montar el sistema encima (Extensiones > Apps
// Script > pegar el código).
//
// Ejecutar configurarSistema() UNA VEZ desde el editor y leer el resultado
// en "Registro de ejecución". La función:
//
//   · NUNCA toca, reordena ni borra el catálogo. Solo lo lee para revisarlo.
//   · Crea las pestañas "Pedidos" y "LibrosDeseados" si no existen.
//   · Revisa qué columna del archivo quedó asignada a cada campo del sistema
//     y avisa de los problemas de calidad que afectan la experiencia de uso.
//
// El catálogo se mapea por NOMBRE de encabezado (ver CAMPOS_CATALOGO), así que
// el orden de las columnas no importa y sobran solo las que el sistema no usa.
// Lo que sí importa es que los encabezados se reconozcan: esta revisión existe
// para confirmarlo antes de una jornada, no después.
// ────────────────────────────────────────────────────────────────────────

function configurarSistema() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const reporte = { ok: true, problemas: [], avisos: [], acciones: [] };
  const lineas = [];

  lineas.push("══════════════════════════════════════════════════");
  lineas.push(" Puesta en marcha · Selecciones con Sentido · " + CIUDAD);
  lineas.push("══════════════════════════════════════════════════");

  const nombresHojas = libro.getSheets().map(function (h) { return h.getName(); });
  lineas.push("");
  lineas.push("Pestañas encontradas en el archivo:");
  nombresHojas.forEach(function (n) {
    lineas.push("  · " + n + (esHojaDelSistema_(n) ? "" : "   (pestaña de proveedor)"));
  });

  const hojasProveedor = nombresHojas.filter(function (n) { return !esHojaDelSistema_(n); });
  if (hojasProveedor.length) {
    lineas.push("");
    lineas.push("  Hay " + hojasProveedor.length + " pestaña(s) de proveedor sin consolidar.");
    lineas.push("  Ejecuta revisarConsolidacion() y luego consolidarCatalogo()");
    lineas.push("  para volcarlas a '" + NOMBRE_HOJA_CATALOGO + "'.");
  }

  // ── 1. Catálogo ──────────────────────────────────────────────────────
  lineas.push("");
  lineas.push("1) CATÁLOGO (pestaña '" + NOMBRE_HOJA_CATALOGO + "')");

  const hojaCatalogo = libro.getSheetByName(NOMBRE_HOJA_CATALOGO);
  if (!hojaCatalogo) {
    reporte.ok = false;
    reporte.problemas.push("No existe la pestaña '" + NOMBRE_HOJA_CATALOGO + "'.");
    lineas.push("   ✗ No existe.");
    lineas.push("     Opción A: renombra la pestaña del catálogo a '" + NOMBRE_HOJA_CATALOGO + "'.");
    lineas.push("     Opción B: cambia NOMBRE_HOJA_CATALOGO arriba en este archivo");
    lineas.push("               por el nombre real de tu pestaña.");
  } else if (hojaCatalogo.getLastRow() < 2) {
    reporte.ok = false;
    reporte.problemas.push("La pestaña del catálogo está vacía.");
    lineas.push("   ✗ Existe pero no tiene filas de datos.");
  } else {
    const totalFilas = hojaCatalogo.getLastRow() - 1;
    const encabezados = hojaCatalogo.getRange(1, 1, 1, hojaCatalogo.getLastColumn()).getValues()[0];
    const mapeo = mapearColumnasCatalogo_(encabezados);

    lineas.push("   ✓ Existe · " + totalFilas + " fila(s) de datos.");
    lineas.push("   Columnas del archivo: " + encabezados.map(function (e) {
      return "'" + String(e === null || e === undefined ? '' : e).trim() + "'";
    }).join(", "));
    lineas.push("");
    lineas.push("   Cómo quedó asignada cada columna:");

    CAMPOS_CATALOGO.forEach(function (definicion) {
      const posicion = mapeo.indices[definicion.campo];
      const obligatorio = CAMPOS_CATALOGO_OBLIGATORIOS.indexOf(definicion.campo) !== -1;
      if (posicion !== -1) {
        const nombreReal = String(encabezados[posicion] === null || encabezados[posicion] === undefined
          ? '' : encabezados[posicion]).trim();
        lineas.push("     ✓ " + definicion.campo + "  ←  columna " + (posicion + 1) + " ('" + nombreReal + "')");
      } else if (obligatorio) {
        lineas.push("     ✗ " + definicion.campo + "  ←  NO ENCONTRADA (obligatoria)");
      } else {
        lineas.push("     · " + definicion.campo + "  ←  no está en el archivo (se usará un valor por defecto)");
      }
    });

    if (mapeo.faltantes.length) {
      reporte.ok = false;
      reporte.problemas.push("El catálogo no tiene columnas para: " + mapeo.faltantes.join(', ') + ".");
      lineas.push("");
      lineas.push("   ✗ Faltan columnas obligatorias: " + mapeo.faltantes.join(', '));
      lineas.push("     Renombra el encabezado correspondiente en el archivo.");
    }

    // ── Calidad de los datos ──────────────────────────────────────────
    // Un catálogo puede estar bien mapeado y aun así dar una mala experiencia
    // (precios en cero, miles de temáticas de una sola fila). Eso se revisa
    // aquí porque es lo que se nota en plena jornada, no antes.
    if (!mapeo.faltantes.length) {
      try {
        const libros = leerCatalogoDesdeHoja_();
        lineas.push("");
        lineas.push("   Calidad de los datos:");
        lineas.push("     · Títulos leídos: " + libros.length);

        let sinPrecio = 0;
        const conteoTematicas = {};
        libros.forEach(function (l) {
          if (!(Number(l.precio) > 0)) sinPrecio++;
          [l.categoria, l.programa].forEach(function (v) {
            const nombre = (v || '').toString().trim();
            if (nombre) conteoTematicas[nombre] = (conteoTematicas[nombre] || 0) + 1;
          });
        });

        const porcentajeSinPrecio = libros.length ? Math.round(100 * sinPrecio / libros.length) : 0;
        lineas.push("     · Sin precio (0 o vacío): " + sinPrecio + " (" + porcentajeSinPrecio + "%)");
        if (porcentajeSinPrecio >= 20) {
          const aviso = "El " + porcentajeSinPrecio + "% de los títulos no tiene precio. " +
            "El buscador los mostrará como 'Precio por confirmar' y no los sumará al total estimado.";
          reporte.avisos.push(aviso);
          lineas.push("       ⚠ " + aviso);

          // Saber si es un proveedor concreto el que no envió precios ahorra
          // mucho tiempo: se le pide a él la lista, no se revisa todo.
          const sinPrecioPorProveedor = {};
          const totalPorProveedor = {};
          libros.forEach(function (l) {
            const p = (l.proveedor || '(sin proveedor)').toString().trim() || '(sin proveedor)';
            totalPorProveedor[p] = (totalPorProveedor[p] || 0) + 1;
            if (!(Number(l.precio) > 0)) sinPrecioPorProveedor[p] = (sinPrecioPorProveedor[p] || 0) + 1;
          });
          Object.keys(totalPorProveedor).forEach(function (p) {
            const faltan = sinPrecioPorProveedor[p] || 0;
            if (!faltan) return;
            lineas.push("         · " + p + ": " + faltan + " de " + totalPorProveedor[p] + " sin precio");
          });
        }

        const totalTematicas = Object.keys(conteoTematicas).length;
        const tematicasEnFiltro = Object.keys(conteoTematicas).filter(function (n) {
          return conteoTematicas[n] >= TEMATICA_MIN_TITULOS;
        }).length;
        lineas.push("     · Temáticas distintas: " + totalTematicas +
          " · en el filtro (con " + TEMATICA_MIN_TITULOS + "+ títulos): " + tematicasEnFiltro);
        if (totalTematicas > tematicasEnFiltro) {
          lineas.push("       · Las demás no salen en el desplegable porque lo volverían inservible,");
          lineas.push("         pero se siguen encontrando escribiéndolas en el buscador.");
          lineas.push("         Se ajusta con la constante TEMATICA_MIN_TITULOS.");
        }
      } catch (err) {
        reporte.avisos.push("No se pudo revisar la calidad de los datos: " + err.message);
        lineas.push("     ⚠ No se pudo revisar la calidad de los datos: " + err.message);
      }
    }

    // Proveedores: es el dato que define la operación de Bogotá (16 a 20).
    if (!mapeo.faltantes.length) {
      try {
        const diagnostico = verificarProveedores();
        lineas.push("");
        lineas.push("   Proveedores detectados: " + diagnostico.total +
          " (se esperan entre " + PROVEEDORES_ESPERADOS_MIN + " y " + PROVEEDORES_ESPERADOS_MAX + ")");
        if (diagnostico.aviso) {
          reporte.avisos.push(diagnostico.aviso);
          lineas.push("   ⚠ " + diagnostico.aviso);
        } else {
          lineas.push("   ✓ Dentro del rango esperado.");
        }
        diagnostico.detalle.forEach(function (d) {
          lineas.push("       · " + d.proveedor + ": " + d.titulos + " títulos");
        });
      } catch (err) {
        reporte.avisos.push("No se pudieron contar los proveedores: " + err.message);
        lineas.push("   ⚠ No se pudieron contar los proveedores: " + err.message);
      }
    }
  }

  // ── 2. Hojas de trabajo del sistema ──────────────────────────────────
  // Solo se CREAN si faltan. Si ya existen, no se toca su contenido.
  lineas.push("");
  lineas.push("2) PESTAÑAS DEL SISTEMA");

  let hojaPedidos = libro.getSheetByName(NOMBRE_HOJA_PEDIDOS);
  if (!hojaPedidos) {
    hojaPedidos = libro.insertSheet(NOMBRE_HOJA_PEDIDOS);
    reporte.acciones.push("Se creó la pestaña '" + NOMBRE_HOJA_PEDIDOS + "'.");
    lineas.push("   + Se creó '" + NOMBRE_HOJA_PEDIDOS + "'.");
  } else {
    lineas.push("   ✓ '" + NOMBRE_HOJA_PEDIDOS + "' ya existía (no se modificaron sus datos).");
  }
  inicializarHojaPedidos_(hojaPedidos);
  lineas.push("     Columnas: " + ENCABEZADOS_PEDIDOS.join(" | "));

  let hojaDeseos = libro.getSheetByName(NOMBRE_HOJA_DESEOS);
  if (!hojaDeseos) {
    hojaDeseos = libro.insertSheet(NOMBRE_HOJA_DESEOS);
    reporte.acciones.push("Se creó la pestaña '" + NOMBRE_HOJA_DESEOS + "'.");
    lineas.push("   + Se creó '" + NOMBRE_HOJA_DESEOS + "'.");
  } else {
    lineas.push("   ✓ '" + NOMBRE_HOJA_DESEOS + "' ya existía (no se modificaron sus datos).");
  }
  inicializarHojaDeseos_(hojaDeseos);

  // ── 3. Script Properties ─────────────────────────────────────────────
  lineas.push("");
  lineas.push("3) CONFIGURACIÓN (Configuración del proyecto > Propiedades del script)");

  const propiedades = PropertiesService.getScriptProperties();
  const requeridas = [
    { clave: 'CLAVE_BIBLIOTECA', obligatoria: true, nota: 'clave del Panel de Biblioteca' },
    { clave: 'CORREO_BIBLIOTECA', obligatoria: true, nota: 'correo que recibe las notificaciones' },
    { clave: 'ID_LOGO', obligatoria: false, nota: 'ID en Drive del logo (opcional)' },
    { clave: 'URL_APP_WEB', obligatoria: false, nota: 'respaldo de la URL publicada (opcional)' }
  ];

  requeridas.forEach(function (p) {
    const valor = propiedades.getProperty(p.clave);
    if (valor) {
      lineas.push("   ✓ " + p.clave + " configurada");
    } else if (p.obligatoria) {
      reporte.ok = false;
      reporte.problemas.push("Falta configurar " + p.clave + " (" + p.nota + ").");
      lineas.push("   ✗ " + p.clave + " SIN configurar — " + p.nota);
    } else {
      lineas.push("   · " + p.clave + " sin configurar — " + p.nota);
    }
  });

  // ── 4. Archivos de interfaz ──────────────────────────────────────────
  lineas.push("");
  lineas.push("4) ARCHIVOS HTML DEL PROYECTO");
  ['Index', 'Biblioteca', 'Abrir'].forEach(function (nombre) {
    try {
      HtmlService.createTemplateFromFile(nombre);
      lineas.push("   ✓ " + nombre + ".html presente");
    } catch (err) {
      reporte.ok = false;
      reporte.problemas.push("Falta el archivo " + nombre + ".html en el proyecto.");
      lineas.push("   ✗ Falta " + nombre + ".html — créalo con Archivo > Nuevo > Archivo HTML");
    }
  });

  // ── Resumen ──────────────────────────────────────────────────────────
  lineas.push("");
  lineas.push("══════════════════════════════════════════════════");
  if (reporte.ok && !reporte.avisos.length) {
    lineas.push(" TODO LISTO. Siguiente paso: Implementar > Nueva implementación");
    lineas.push(" > Aplicación web. Luego ejecuta obtenerUrlsSistema().");
  } else if (reporte.ok) {
    lineas.push(" LISTO CON AVISOS. Revisa los ⚠ de arriba antes de publicar.");
  } else {
    lineas.push(" FALTAN COSAS POR CORREGIR:");
    reporte.problemas.forEach(function (p) { lineas.push("   ✗ " + p); });
    lineas.push(" Corrige lo anterior y vuelve a ejecutar configurarSistema().");
  }
  lineas.push("══════════════════════════════════════════════════");

  Logger.log(lineas.join("\n"));
  reporte.informe = lineas.join("\n");
  return reporte;
}

// ────────────────────────────────────────────────────────────────────────
// URLS DEL SISTEMA Y CÓDIGOS QR
// Ejecuta obtenerUrlsSistema() desde el editor (Ejecutar > obtenerUrlsSistema)
// y revisa el resultado en "Registro de ejecución" para tener a la mano los
// enlaces, sin ir a buscarlos en Implementar > Administrar implementaciones.
//
// Sobre el QR: el enlace que se debe imprimir en el código QR es el que
// termina en "?qr=1". Ese enlace NO muestra el buscador directamente: abre
// primero la página puente (Abrir.html), que detecta si la persona llegó
// desde el navegador interno de otra app y, en ese caso, le ofrece abrir el
// sistema en Safari (iOS) o en el navegador del sistema (Android) antes de
// continuar. Ver docs/bogota-qr-safari.md.
// ────────────────────────────────────────────────────────────────────────

function obtenerUrlsSistema() {
  // La URL se lee de la implementación activa o de la Script Property
  // URL_APP_WEB. Nunca se escribe una URL real dentro del repositorio.
  const base = obtenerUrlAppWeb_();

  if (!base) {
    Logger.log(
      "No se pudo determinar la URL de la app web.\n" +
      "ScriptApp.getService().getUrl() solo devuelve valor dentro de una petición web real, " +
      "así que al ejecutar esta función desde el editor necesitas tener configurada la " +
      "Script Property 'URL_APP_WEB' con la URL que aparece en Implementar > Administrar implementaciones."
    );
    return { appWeb: '', panelBiblioteca: '', urlParaQR: '', hojaDeCalculo: SpreadsheetApp.getActiveSpreadsheet().getUrl() };
  }

  const urls = {
    appWeb: base,
    panelBiblioteca: base + "?panel=biblioteca",
    urlParaQR: base + "?qr=1",
    hojaDeCalculo: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    editorDeAppsScript: "https://script.google.com/home/projects/" + ScriptApp.getScriptId() + "/edit"
  };

  Logger.log(
    "── URLs del sistema · Selecciones con Sentido · " + CIUDAD + " ──\n" +
    "App web (usuarios):\n  " + urls.appWeb + "\n" +
    "URL PARA IMPRIMIR EN EL QR (pasa por la página puente):\n  " + urls.urlParaQR + "\n" +
    "Panel de Biblioteca (personal, pide clave):\n  " + urls.panelBiblioteca + "\n" +
    "Hoja de cálculo (Pedidos/IndiceGlobal/LibrosDeseados):\n  " + urls.hojaDeCalculo + "\n" +
    "Editor de Apps Script (código):\n  " + urls.editorDeAppsScript + "\n\n" +
    "El código QR se genera con la herramienta que prefiera la institución, usando la URL marcada arriba."
  );

  return urls;
}

// ────────────────────────────────────────────────────────────────────────
// FUNCIONES DE PRUEBA (datos ficticios)
// Ejecutar desde el editor de Apps Script. Nunca usar datos reales aquí.
// ────────────────────────────────────────────────────────────────────────

function probarRegistrarPedido() {
  const datosDePrueba = {
    sede: SEDES_VALIDAS[0],
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
        proveedor: "Proveedor Demo",
        precio: 85000,
        cantidad: 3
      }
    ]
  };

  const resultado = registrarPedido(datosDePrueba);
  Logger.log(resultado);
}

// Prueba el cargue masivo EN MODO VALIDACIÓN (no escribe nada en la hoja).
// Usa datos ficticios e incluye a propósito una fila con errores, para ver
// cómo se reportan. Ejecutar desde el editor y mirar el registro.
function probarCargueMasivo() {
  const sede = SEDES_VALIDAS[0];
  const csv = [
    PLANTILLA_CARGUE_ENCABEZADOS.join(','),
    // Dos filas del mismo grupo (G1): deben quedar en UNA sola solicitud.
    ['16/09/2026 09:15', sede, 'Ana Pérez', '1234567890', 'demo1@example.org', 'Docente',
      'Ciencias de la Salud', 'Enfermería', 'Fundamentos de Enfermería', 'Libro ficticio uno',
      'Autora Ficticia', 'Salud', '9780000000001', 'Proveedor Demo', '85.000', '2', 'G1'].join(','),
    ['16/09/2026 09:15', sede, 'Ana Pérez', '1234567890', 'demo1@example.org', 'Docente',
      'Ciencias de la Salud', 'Enfermería', 'Fundamentos de Enfermería', 'Libro ficticio dos',
      'Autor Ficticio', 'Salud', '9780000000002', 'Proveedor Demo', '120000', '1', 'G1'].join(','),
    // Fila con correo inválido y tipo de usuario inexistente: debe reportarse.
    ['16/09/2026', sede, 'Carlos Gómez', '9876543210', 'correo-malo', 'Profesor',
      'Ingeniería', 'Ingeniería de Sistemas', 'Bases de Datos', 'Libro ficticio tres',
      '', 'Tecnología', '', 'Proveedor Demo', '60000', '1', 'G2'].join(',')
  ].join('\n');

  const reporte = procesarCargueMasivo(csv, { soloValidar: true, nombreArchivo: 'prueba.csv' });
  Logger.log('Filas leídas: ' + reporte.filasLeidas);
  Logger.log('Filas válidas: ' + reporte.filasValidas);
  Logger.log('Filas con error: ' + reporte.filasConError);
  Logger.log('Solicitudes que se crearían: ' + reporte.solicitudesNuevas + ' → ' + reporte.insertadas.join(', '));
  Logger.log('Solicitudes omitidas por ya existir: ' + reporte.solicitudesOmitidas);
  reporte.errores.forEach(function (e) {
    Logger.log('  Fila ' + e.fila + ': ' + e.mensaje);
  });
  return reporte;
}

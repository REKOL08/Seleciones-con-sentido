// Configuración de ejemplo del sistema de Bogotá.
// NO colocar secretos reales aquí. En producción, usar Script Properties.

const CONFIG_BOGOTA = {
  CIUDAD: 'Bogotá',
  NOMBRE_HOJA_CATALOGO: 'IndiceGlobal',
  NOMBRE_HOJA_PEDIDOS: 'Pedidos',
  NOMBRE_HOJA_DESEOS: 'LibrosDeseados',
  SEDES_VALIDAS: ['Bogotá'],
  TIPOS_USUARIO_VALIDOS: ['Docente', 'Estudiante', 'Administrativo'],

  // Rango de proveedores esperado en la operación de Bogotá. Solo se usa
  // para avisar si el catálogo quedó fuera de rango; no bloquea nada.
  PROVEEDORES_ESPERADOS_MIN: 16,
  PROVEEDORES_ESPERADOS_MAX: 20,

  // Topes de precaución del cargue masivo (no son límites de la plataforma).
  CARGUE_MAX_FILAS: 3000,
  CARGUE_MAX_CARACTERES: 2000000
};

// Script Properties requeridas:
//
// CLAVE_BIBLIOTECA   clave compartida del Panel de Biblioteca
// CORREO_BIBLIOTECA  correo que recibe las notificaciones
// ID_LOGO            ID en Drive del archivo de logo
// URL_APP_WEB        URL de la implementación activa. Solo se usa como
//                    respaldo cuando ScriptApp.getService().getUrl() no
//                    está disponible (por ejemplo, al ejecutar
//                    obtenerUrlsSistema() desde el editor).

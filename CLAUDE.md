# CLAUDE.md

## Contexto del proyecto

Este es un proyecto Open Source destinado a documentar y replicar la lógica de un sistema de gestión de solicitudes bibliográficas.

La implementación original utiliza:

- Google Apps Script
- HTML
- CSS
- JavaScript
- Google Sheets
- Google Drive
- CacheService

## Regla principal

NO inventar funcionalidades ni modificar silenciosamente la lógica existente.

Antes de hacer cambios:

1. identificar la función afectada;
2. explicar qué comportamiento actual tiene;
3. identificar dependencias;
4. proponer el cambio;
5. mantener compatibilidad cuando sea posible;
6. actualizar documentación si cambia la arquitectura.

## Privacidad

Los datos de producción NO están disponibles en este repositorio.

Nunca introducir:

- nombres reales;
- documentos reales;
- correos reales;
- IDs privados;
- claves;
- tokens;
- URLs privadas;
- catálogos reales.

Para pruebas utilizar datos ficticios.

## Arquitectura

Frontend:
- `src/Biblioteca.html`
- tercer archivo de interfaz pendiente de incorporar.

Backend:
- `src/Código.gs`

Persistencia conceptual:
- `IndiceGlobal`
- `Pedidos`
- `LibrosDeseados`

## Objetivo de futuras iteraciones

La evolución puede incluir:

- separación por módulos;
- configuración externa;
- pruebas automatizadas;
- validaciones más robustas;
- API independiente;
- base de datos alternativa;
- frontend moderno;
- autenticación real;
- observabilidad;
- despliegue reproducible.

Pero ninguna de estas mejoras debe darse por implementada hasta que exista código/documentación que la respalde.

## Forma de trabajo

Cuando se solicite una modificación:

```text
ANALIZAR
→ EXPLICAR
→ PROPONER
→ IMPLEMENTAR
→ PROBAR
→ DOCUMENTAR
```

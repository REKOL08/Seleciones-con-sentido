# Seguridad y saneamiento

## Antes de hacer público el repositorio

Revisar:

- [ ] No hay contraseñas.
- [ ] No hay API keys.
- [ ] No hay tokens.
- [ ] No hay IDs privados de Drive.
- [ ] No hay IDs privados de Sheets.
- [ ] No hay URLs reales de despliegues.
- [ ] No hay correos institucionales reales.
- [ ] No hay nombres/documentos de usuarios.
- [ ] No hay catálogos de producción.
- [ ] No hay exportaciones de producción.
- [ ] No hay archivos temporales.
- [ ] No hay secretos en comentarios.
- [ ] No hay secretos en el historial de Git.

## Configuración segura

Usar Google Apps Script → Project Settings → Script Properties.

Ejemplo conceptual:

```text
CLAVE_BIBLIOTECA = <valor privado>
CORREO_BIBLIOTECA = <correo de la instalación>
ID_LOGO = <ID privado del archivo>
```

No colocar esos valores directamente en archivos versionados.

## Nota sobre Git

Si un secreto ya fue publicado en un repositorio, borrarlo del archivo no es suficiente: también hay que rotarlo/revocarlo y limpiar el historial cuando corresponda.

# Bogotá · Códigos QR y apertura en Safari

## El problema

Los QR de la jornada llevan al buscador. Cómo se abre ese enlace depende de con
qué se escaneó el código:

| Se escanea desde… | Se abre en… | ¿Funciona? |
|---|---|---|
| Cámara nativa de iOS | Safari | Sí |
| Cámara nativa de Android | Navegador por defecto | Sí |
| Lector dentro de Instagram / Facebook / WhatsApp | Navegador interno de esa app (WebView) | **Problemas** |

Google **bloquea los inicios de sesión desde navegadores embebidos**
(el error conocido como `disallowed_useragent`). Si la app web está publicada
exigiendo cuenta de Google, quien llegue desde el navegador interno de otra app
puede quedarse trabado en un error, sin entender por qué.

> Nota de precisión: no puedo confirmarte desde aquí el comportamiento exacto
> de cada app ni de cada versión de iOS/Android hoy. Lo anterior es el patrón
> conocido del bloqueo de WebViews de Google; **conviene verificarlo con una
> prueba real** antes de imprimir los QR.

## La solución implementada

Una **página puente** (`bogota/Abrir.html`) que se muestra antes del buscador.

```text
QR  →  .../exec?qr=1  →  Abrir.html
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
   Navegador normal              Navegador interno de otra app
   (Safari, Chrome…)             (Instagram, Facebook, WhatsApp…)
              │                           │
              ▼                           ▼
   Pasa directo al buscador      Intersticial: "Abre esta página
                                  en tu navegador" + botón + pasos
                                  manuales + copiar enlace
```

**La URL que se imprime en el QR es la que termina en `?qr=1`.**
Se obtiene ejecutando `obtenerUrlsSistema()` desde el editor de Apps Script:
aparece rotulada como "URL PARA IMPRIMIR EN EL QR".

## Cómo detecta el navegador interno

En el cliente, no en el servidor: **`doGet(e)` de Apps Script no recibe los
encabezados HTTP de la petición**, así que el User-Agent no está disponible del
lado del servidor. La detección vive en el JavaScript de `Abrir.html`:

1. Marcas conocidas en el User-Agent: `FBAN`, `FBAV`, `FB_IAB`, `Instagram`,
   `Line/`, `MicroMessenger`, `WhatsApp`, `Twitter`, `LinkedInApp`, `Snapchat`,
   `TikTok`, `Pinterest`, `GSA/`.
2. En iOS, además: si el User-Agent **no** contiene `Safari/` y tampoco es uno
   de los navegadores alternativos conocidos (`CriOS`, `FxiOS`, `EdgiOS`,
   `OPiOS`, `DuckDuckGo`), se asume WebView embebido.

## Advertencias que hay que tener presentes

Estas son limitaciones reales del enfoque, no defectos de la implementación:

1. **La detección es heurística.** Se basa en el User-Agent, que las apps
   cambian sin avisar. Habrá falsos positivos y falsos negativos. Por eso la
   página **nunca bloquea a nadie**: siempre deja visible "Continuar aquí de
   todos modos".

2. **`x-safari-https://` no es una API pública documentada por Apple.** Es un
   truco conocido para saltar a Safari desde un WebView. Puede funcionar o no
   según la versión de iOS y la app de origen. **Hay que probarlo en un iPhone
   real antes de imprimir los QR.** Por eso los pasos manuales ("toca el menú
   ··· y elige Abrir en Safari") quedan siempre en pantalla, no escondidos
   detrás de un fallo del botón.

3. **En Android se usa el esquema `intent://`**, que sí está documentado por
   Android, con `browser_fallback_url` por si ninguna app lo atiende. Aun así,
   depende de qué navegador tenga instalado la persona.

4. **El salto automático puede ser bloqueado.** La app corre dentro de un
   iframe de Apps Script; navegar el marco superior sin un toque previo puede
   ser rechazado por el navegador. Por eso hay un botón "Continuar ahora"
   visible como respaldo, y se usa `window.open(url, '_top')` cuando la
   asignación directa a `window.top.location` falla.

## Prueba recomendada antes de imprimir los QR

Con el QR ya generado, escanearlo desde:

- [ ] Cámara nativa de iOS → debe pasar directo al buscador.
- [ ] Cámara nativa de Android → debe pasar directo al buscador.
- [ ] Lector interno de Instagram (iOS) → debe salir el intersticial; probar el
      botón "Abrir en Safari" y anotar si funciona o si toca el menú manual.
- [ ] Lector interno de Instagram (Android) → probar "Abrir en el navegador".
- [ ] WhatsApp (abrir el enlace desde un chat), iOS y Android.

Si el botón de Safari no funciona en el iPhone de prueba, **los pasos manuales
igual resuelven el caso**: esa es la razón de que estén siempre visibles.

## Generación del código QR

El sistema **no genera la imagen del QR**. Se genera con la herramienta que
prefiera la institución, usando la URL que entrega `obtenerUrlsSistema()`.

No se incluyó generación automática porque requeriría depender de un servicio
externo de terceros, y la API de códigos QR de Google Charts que se usaba
históricamente para esto fue descontinuada. Si más adelante se quiere generar
el QR desde el propio sistema, hay que elegir y documentar explícitamente qué
servicio se usará.

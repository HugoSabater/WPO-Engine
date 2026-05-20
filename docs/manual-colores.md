# 🎨 Guía de Colores — WPO Analytics Engine
### Manual para Equipos de Gerencia y Marketing

> **¿Para qué sirve esta guía?**
> Cuando abras el WPO Engine y veas colores naranjas o rojos, esta guía te explica en lenguaje normal qué significa y qué puedes revisar tú mismo antes de llamar a soporte técnico. En muchos casos, la solución es activar una opción o limpiar una caché desde el panel de WordPress — sin tocar código.

---

## Cómo leer los colores de la herramienta

| Color | Qué significa | ¿Hay que actuar? |
|-------|--------------|-----------------|
| 🟢 **Verde** | La web va bien en este aspecto | No, disfrútalo |
| 🟠 **Naranja** | Hay margen de mejora, no es urgente | Sí, esta semana |
| 🔴 **Rojo** | Problema que afecta ventas y posicionamiento | Sí, hoy si es posible |

> 💡 **Recuerda:** Un indicador rojo no significa que la web está "caída". Significa que ese aspecto técnico concreto está por debajo del estándar de Google y puede estar costando conversiones.

---

## ¿Dónde veo estos colores?

Tienes dos pantallas principales en el WPO Engine:

### 📊 La pantalla "Dashboard"
Es tu **vista rápida del estado de salud**. Muestra el último análisis de cada URL de tu tienda.

### 📋 La pantalla "Reports"
Es el **historial completo**. Puedes ver la evolución de cada página a lo largo del tiempo y filtrar por estado.

---
---

# PARTE 1 — Pantalla Dashboard

## Ejemplo de lo que verías en pantalla

```
┌─────────────────────────────────────────────────────────────────┐
│  WPO Analytics Engine                          ● Cola limpia    │
├─────────────────────────────────────────────────────────────────┤
│  URLS MONITOREADAS   SCORE PROMEDIO   BUEN SCORE   SCORE CRÍTICO│
│       12                  61               3             5      │
├─────────────────────────────────────────────────────────────────┤
│  ⚠️  LCP Crítico Detectado                                      │
│     Largest Contentful Paint   →   5.8s                        │
│     La página /categoria/ramos supera el umbral "Pobre"        │
├─────────────────────────────────────────────────────────────────┤
│  ⚠️  Hilo Principal Bloqueado                                   │
│     Total Blocking Time        →   820ms                       │
│     JavaScript de terceros bloquea la interactividad           │
├─────────────────────────────────────────────────────────────────┤
│  URL                              Score   LCP      TBT    TTFB  │
│  tutienda.com/                   🟠 65    3.1s     290ms  620ms │
│  tutienda.com/categoria/ramos    🔴 28    5.8s     820ms  1.9s  │
│  tutienda.com/producto/bouquet   🟠 54    4.2s     410ms  750ms │
│  tutienda.com/contacto           🟢 91    1.4s      80ms  310ms │
│  tutienda.com/carrito            🔴 34    4.9s     650ms  2.1s  │
└─────────────────────────────────────────────────────────────────┘
```

**¿Qué me dice esto de un vistazo?**

- Hay **5 páginas con problemas graves** (rojo) de 12 monitoreadas.
- La página de categoría `/ramos` y el `/carrito` son las más afectadas.
- La página de `/contacto` está perfecta — no hay que tocarla.
- El score promedio de **61** sobre 100 indica que la tienda está en zona de riesgo.

---
---

# PARTE 2 — Pantalla Reports

## Ejemplo de lo que verías en pantalla

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 Reports — Historial completo                                │
├──────────────────┬───────────┬───────┬───────┬──────┬──────────┤
│  URL             │ Fecha     │ Score │  LCP  │ TBT  │  Estado  │
├──────────────────┼───────────┼───────┼───────┼──────┼──────────┤
│ /categoria/ramos │ 20 may    │  🔴 28 │ 5.8s  │ 820ms│ Crítico  │
│ /categoria/ramos │ 18 may    │  🔴 31 │ 5.2s  │ 760ms│ Crítico  │
│ /categoria/ramos │ 10 may    │  🟠 58 │ 3.1s  │ 380ms│ Mejorable│
│ /categoria/ramos │ 01 may    │  🟢 82 │ 2.1s  │ 190ms│ Óptimo   │
├──────────────────┼───────────┼───────┼───────┼──────┼──────────┤
│ /carrito         │ 20 may    │  🔴 34 │ 4.9s  │ 650ms│ Crítico  │
│ /carrito         │ 15 may    │  🟠 61 │ 3.4s  │ 320ms│ Mejorable│
│ /carrito         │ 01 may    │  🟢 79 │ 2.4s  │ 210ms│ Óptimo   │
└──────────────────┴───────────┴───────┴───────┴──────┴──────────┘
```

**¿Qué me dice el historial?**

Este ejemplo muestra algo muy importante: la página `/categoria/ramos` **estaba bien el 1 de mayo** (score 82, verde) y se fue degradando hasta llegar a 28 (rojo crítico) el 20 de mayo.

> 🔍 Cuando ves esta caída progresiva, significa que algo **se instaló o activó** en esas fechas que empeoró la web. Lo más habitual: un plugin nuevo, una actualización automática de WordPress, o imágenes que se subieron sin optimizar.

---
---

# PARTE 3 — Guía por Métricas

## 📌 El "Score" General (0 a 100)

**¿Qué es en lenguaje normal?**
Es como la nota final del examen de Google para esa página. Google usa este tipo de análisis para decidir si te muestra más arriba o más abajo en los resultados de búsqueda.

| Score | Color | Qué significa para ti |
|-------|-------|----------------------|
| 90–100 | 🟢 Verde | Excelente. Google te premia con mejor posicionamiento |
| 50–89 | 🟠 Naranja | Aceptable, pero tus competidores podrían estar por delante |
| 0–49 | 🔴 Rojo | Penalización activa. Google puede bajarte en resultados |

**¿Qué hacer si está en rojo?**

Antes de llamar a soporte, comprueba en WordPress:

1. **WP Rocket → Caché** → Pulsa el botón "**Limpiar caché**". Espera 5 minutos y vuelve a analizar la URL.
2. **WP Rocket → Estado** → Verifica que el plugin está **activo** (el interruptor debe estar en verde).
3. **WordPress → Actualizaciones** → ¿Hay actualizaciones pendientes de plugins? Una actualización automática reciente puede haber roto algo.

---

## 🖼️ LCP — "La imagen tarda mucho en cargar"

**¿Qué es en lenguaje normal?**
LCP (pronunciado "el-si-pi") mide el tiempo que tarda en aparecer **el elemento más grande** de la página — normalmente la foto principal de un producto o el banner de la portada. Es como medir cuánto tiempo tiene que esperar el cliente mirando una pantalla en blanco (o con la imagen a medias) antes de ver la página completa.

**Por qué afecta a las ventas:** Los estudios de Google demuestran que un retraso de 1 segundo en la carga reduce las conversiones en un 7%. Si una visita entra a tu tienda y tarda 5 segundos en ver el producto, **más de la mitad se marcha antes de ver el precio**.

| Tiempo | Color | Interpretación |
|--------|-------|----------------|
| Menos de 2.5 segundos | 🟢 Verde | Carga rápida — cliente satisfecho |
| Entre 2.5 y 4 segundos | 🟠 Naranja | Lento — el cliente espera, pero aguanta |
| Más de 4 segundos | 🔴 Rojo | Muy lento — alta probabilidad de abandono |

**¿Qué puedes revisar tú antes de llamar a soporte?**

Cuando el LCP está en 🔴, la causa más habitual (y que puedes resolver sin código) es una **imagen demasiado pesada**:

1. **Imagify → Imágenes sin optimizar**
   - Abre Imagify en tu panel de WordPress.
   - Busca si hay imágenes marcadas en rojo o naranja como "Sin optimizar".
   - Pulsa "**Optimizar todo**" o "**Bulk Optimize**".
   - Espera a que termine el proceso (puede tardar unos minutos si hay muchas imágenes).

2. **WP Rocket → Caché de imágenes**
   - Ve a WP Rocket → Pestaña "**Media**".
   - Comprueba que "**LazyLoad de imágenes**" está activado (debería tener el interruptor en azul).

3. **¿Subiste fotos de productos recientemente?**
   - Las fotos tomadas con móvil moderno pueden pesar 5-15 MB cada una — eso es demasiado para una web.
   - Si subiste fotos nuevas y el LCP empeoró el mismo día, esa es la causa.
   - Solución: vuelve a Imagify y optimiza las imágenes recientes.

---

## ⏱️ TBT — "La página se queda 'congelada'"

**¿Qué es en lenguaje normal?**
TBT (Total Blocking Time) mide el tiempo durante el que la página carga visualmente pero **no responde a los clics**. El cliente ve la tienda, intenta pulsar "Añadir al carrito" o un filtro... y no pasa nada. La página está "atascada" procesando código en segundo plano.

**Por qué afecta a las ventas:** Si el botón de compra no responde durante casi un segundo, el cliente piensa que la web está rota y abandona.

| Tiempo | Color | Interpretación |
|--------|-------|----------------|
| Menos de 300 ms | 🟢 Verde | Respuesta instantánea — experiencia fluida |
| Entre 300 y 600 ms | 🟠 Naranja | Retraso perceptible — molesta pero no bloquea |
| Más de 600 ms | 🔴 Rojo | Bloqueo severo — alta probabilidad de abandono |

**¿Qué puedes revisar tú antes de llamar a soporte?**

El TBT alto casi siempre se debe a **demasiados plugins cargando código** a la vez, especialmente en páginas de WooCommerce con filtros:

1. **JetSmartFilters → Ajustes de caché de AJAX**
   - Abre JetSmartFilters en WordPress.
   - Busca la opción "**Caché de consultas AJAX**" y verifica que está activada.
   - Si los filtros de tu catálogo se actualizaron recientemente, desactívalos y actívalos de nuevo para refrescar la caché.

2. **WP Rocket → Optimización de archivos JS**
   - Ve a WP Rocket → Pestaña "**Optimización de archivos**".
   - Comprueba que "**Minificación de JavaScript**" y "**Cargar JavaScript de forma diferida**" están activos.
   - ⚠️ Si los activaste recientemente y el TBT empeoró, puede ser que un plugin no sea compatible. En ese caso, desactiva "Cargar JS de forma diferida" y avisa a soporte.

3. **¿Instalaste un plugin nuevo esta semana?**
   - Cada plugin nuevo puede añadir código JavaScript que ralentiza la página.
   - Anota qué plugins se instalaron o actualizaron en las mismas fechas en que el TBT empeoró (usa el historial de Reports para comparar fechas).

---

## 👁️ CLS — "Los botones se mueven solos"

**¿Qué es en lenguaje normal?**
CLS (Cumulative Layout Shift) mide si los elementos de la página **saltan de sitio** mientras carga. Imagina que el cliente está a punto de pulsar "Confirmar pedido" y en ese momento aparece un banner publicitario que empuja el botón hacia abajo — el cliente pulsa en otro sitio sin querer.

**Por qué afecta a las ventas:** Además de ser frustrante, un CLS alto causa errores de pedido involuntarios y genera desconfianza en la tienda.

| Puntuación | Color | Interpretación |
|-----------|-------|----------------|
| Menos de 0.1 | 🟢 Verde | Diseño estable — nada se mueve |
| Entre 0.1 y 0.25 | 🟠 Naranja | Algunos elementos se desplazan levemente |
| Más de 0.25 | 🔴 Rojo | Saltos visibles y molestos |

**¿Qué puedes revisar tú antes de llamar a soporte?**

1. **¿Añadiste un banner o pop-up nuevo?**
   - Banners de cookies, pop-ups de descuento o anuncios que aparecen tarde son la causa más común de CLS.
   - Si instalaste un plugin de pop-ups recientemente, prueba a desactivarlo temporalmente y analiza de nuevo.

2. **WooCommerce → Imágenes de productos sin dimensiones**
   - En el catálogo de WooCommerce, entra en un producto y revisa si la imagen principal tiene tamaño definido.
   - Las imágenes sin dimensiones hacen que la página "salte" cuando se cargan.
   - Solución: asegúrate de que todas las fotos de producto tienen el mismo formato y tamaño (soporte técnico puede configurar esto automáticamente).

3. **Fuentes personalizadas que tardan en cargar**
   - Si cambiaste la tipografía de la tienda recientemente, puede estar causando que el texto cambie de tamaño al cargar.
   - Avisa a soporte indicando la fecha del cambio.

---

## 🌐 TTFB — "El servidor tarda en responder"

**¿Qué es en lenguaje normal?**
TTFB (Time To First Byte) mide cuánto tarda el servidor de tu tienda en **empezar a enviar la página** al navegador del cliente. Es como el tiempo de espera en un restaurante: antes de que te traigan la comida, primero tienen que tomarte nota. Si el camarero tarda demasiado en acercarse, ya estás con mal pie.

**Por qué afecta a las ventas:** Un TTFB alto afecta a absolutamente todas las páginas de la tienda. Si el servidor va lento, todo va lento — y Google lo penaliza directamente en el posicionamiento.

| Tiempo | Color | Interpretación |
|--------|-------|----------------|
| Menos de 800 ms | 🟢 Verde | Servidor rápido — respuesta excelente |
| Entre 800 ms y 1.8 s | 🟠 Naranja | Servidor algo lento — revisar caché |
| Más de 1.8 s | 🔴 Rojo | Servidor muy lento — posible problema de hosting o caché apagada |

**¿Qué puedes revisar tú antes de llamar a soporte?**

1. **WP Rocket → Caché de páginas (lo primero siempre)**
   - Ve a WP Rocket → Panel principal.
   - Pulsa "**Limpiar y reconstruir caché**".
   - Espera 5 minutos — WP Rocket empezará a cachear las páginas conforme las visiten los usuarios.
   - Analiza de nuevo en el WPO Engine.

2. **¿El TTFB está en rojo en TODAS las URLs?**
   - Si todas las páginas tienen TTFB rojo al mismo tiempo, el problema es del servidor (no de un plugin concreto).
   - Esto puede indicar que el servidor de hosting está saturado — consulta el panel de tu proveedor de hosting para ver el uso de recursos o llama directamente a soporte.

3. **¿Hay una campaña de email marketing activa?**
   - Si acabas de enviar un email masivo a tu base de clientes y el TTFB subió al mismo tiempo, el tráfico puntual puede haber saturado el servidor.
   - En ese caso, el problema se resolverá solo en unas horas cuando baje el pico de visitas.

---
---

# PARTE 4 — Preguntas Frecuentes

### ❓ "El WPO Engine muestra rojo pero la web me parece que carga bien, ¿me fío?"

Sí, fíate del WPO Engine. Los análisis se hacen simulando una conexión de móvil estándar (4G lento), que es como la mayoría de tus clientes navegan desde el teléfono. En tu ordenador de oficina, con fibra óptica, todo parece rápido — pero no es la realidad de tu cliente en el metro o en el campo.

---

### ❓ "Hice lo que dice la guía y sigue en rojo, ¿qué hago?"

Envía a soporte técnico esta información:
1. Captura de pantalla del WPO Engine con el color rojo.
2. La URL exacta afectada.
3. Qué pasos de esta guía seguiste y cuándo.
4. Si instalaste o actualizaste algún plugin en los últimos 15 días.

Con esa información, el equipo técnico puede diagnosticar el problema en minutos en lugar de horas.

---

### ❓ "¿Con qué frecuencia debería revisar el WPO Engine?"

| Frecuencia | Para qué |
|------------|---------|
| **Cada lunes** | Revisar el Dashboard de un vistazo — si todo está en verde, continúa tu semana |
| **Después de instalar un plugin** | Analizar las páginas principales para ver si algo empeoró |
| **Antes de una campaña importante** | Verificar que la tienda está en verde antes de enviar emails o publicar anuncios |
| **Si hay quejas de clientes** | Revisar Reports para ver si el problema es puntual o persistente |

---

### ❓ "¿Qué es un 'Baseline'?"

En el WPO Engine verás a veces la opción de marcar un análisis como **Baseline** (línea base). Es como hacer una foto del estado actual de la web para comparar después. Si después de una actualización las métricas empeoran, el sistema te mostrará exactamente cuánto empeoró respecto a ese punto de referencia.

**Recomendación:** Marca un Baseline cuando todo esté en verde, especialmente antes de hacer cambios importantes en la tienda.

---

## 🆘 Resumen de Acciones Rápidas

| Ves esto en pantalla | Primera acción en WordPress |
|---------------------|----------------------------|
| 🔴 Score < 50 en varias páginas | WP Rocket → Limpiar caché completa |
| 🔴 LCP > 4s en páginas de producto | Imagify → Optimizar todas las imágenes |
| 🔴 TBT > 600ms en páginas de catálogo | Verificar que JetSmartFilters tiene caché activa |
| 🔴 CLS > 0.25 en cualquier página | ¿Pop-up o banner nuevo esta semana? Desactívalo y analiza |
| 🔴 TTFB > 1.8s en TODAS las páginas | WP Rocket → Reconstruir caché, o avisar al hosting |
| 🟠 Score entre 50 y 89 | Nada urgente — apuntar para la próxima revisión técnica |
| 🟢 Score > 90 en todo | ¡Perfecto! Solo revisa tras la próxima actualización de plugins |

---

*Documento generado para uso interno del equipo de gerencia y marketing.*
*Versión: mayo 2026 — WPO Analytics Engine v2.0.0*

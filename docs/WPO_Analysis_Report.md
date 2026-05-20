# Análisis de Mercado WPO — Fundamentos y Posicionamiento

> Este documento recoge el análisis técnico comparativo de las principales herramientas del mercado WPO que motivó el diseño del motor de auditoría propio. Es un documento de referencia estratégica, no de implementación.

---

## 1. Herramientas analizadas y su metodología de throttling

La principal fuente de variabilidad en las métricas Lighthouse es cómo cada herramienta simula las condiciones de red y CPU del usuario final. No todas las herramientas utilizan el mismo método, lo que hace que los resultados no sean directamente comparables entre plataformas.

| Herramienta | Método de throttling | Nivel de precisión | Limitación principal |
|-------------|---------------------|-------------------|---------------------|
| **WebPageTest** | Packet-Level (`dummynet`/`netem`) a nivel de kernel | ★★★★★ Máximo | Costoso de escalar; requiere infraestructura dedicada |
| **Lighthouse CI** | Simulated Throttling (motor Lantern) — cálculo algorítmico | ★★★☆☆ Medio | Falsos positivos con lazy-loading agresivo o galerías JS pesadas |
| **GTmetrix** | Latencia simulada vía Chrome DevTools Protocol (CDP) | ★★★☆☆ Medio | No frena a nivel de hardware; obvia cuellos TCP/SSL |
| **SpeedCurve** | Agentes distribuidos en AWS EC2 | ★★★★☆ Alto | Sensible al ruido de computación en nube compartida |

---

## 2. Cuellos de botella en entornos WordPress/WooCommerce

Las herramientas SaaS presentan limitaciones específicas cuando se auditan sitios WordPress complejos:

### 2.1 Heartbeats y peticiones de fondo de WordPress

WordPress genera peticiones periódicas a `admin-ajax.php` (Heartbeat API) durante la carga de página. Estas peticiones son ajenas al ciclo vital de renderizado pero interfieren con el criterio "Network Idle" de Lighthouse, provocando timeouts o mediciones infladas en herramientas que no las filtran.

### 2.2 Rate-limits en auditorías masivas

Las plataformas SaaS imponen concurrencia artificial. Auditar 50+ URLs requiere reintentos complejos o consumir licencias premium que encarecen el proceso para equipos con muchos sitios bajo gestión.

### 2.3 Bloqueo por WAF en entornos de staging

Los WAFs (Web Application Firewall) de WooCommerce frecuentemente bloquean las IPs de las granjas de servidores de GTmetrix y similares. Esto hace imposible auditar entornos privados o de preproducción sin configurar excepciones de seguridad.

### 2.4 Timeout en cargas asíncronas persistentes

GTmetrix interrumpe forzosamente las peticiones a los 2 minutos. Algunas arquitecturas WooCommerce con plugins de filtrado (JetSmartFilters, FacetWP) generan peticiones AJAX que superan este límite.

---

## 3. Por qué un motor propio

El motor de WPO Analytics Engine resuelve los tres problemas anteriores en el contexto específico de tiendas WordPress/WooCommerce gestionadas internamente:

**GAP 1 — Imposibilidad de auditar entornos privados**
Al ejecutarse localmente en la máquina del auditor, el motor puede alcanzar entornos de staging protegidos por VPN o autenticación HTTP básica sin configuraciones adicionales.

**GAP 2 — Falsos positivos por Simulated Throttling**
El motor ejecuta Chrome real con throttling de CPU y red configurado vía flags de `chrome-launcher`, midiendo el renderizado real en lugar de calcularlo algorítmicamente.

**GAP 3 — Falta de trazabilidad histórica**
Las herramientas SaaS ofrecen snapshots puntuales. Este motor persiste cada auditoría en SQLite y permite comparar contra una baseline marcada por el usuario, detectando regresiones introducidas por actualizaciones de plugins.

---

## 4. Estrategia de mitigación de ruido

Para obtener métricas estables en entornos WordPress, el motor aplica las siguientes decisiones de diseño:

- **Concurrencia máxima 1:** Una sola instancia de Chrome activa en cada momento. Elimina el ruido autoinducido por hyperthreading cuando se corren múltiples instancias en paralelo.
- **`onlyCategories: ['performance']`:** Solo se ejecutan las auditorías de rendimiento de Lighthouse. Las categorías de accesibilidad, SEO y best-practices se omiten para reducir el tiempo de ejecución y el consumo de memoria.
- **Flags de Chrome antiruido:** `--headless=new`, `--disable-dev-shm-usage`, `--disable-gpu` — impiden condiciones de carrera en sistemas con recursos limitados.
- **Scoring basado en umbrales discretos (cliente):** En lugar de usar el scoring numérico interno de Lighthouse (que varía entre ejecuciones), el motor aplica una heurística propia basada en los umbrales "Good/Needs Improvement/Poor" publicados por Google para Core Web Vitals. Esto hace los resultados más estables y explicables para audiencias no técnicas.

---

## 5. Umbrales de Core Web Vitals de referencia

Los umbrales utilizados en el motor están alineados con los publicados por Google para la iniciativa [Core Web Vitals](https://web.dev/vitals/):

| Métrica | Bueno | Necesita mejora | Pobre |
|---------|-------|----------------|-------|
| LCP (Largest Contentful Paint) | < 2.5 s | 2.5–4 s | > 4 s |
| TBT (Total Blocking Time) | < 300 ms | 300–600 ms | > 600 ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1–0.25 | > 0.25 |
| TTFB (Time To First Byte) | < 800 ms | 800–1800 ms | > 1800 ms |

> **Nota sobre el scoring del motor:** La heurística de puntuación (0-100) del motor es una aproximación simplificada a los umbrales anteriores, no una replicación exacta del algoritmo de Lighthouse. Ver [`docs/technical/dashboard.md`](./technical/dashboard.md#heurística-de-scoring-cliente) para la fórmula exacta.

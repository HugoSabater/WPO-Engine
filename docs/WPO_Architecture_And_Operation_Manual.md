# WPO Analytics Engine: Manual Arquitectónico y Operativo

Este documento consolida "Cómo funciona la aplicación web hoy (V2)", qué hacer para usarla de manera efectiva según sus límites de infraestructura, y el inventario del ecosistema (features disponibles y pendientes).

---

## 1. Nivel Arquitectónico (¿Qué se ha añadido hoy?)

El ecosistema frontend de React ha sido refactorizado y desconectado del formato de listado crudo. Ha migrado a una **Single Page Application (SPA)** propulsada por un router nativo.

### Componentes de React Centrales Agregados

*   **`Layout` / Global Wrapper:** Se ha establecido un enrutador global que mantiene fijos ciertos estados en los redibujados, evitando que la aplicación entera "parpadee".
*   **`TopBar` (Navegación):** Módulo superior que agrupa la estructura de pantallas y provee feedback visual activo (color `:active` vs `:hover`). Alberga la navegación en subrutas: 
    *   *Dashboard Core* (Auditoria y Comparativa)
    *   *Site Explorer / Crawler* (Sitemaps)
    *   *Automations* (Cronbots)
    *   *Reports* (Generación visual PDF/TXT).
*   **`HUD` en Tiempo Real:** Interfaz fija en el Layout (Head-Up Display) que orquesta las lecturas mediante *Polling* (ping periódico asíncrono) para verificar las longitudes de las colas de Redis y SQLite sin matar el servidor mediante *sockets* persistentes complejos.

---

## 2. Cómo Funciona el Flujo de la Plataforma (Bajo el capó)

A pesar de que utilicemos una vista visual cómoda, el motor tras las cortinas ejerce fuerza industrial:

1.  **Frontend (React On-Demand):** El operador introduce URLs. El SPA inyecta esta demanda por HTTP POST al microservicio Node ("Orquestador").
2.  **API Node (Orquestador Defensivo):** Node valida el volumen de la carga. Si pasa, inyecta la URL en una lista de espera de la memoria RAM (Redis) empleando BullMQ. Finaliza la petición HTTP con un `202 Accepted` que libera el navegador del operador.
3.  **El Worker Asesino (Lighthouse Puppeteer):** Un proceso secundario asíncrono, corriendo Headless Chrome, chupa las tareas de RAM progresivamente (Max. Concurrencia de 1 o 2 hilos máximos para no auto-sabotear la CPU del host). Renderiza, captura, computa TBT y guarda un resultado estructurado persistente en SQLite DB y un `.jpg` en disco estático.
4.  **HUD Fetching Loop:** Mientras pasa lo anterior, el componente HUD que has desplegado en React hace peticiones de consulta (Polling cada X milisegundos) para hidratar las gráficas cuando SQLite anuncia que hay data fresca.

---

## 3. ¿Qué hacer para usarlo bien? (Best Practices)

Técnicas vitales para operadores del sistema y programadores front-end al ejecutar el Crawler Web.

### ⚠️ Regla de Oro: El Límite Concurrente
Para "usarlo bien", uno debe entender que Google Chrome es el software más depredador de RAM del mundo. Llenar la cola con 1.000 URLs destruirá de forma violenta los subprocesos _Zombie_. Utiliza siempre la sección de Autómata (Cron) para espaciar los paquetes masivos programados. No realices _Spam_ manual.

### 📊 Baseline Parámetrico: Entrenando los Modelos
Interpretar el *Baseline* no es mirar colores verdes. 
*   Siempre ejecuta test aislados en dispositivo **Mobile** por defecto. Un TBT (Total Blocking Time) Desktop de 100ms puede explotar a 4,500ms en Mobile (3G retardado). 
*   **Calentamiento de Caché:** Jamás tomes en cuenta el primer escaneo si WooCommerce usa sistemas de Redis/Varnish-Cache. Lanza un escaneo manual "basura", deja que la caché de WP muerda el servidor, purga tu medición, e inicia un Escaneo Maestro formalmente para aislar y fijar tu verdadero "Baseline".

---

## 4. ¿Qué falta por implementar? (Features Pendientes Core)

Para escalar exitosamente desde este punto base (SPA Routing) hacia Inteligencia real, nos faltan construir las siguientes áreas en nuestro Stack:

*   **Purgador (Garbage Collector):** Escribir la lógica en el Orchestrator para borrar periódicamente el volumen de imágenes desfasadas y filas SQLite mayores a 30 días (`TTL Wipe`). Sin esto, el Droplet morirá ahogado de almacenamiento SSD eventualmente.
*   **Rate-Limiter Dinámico:** Programar latencias en BullMQ basadas en DNS. Ejecutar dos URLs del mísmo dominio (`misitio.com/1` y `misitio.com/2`) dentro del mismo segundo colapsa un WordPress en PHP-FPM. Faltan *Delays* forzados entre cada URL de un mismo host.
*   **Auto-Extractor XML:** Un Endpoint en Node capaz de parsear una URL `/sitemap_index.xml` gigantesca, subdividirla en URLs individuales (Productos), y prepararlas para encolado masivo.
*   **Reportes PDF Visuales:** Vincular la pestaña *Reports* en el SPA para compilar las auditorías en ficheros estáticos descargables atractivos desde librerías nativas (`html2pdf` o similares).

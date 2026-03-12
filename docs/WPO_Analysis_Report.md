# Reporte Analítico y Estrategia de Plataforma WPO Interna

A partir del análisis de las principales soluciones WPO del mercado (Lighthouse CI, GTmetrix, SpeedCurve, WebPageTest), hemos identificado deficiencias críticas en la evaluación de sitios complejos construidos en **WordPress / WooCommerce**.

A continuación se detalla cómo gestionan el ruido estas herramientas, sus cuellos de botella y nuestro **Plan de Arquitectura Interna** basado en contenedores Docker para explotar estos _gaps_.

---

## 1. Análisis de Mercado: Gestión de Fluctuación y Variabilidad de Red

- **WebPageTest (WPT):** Estándar de la industria. Usa _Packet-Level Throttling_ a nivel operativo (dummynet/netem) mitigando fluctuaciones de protocolo. Es preciso, pero costoso de escalar.
- **Lighthouse CI (LHCI):** Utiliza _Simulated Throttling_ (Motor Lantern) calculando algorítmicamente el rendimiento basado en una carga rápida. Mitiga ruido ejecutando secuencias y extrayendo la mediana (P50/P75).
- **GTmetrix:** Aplica latencia simulada desde el Protocolo de Chrome (CDP). No frena a nivel de hardware, sino a nivel de petición, obviando los cuellos de TCP/SSL.
- **SpeedCurve:** Emplea agentes distribuidos en AWS (EC2) y mitiga varianzas forzando pruebas impares y detectando anomalías, pero es muy sensible al ruido de computación en la nube compartida.

## 2. Cuellos de Botella Técnicos en Ejecuciones Masivas (50+ URLs)

- **Contención de Recursos:** LHCI escalar con _headless Chrome_ paralelo satura CPU/RAM, provocando ruidos autoinducidos severos en los servidores de CI (afectados por Hyperthreading).
- **Rate-Limits y Cuotas:** Enfoques SaaS como GTmetrix/SpeedCurve poseen estricta concurrencia artificial, forzando a reintentos complejos o agotar costosas licencias premium.
- **Firewalls / Entornos Privados:** WAFs bloquean IPs de estas granjas WPO en entornos locales / _staging_. Además, GTmetrix interrumpe forzosamente peticiones a los 2 minutos, un desastre para cargas asíncronas persistentes.

---

## 3. Identificación de "Gaps" (Oportunidad para Herramienta Interna)

Estos tres vados técnicos son nuestro punto de ataque estratégico para un **entorno WooCommerce**:

1.  **GAP 1: Imposibilidad de Aislamiento y Throttling Real en Local.**  
    WPT exige puentes de red físicos para probar un localhost.  
    _Táctica DAW:_ Usaremos contenedores Docker asilados implementando `netem` a nivel de _namespace_ de red. Sin interferencias, podemos someter al entorno WooCommerce a limitación de paquetes real.

2.  **GAP 2: Falsos Positivos LCP (Motor Lantern).**  
    Simular cargas falla ante _lazy-loading_ agresivo o galerías JS pesadas.  
    _Táctica DAW:_ Descartar algoritmos de simulación; mediremos renderizados directos y reales con Puppeteer controlando latencias nativas del SO dentro del contenedor.

3.  **GAP 3: Fragilidad por "Network Idle" en Tareas WP Segundo Plano.**  
    Heartbeats (`admin-ajax.php`) o píxeles infinitos rompen LHCI o GTmetrix provocando "Timeouts".  
    _Táctica DAW:_ Forzar lógicas de terminación (`page.evaluate`) que descarten peticiones ajenas al ciclo vital de renderizado. Aplicaremos métricas mediante el "Percentil 75" para depurar resultados deficientes y no invalidar todo el lote.

---

## 4. Plan de Arquitectura y Estructura DAW Docker

Para ejecutar esta plataforma propia en las herramientas de nuestro Centro de Mando, procedemos a plantear la infraestructura:

### Estructura de Carpetas

```text
c:.../tools/wpo-engine/
├── api/                        # API Orchestrator (Node.js/Express)
│   └── src/                    # Orquestación de auditorías y BullMQ
├── worker/                     # Lighthouse Runner (Puppeteer Service)
│   └── src/                    # Motor de ejecución y captura LCP
├── frontend/                   # Dashboard (React/Vite/Tailwind)
├── docs/                       # Documentación Técnica y Reportes
├── docker-compose.yml          # Orquestación de Microservicios
├── .gitignore                  # Reglas de exclusión (Node/DB/Env)
├── README.md                   # Manual de usuario y arquitectura
└── LICENSE                     # MIT License
```

### Componentes y Lógica Implementada

1.  **Orquestador de Nodos (Docker Runner con `tc/netem`):**
    - **Lógica:** Crear una imagen base con capacidad de controlar su propio tráfico de red (`iproute2`). El script Puppeteer desactivará cualquier _simulated throttling_ y usaremos la red real degradada del contenedor para atacar el frontend local de la app real WordPress.
2.  **Gestor de Colas y Tolerancia a Fallos (Backend Node.js):**
    - **Lógica:** Exponer una API que reciba listas masivas (50 URLs). Introducirlas en `BullMQ` (Redis). Cada Job levantará instancias controladas, monitorizando timeouts, descartando peticiones esporádicas de WP (ajax) de los _Network Idles_, y agrupando las respuestas (10 iteraciones por URL).
3.  **Filtrado Matemático y Dashboard:**
    - **Lógica:** Aplicar una desviación y obtener el _Percentil 75 (P75)_, descartando el ruido sistemático de hardware o hiperhilos. El Dashboard mostrará la métrica fidedigna junto a las recomendaciones sugeridas por el contenedor de Inteligencia Artificial (basado en reglas de buenas prácticas WPO).

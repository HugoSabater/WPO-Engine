# WPO Analytics Engine: Roadmap Técnico y Ágil

Este documento detalla la estrategia de evolución del software. Abandonamos la planificación trimestral clásica para adoptar un modelo ágil por **Sprints**, priorizando la estabilidad de la infraestructura y la automatización segura.

---

## 🚀 Sprint 1: Refactorización de Infraestructura y Estabilidad

**Objetivo:** Evitar el colapso de la base de datos y la saturación del servidor.

- ~~**1.1 Migración de Storage (Adiós Base64):**~~
  - ~~Modificar el Worker para que guarde los pantallazos (`.jpg` optimizados) directamente en un Volumen Mapeado de Docker.~~
  - ~~La base de datos SQLite solo almacenará la ruta estática (ej. `/screenshots/url-123.jpg`).~~
- **1.2 Garbage Collector (TTL de Datos):**
  - Implementar un sistema de limpieza automática. Los escaneos regulares y sus imágenes asociadas con más de 30 días de antigüedad serán eliminados físicamente del disco y de SQLite para evitar errores _Out Of Memory_ (OOM).

---

## ⚙️ Sprint 2: Automatización Segura (El Crawler)

**Objetivo:** Analizar la web completa sin tirar el servidor del cliente.

- **2.1 Smart Sitemap Discovery:**
  - Lógica para leer automáticamente el `sitemap.xml` y extraer URLs clave (categorías, productos top).
- **2.2 Rate Limiting (Protección Anti-DDoS):**
  - Configurar BullMQ con un _delay_ estricto. El escaneo masivo no podrá lanzar más de 1 petición por minuto al servidor de destino para evitar tumbar la base de datos de WooCommerce durante la auditoría.
- **2.3 Cronjobs Nativos:**
  - Interfaz en el Dashboard para programar auditorías automáticas semanales en horas valle (ej. 03:00 AM).

---

## 🧠 Sprint 3: Analítica Avanzada y Transparencia

**Objetivo:** Traducir datos crudos en decisiones de negocio.

- **3.1 Changelog In-App:**
  - Creación de la vista `/changelog` en React leyendo directamente los parches del repositorio para visibilidad del usuario.
- **3.2 Regresión Asistida:**
  - Lógica comparativa: Si el LCP de hoy es 1 segundo más lento que el _Baseline_, el sistema cruzará los datos del árbol de red para señalar qué script o imagen nueva es el culpable.

---

# Qué se busca ahora

## Los puntos indispensables:

- 1. Automatizar análisis (basado en la hora y URL que se desea analizar)
- 2. Mejorar la pantalla de seleccionado. Actualmente se muestran todos los subconjuntos en el azul-destacado, no se ven las imágenes de vista previa, otros posibles pequeños defectos de UI como el no-cursiva.
- 3. Mejorar la interacción de base-line. Actualmente se ve "+0.00" o "-0.00", también quiero que se pueda diferenciar entre tipo de dispositivo (una pestaña para PC y otra para mobile).
- 4. Seleccionar cuál será el orden. Actualmente solo deja por calificación, quiero implementar que se pueda eligir entre todas las características visibles (score, TTFB, LCP, LCP, CLS, TBT, timestamp).
- 5. Añadir una información más destacada de todos los valores recolidatorios posibles del análisis dentro del seleccionado.
- 6. Cambiar el logo de navegador actual.
- 7. Añadir una descarga de información (tanto para información básica, avanzada, solo los últimos 7 días o de todo el histórico, qué tipo de dispositivo, para PDF visual o para TXT solo texto).
- 8. Revisar y desactivar errores de reanálisis. Actualmente hay búsquedas a otros URLs si se hacen re-escaneos, o puede que marque como timestamp las "01 ene, 01:00".
- Sobre la imagen de "Vista Previa", mejor eliminarlo. Y con ello eliminar los datos que hayan, para limpiar espacio de la base de datos.
- Quiero que tenga una top bar profesional con cada desplegable si cuenta con sub-elementos. Diferencia el color :hover y :selected. Qué sería obligatorio y qué recomendable añadir en esa lista de elementos?

## 🌟 Roadmap V2: Actualización de Requisitos y Ampliación UI/UX (Añadido)

**Objetivo:** Integrar directivas de navegación avanzada, eliminación de cuellos de botella de renderizado y reestructurar la lógica de reportes.

- **4.1 Patrón de Navegación "Professional Top Bar":**
  - Para la nueva barra superior, usaremos Tailwind para establecer un comportamiento estricto en estados interactivos:
    - **Color Base:** Gris corporativo/Dark Charcoal.
    - **`:hover`:** Sombra más clara e integrada (ej. `bg-gray-700/50`).
    - **`:selected` / `:active`:** Destacado de contorno o acento sutil bajo el texto para evitar distracciones.
  - **Propuesta Estructural - Nodos Obligatorios (Core Flow):**
    - **Dashboard:** La matriz principal de control (Tablas con Sorting).
    - **Auditorías** (Desplegable):
      - _Nuevo Análisis On-Demand:_ Interfaz limpia para ejecución manual.
      - _Programación (Cronbots):_ Frontend para el Roadmap 2.3 (Horas valle).
    - **Inteligencia y Baselines** (Desplegable):
      - _Gestión de Baselines:_ Configurar metas paramétricas (Móvil vs PC).
      - _Analítica Asistida:_ Vista enfocada al cruce de regresiones (Roadmap 3.2).
    - **Descargas / Exportación:** Generador dinámico de reportes (PDF/TXT).
  - **Propuesta Estructural - Nodos Recomendados (Features de Escalabilidad):**
    - **Configuración del Orquestador:** (Crucial). Gestión del _Rate Limiting_ (Roadmap 2.2) y purga de TTL (Roadmap 1.2).
    - **Changelog In-App:** Exposición del parche a negocio (Roadmap 3.1).
    - **Logs Remotos:** Visibilidad de los estados internos de Node y Puppeteer.

---

## 🗺️ Mapa de Fases de Ejecución Transversal (Roadmap V1 + V2)

**Fase 1: Purga Base y Reestructuración de UI React (Completada - V2 SPA)**

- ~~**Purga de Datos (Altera Roadmap 1.1):** Crear script de migración SQLite para lanzar un `UPDATE` masivo eliminando la cadena Base64 antigua. Cero dependencias de "Vista Previa".~~
- ~~**Construcción Top Bar:** Inyectar la barra jerárquica con _drop-downs_.~~
- ~~**Refactorización Modal "Detalles":** Limpiar fondo azul, añadir logos solicitados, quitar cursivas y montar una grid estadística potente de variables WPO crudas.~~
- ~~**Tabla de Sorting:** Lógica global para los headers interactivos de todas las columnas.~~
- ~~**Hotfixes In-Place:** Bloquear el parseador re-scan URL y el glitch Unix "01 ene".~~

**Fase 2: Backend y Estructura de Análisis Expandido**

- **Dual-Device Baselines:** Crear Schema DB paramétrico por viewport (_Mobile_ vs _Desktop_), con cálculo predictivo directo (`-0.5s` verde, `+2.0s` rojo).
- **Limpieza de Ruido Activa / TTL (Integra Roadmap 1.2):** Cronjob inaudible que desintegra huella de datos de +30 días en SQLite.
- **Exportación Avanzada:** Integrar generación en 2 formatos filtrables (Basic TXT, Advanced Visual PDF estructurado).

**Fase 3: Automatización Segura Cero-DDoS (El Crawler)**

- **Cronjobs Scheduling (Integra Roadmap 2.3):** Backend interface para rangos horarios de auto-escaneo.
- **Rate Limiting BullMQ (Integra Roadmap 2.2):** Configurar latencia agresiva (N peticiones / X tiempo) para prevenir caídas de servidores.
- **Smart Sitemap Discovery (Integra Roadmap 2.1):** Pipeline de extracción XML para precargar colas de análisis masivo.
- **Regresión Analítica Asistida (Integra Roadmap 3.2):** Computación en Node para notificar caídas comparativas pre-vs-post en endpoints WordPress.
- **Changelog In-App (Integra Roadmap 3.1):** Hook de versionado visible en UI.

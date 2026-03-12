# WPO Analytics Engine: Roadmap Técnico y Ágil

Este documento detalla la estrategia de evolución del software. Abandonamos la planificación trimestral clásica para adoptar un modelo ágil por **Sprints**, priorizando la estabilidad de la infraestructura y la automatización segura.

---

## 🚀 Sprint 1: Refactorización de Infraestructura y Estabilidad
**Objetivo:** Evitar el colapso de la base de datos y la saturación del servidor.

* **1.1 Migración de Storage (Adiós Base64):**
  * Modificar el Worker para que guarde los pantallazos (`.jpg` optimizados) directamente en un Volumen Mapeado de Docker.
  * La base de datos SQLite solo almacenará la ruta estática (ej. `/screenshots/url-123.jpg`).
* **1.2 Garbage Collector (TTL de Datos):**
  * Implementar un sistema de limpieza automática. Los escaneos regulares y sus imágenes asociadas con más de 30 días de antigüedad serán eliminados físicamente del disco y de SQLite para evitar errores *Out Of Memory* (OOM).

---

## ⚙️ Sprint 2: Automatización Segura (El Crawler)
**Objetivo:** Analizar la web completa sin tirar el servidor del cliente.

* **2.1 Smart Sitemap Discovery:**
  * Lógica para leer automáticamente el `sitemap.xml` y extraer URLs clave (categorías, productos top).
* **2.2 Rate Limiting (Protección Anti-DDoS):**
  * Configurar BullMQ con un *delay* estricto. El escaneo masivo no podrá lanzar más de 1 petición por minuto al servidor de destino para evitar tumbar la base de datos de WooCommerce durante la auditoría.
* **2.3 Cronjobs Nativos:**
  * Interfaz en el Dashboard para programar auditorías automáticas semanales en horas valle (ej. 03:00 AM).

---

## 🧠 Sprint 3: Analítica Avanzada y Transparencia
**Objetivo:** Traducir datos crudos en decisiones de negocio.

* **3.1 Changelog In-App:**
  * Creación de la vista `/changelog` en React leyendo directamente los parches del repositorio para visibilidad del usuario.
* **3.2 Regresión Asistida:**
  * Lógica comparativa: Si el LCP de hoy es 1 segundo más lento que el *Baseline*, el sistema cruzará los datos del árbol de red para señalar qué script o imagen nueva es el culpable.

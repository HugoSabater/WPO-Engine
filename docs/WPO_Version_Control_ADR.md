# WPO Engine: Histórico de Versiones y Decisiones (ADR)

Este documento funciona como Control de Versiones Transversal y Registro de Decisiones de Arquitectura (ADR). Registra el "estado previo vs estado actual" por cada *Feature* crítica, explicando el "por qué" de cada refactorización importante del WPO Analytics Engine.

---

## 🚀 Feature: Arquitectura Frontend y Orquestación UI

**Estado Base (Legado / V1): Monolito Acoplado**
*   **Qué existía:** El Frontend operaba sobre pantallas monolíticas. La visualización de subconjuntos ("azul-destacado") solapaba todos los registros a la vez, congestionando el DOM. No existía separación clara entre "ver históricos" y "lanzar auditorías". 
*   **Problemas Causa:** Lentitud severa al hacer *Sorting*, falta de fluidez en la interfaz al carecer de enrutamiento del lado del cliente, exceso de componentes que provocaban *re-renders* innecesarios, y desorientación del usuario del negocio.

**Estado Actual (V2): SPA y TopBar Navigation**
*   **Decisión Arquitectónica:** Migrar completamente a una Single Page Application (SPA) modularizada con React/Vite.
*   **Implementación y Mejoras:** 
    *   **Navegación Global:** Integración de un módulo robusto de `TopBar` estandarizando jerarquías. Los módulos son instanciados condicionalmente (`Dashboard`, `Automations`, `Sitemap Crawler`, `Reports`).
    *   **Separación de Responsabilidades:** Extracción del monitor de colas de Puppeteer a un modulo dedicado llamado `HUD` (Queue Monitor / HUD en tiempo real) y abstracción de la lógica del orquestador en un layout persistente.

---

## 📡 Feature: Asincronía, Comunicación y Notificaciones (Polling)

**Estado Base (Legado / V1): Refresh Estático**
*   **Qué existía:** El cliente, una vez mandaba una orden POST de escaneo de LH, tenía que recargar la página contínuamente (F5) para rogar a la BD SQLite si el Worker había finalizado la escritura. Era ciego.
*   **Problemas Causa:** Falsos positivos, solapamientos, riesgo de saturación de la API Node mediante peticiones huérfanas humanas masivas, desgaste de la experiencia de usuario (UX).

**Estado Actual (V2): Active Queue HUD Polling**
*   **Decisión Arquitectónica:** Desarrollar un "HUD en vivo" inyectado nativamente en el layout de la SPA.
*   **Implementación y Mejoras:**
    *   El `TopBar` ahora respira conectando con Redis/Node de fondo (vía polling regulado asíncrono o socketing virtual).
    *   Implementación de estados de transición: *Queueing*, *Processing* y *Complete*. El frontend alerta visualmente de la progresión del BullMQ sin tener que bloquear el hilo de navegación.

---

## 🗄️ Feature: Procesamiento de Imágenes y Payload de Base de Datos

**Estado Base (Legado / V1): Colapso Base64 en Memoria (Ditched)**
*   **Qué existía:** El Puppeteer Worker generaba un pantallazo ultra-resolutivo in-memory, lo convertía a una inmensa cadena Base64 pura y lo inyectaba agresivamente en la columna de un SQLite crudo.
*   **Problemas Causa:** Las cadenas de 18MB reventaban el _Write-Ahead Logging_ de disco. Retornar el historial de JSON vía GET desde Node crasheaba la memoria RAM del droplet, provocando picos letales y Out Of Memory (OOM).

**Estado Actual (V2): Mapeo Volumétrico Estático**
*   **Decisión Arquitectónica:** Desechar el renderizado `Base64` al vuelo y refactorizar a imágenes JPG comprimidas residentes en Volumen.
*   **Implementación y Mejoras:**
    *   El Worker de Node guarda el archivo .jpg en una ruta designada mapeada por Docker.
    *   La base de datos (SQLite) retiene únicamente la ruta de texto estática URI del archivo (`/screenshots/ID_123.jpg`).
    *   **Baseline Interaction:** Implementación de métricas divisorias (+0.00ms) aisladas para diferenciar perfiles Desktop y Mobile nativamente sin ahogar memoria con capturas pesadas.

---

## ⌛ Feature: Control Automatizado (Roadmap Péndula)

*   **Estado Base:** Lanzamientos 1 a 1 de manera manual. Desprotegido frente a recargas de _rate-limiting_.
*   **Actual & Futuro (Feature V2.5):** Adopción escalonada en el nuevo módulo "Automations" del SPA, donde el usuario agenda los disparadores masivos. Protección Cero-DDoS impidiendo inyectar ráfagas de Peticiones LH hacia el objetivo de la auditoría.

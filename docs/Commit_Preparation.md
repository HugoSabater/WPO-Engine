# Preparación de Commit (Draft - Dry-Run)

El Arquitecto ejecutará el respectivo comando a través de OpenCode haciendo uso de la siguiente taxonomía de control de versión estandarizada (Conventional Commits):

---

**Comando Terminal a inyectar (Futuro):**
```bash
git add docs/
git commit -m "docs: wpo engine full documentation overhaul via V2 SPA architecture" -m "Agrega control de versiones transversal (ADR) y manuales operativos consolidando la refactorización reciente a una SPA orientada a navegación (TopBar) y Polling. Abandona esquemas Base64 y documenta el pipeline BullMQ/Puppeteer."
```

**Estructura Semántica (Changelog Final):**
- `feat(docs):` Añadir Histórico y Control de Versiones `WPO_Version_Control_ADR.md`.
- `feat(docs):` Añadir Manual Operativo e Infraestructura `WPO_Architecture_And_Operation_Manual.md`.
- `chore(docs):` Actualización de la documentación preparatoria para ser trazable.

---

> [!TIP]
> Arquitecto: Utiliza las utilidades de línea de comando nativas o la interfaz VSC cuando determines que este paquete documental ya cumple con nuestro grado de exigencia corporativo local. No inyectaré el código por precaución a tu entorno de terminal, salvo que lo ordenes exepcionalmente con `/construir-plan` o `OpenCode CLI`.

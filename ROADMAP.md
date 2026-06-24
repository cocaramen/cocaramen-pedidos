# Roadmap — Cocaramen

Prioritized backlog. Pick from the top. When a feature ships, move it to
**Done** and update the `project-status` memory.

Legend: 🔴 alta · 🟡 media · 🟢 baja · ⏳ en progreso

_Última actualización: 2026-06-23_

---

## ✅ Done (MVP)
- Esquema DB + migraciones + seed idempotente.
- Capacidad blanda + flujo "Confirmar de todos modos" + flags de override.
- Dashboard operativo (capacidad diaria/franja, agrupado por franja, indicadores).
- Pedidos: crear / editar / **duplicar** / eliminar, búsqueda + filtros + orden.
- Cambio rápido de estado (máquina de estados).
- Settings: capacidad, días de entrega, tipos de caldo, franjas.
- Auth (dev + Supabase), rutas protegidas.
- Tests (30 unit + 4 integración), lint/typecheck/build limpios.
- Docker (dev + prod), README, despliegue Vercel + Supabase.

---

## 🔜 Próximo (sugerido)

### 🔴 Operación diaria
- [ ] **Estado pagado / no pagado** + método de pago por pedido (campo + badge + filtro).
- [ ] **Precio por tazón** (config por caldo o global) y **total del pedido**.
- [ ] **Vista para imprimir / cocina**: lista por franja con caldos y cantidades, lista para la cocina.

### 🟡 Reportes
- [ ] **Resumen de ingresos** del día/semana (requiere precio por tazón).
- [ ] **Reporte de reparto** por franja (cliente, dirección, tazones, estado).
- [ ] **Export CSV** de pedidos (con filtros aplicados).

### 🟢 Calidad de vida
- [ ] Búsqueda/auto-complete de clientes recurrentes (por teléfono/dirección).
- [ ] Indicador de "mismo edificio / misma ruta" para agrupar entregas.
- [ ] Tema oscuro (ya hay tokens CSS, falta el toggle).
- [ ] Tests E2E (Playwright) del flujo crear→aprobar→entregar.

---

## 🧱 Deuda técnica / endurecer para uso real
- [ ] **Rotar** Database Password + API keys de Supabase (pasaron por el chat) y actualizar env en Vercel.
- [x] **Control de versiones (Git)** — repo en github.com/cocaramen/cocaramen-pedidos (vía alias SSH dedicado).
- [ ] **Dominio propio** (ej. `pedidos.tudominio.com`) + plan Vercel **Pro** (uso comercial).
- [ ] Confirmación de borrado ya existe; revisar manejo de errores de red en acciones.
- [ ] Backups/auto-pausa de Supabase (free tier pausa por inactividad).

---

## Notas
- Mantener: capacidad **blanda**, switch por env, UI en español / código en inglés.
- Cada feature: validar con Zod (cliente+servidor), recalcular capacidad en servidor,
  agregar test, `npm run check`, luego `npm run deploy`.

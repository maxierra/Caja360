# Duración de la prueba gratis (trial)

## Cuándo arranca el trial

1. **Negocio creado desde la app** (`/app/setup`): se llama al RPC `create_business_with_owner`, que inserta `subscriptions` con `status = trialing` y `current_period_end = now() + subscription_trial_interval`.
2. **Negocio sin fila en `subscriptions`** (por ejemplo lo creaste a mano en Supabase con `businesses` + `memberships` pero sin `subscriptions`): al entrar a la app, el layout llama a **`ensure_subscription_trial_for_business`**, que crea la misma fila de prueba usando el intervalo **actual** de `platform_settings`.

> Los **5 minutos** no están en el código: tenés que poner `interval '5 minutes'` en `platform_settings` (ver abajo). Ese valor se usa en el momento de crear el trial (alta del negocio o al ejecutar `ensure_*`).

## Dónde se define

Tabla **`public.platform_settings`** (siempre **1 fila**, `id = 1`):

| Columna | Ejemplo | Significado |
|--------|---------|-------------|
| `subscription_trial_interval` | `7 days` | Cuánto dura el trial al **crear un negocio nuevo** (`create_business_with_owner`). |
| `updated_at` | auto | Última modificación. |

Valores válidos son intervalos de Postgres, por ejemplo:

- `interval '5 minutes'` — prueba rápida del bloqueo  
- `interval '7 days'` — producción alineada con la landing (prueba gratis 7 días)  
- `interval '3 days'` — si preferís un trial más corto  
- `interval '14 days'` — otra campaña  

Las instalaciones nuevas que siguen `schema.sql` o la migración `20260514120000_subscription_trial_seven_days.sql` quedan con **7 días** por defecto. Si tu proyecto ya existía con **3 días**, ejecutá esa migración o actualizá la fila a mano (ver más abajo).

## Probar el bloqueo en ~5 minutos

### Opción A — Solo negocios **nuevos**

En **Supabase → SQL Editor**:

```sql
update public.platform_settings
set
  subscription_trial_interval = interval '5 minutes',
  updated_at = now()
where id = 1;
```

Luego **creá un negocio nuevo** desde la app: ese negocio tendrá `current_period_end = now() + 5 minutes`.

### Migración obligatoria si falta `platform_settings`

Si ves errores como **`relation 'public.platform_settings' does not exist`**, tu base nunca tuvo esa tabla: el alta de negocio **no podía** guardar la suscripción de prueba.

Ejecutá **en un solo paso** (SQL Editor):

`supabase/migrations/20250327120000_platform_settings_bootstrap.sql`

Crea la tabla y la fila inicial y actualiza `create_business_with_owner` + `ensure_subscription_trial_for_business`. Si querés **7 días** en esa base, después ejecutá también `20260514120000_subscription_trial_seven_days.sql`.

### Función `ensure_*` sola

Si ya tenés `platform_settings` pero falta el RPC de “huérfanos”:

`supabase/migrations/20250326140000_ensure_subscription_trial.sql`

### Opción B — Negocio que **ya existe** (ajuste manual)

No hace falta recrear el negocio: ajustá la fila en `subscriptions`:

```sql
update public.subscriptions
set
  current_period_start = now(),
  current_period_end = now() + interval '5 minutes',
  updated_at = now()
where business_id = 'PONÉ_AQUÍ_TU_UUID_DE_BUSINESSES';
```

Pasados los 5 minutos, el **middleware** debería redirigir a `/app/subscription` (salvo esa ruta).

El bloqueo aplica en **dos capas**: middleware (Edge) y **`src/app/app/(main)/layout.tsx`** (servidor Node). Si el middleware fallara en Edge, el layout igual redirige a `/app/subscription` al entrar a POS, productos, dashboard, etc. **Suscripción** y **setup** están fuera de `(main)` para que puedas pagar o completar el alta.

### Valores típicos para producción

**7 días** (coincide con la landing):

```sql
update public.platform_settings
set
  subscription_trial_interval = interval '7 days',
  updated_at = now()
where id = 1;
```

Trial más corto:

```sql
update public.platform_settings
set
  subscription_trial_interval = interval '3 days',
  updated_at = now()
where id = 1;
```

## Notas

- En Supabase el Table Editor muestra `timestamptz` con **`+00` (UTC)**; es el mismo instante que en Argentina, solo otro reloj. El vencimiento del trial está en **`subscriptions.current_period_end`**, no en `businesses.created_at`.
- En la app las fechas se comparan en **UTC** con un parser seguro (`parse-db-timestamp`) para que el navegador no las interprete como hora local por error.

- La tabla tiene **RLS** sin políticas para `anon` / `authenticated`: no se expone por la API cliente; la lee el RPC `create_business_with_owner` (security definer).
- Editás valores con el **SQL Editor** (rol con permisos) o migraciones.
- **`platform_settings` no está en `.env`**: todo es en base de datos.

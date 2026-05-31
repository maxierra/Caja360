-- Alinear la duración del trial con la landing (7 días).
-- Ejecutá esta migración en proyectos que ya tienen platform_settings.

alter table public.platform_settings
  alter column subscription_trial_interval set default interval '7 days';

update public.platform_settings
set
  subscription_trial_interval = interval '7 days',
  updated_at = now()
where id = 1;

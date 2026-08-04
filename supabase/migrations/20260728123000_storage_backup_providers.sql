alter table public.storage_connections
drop constraint if exists storage_connections_provider_check;

alter table public.storage_connections
add constraint storage_connections_provider_check
check (
  provider in (
    'supabase',
    'onedrive',
    'cloudflare-r2',
    'backblaze-b2',
    'local-node'
  )
);

insert into public.storage_connections (school_id, provider, label, status, connection_ref)
select
  schools.id,
  provider.provider,
  provider.label,
  provider.status,
  provider.connection_ref
from public.schools
cross join (
  values
    ('cloudflare-r2', 'DREEM Cloudflare R2', 'planned', 'server-worker-r2'),
    ('backblaze-b2', 'DREEM Backblaze B2', 'planned', 'server-worker-b2')
) as provider(provider, label, status, connection_ref)
on conflict (school_id, provider) do update
set
  label = excluded.label,
  status = case
    when public.storage_connections.status = 'active' then public.storage_connections.status
    else excluded.status
  end,
  connection_ref = excluded.connection_ref;

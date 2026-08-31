create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create extension if not exists supabase_vault with schema vault;

create function private.invoke_notification_dispatch()
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_functions_url text;
  v_dispatch_secret text;
  v_request_id bigint;
begin
  select decrypted_secret
  into v_functions_url
  from vault.decrypted_secrets
  where name = 'toquetin_functions_url'
  order by created_at desc
  limit 1;

  select decrypted_secret
  into v_dispatch_secret
  from vault.decrypted_secrets
  where name = 'toquetin_notification_dispatch_secret'
  order by created_at desc
  limit 1;

  if nullif(btrim(v_functions_url), '') is null
    or nullif(btrim(v_dispatch_secret), '') is null then
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_functions_url, '/') || '/dispatch-ready-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', v_dispatch_secret
    ),
    body := jsonb_build_object('source', 'database')
  ) into v_request_id;

  return v_request_id;
exception when others then
  raise warning 'Notification dispatcher invocation failed';
  return null;
end;
$$;

revoke all on function private.invoke_notification_dispatch()
from public, anon, authenticated, service_role;

create function private.notify_notification_dispatcher()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.invoke_notification_dispatch();
  return new;
end;
$$;

revoke all on function private.notify_notification_dispatcher()
from public, anon, authenticated, service_role;

create trigger notify_dispatcher_after_notification_insert
after insert on private.notifications
for each statement
execute function private.notify_notification_dispatcher();

select cron.schedule(
  'toquetin-notification-dispatch',
  '* * * * *',
  $$select private.invoke_notification_dispatch();$$
);

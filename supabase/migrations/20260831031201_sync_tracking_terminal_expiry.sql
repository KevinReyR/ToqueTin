create function private.propagate_tracking_expiration()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.tracking_viewers
  set expires_at = new.expires_at
  where tracking_session_id = new.id;

  update private.tracking_push_subscriptions
  set disabled_at = case
    when disabled_at is null or disabled_at > new.expires_at then new.expires_at
    else disabled_at
  end
  where tracking_session_id = new.id;

  return new;
end;
$$;

revoke all on function private.propagate_tracking_expiration()
from public, anon, authenticated, service_role;

create trigger propagate_tracking_expiration_after_update
after update of expires_at on public.tracking_sessions
for each row
when (new.expires_at is not null and old.expires_at is distinct from new.expires_at)
execute function private.propagate_tracking_expiration();

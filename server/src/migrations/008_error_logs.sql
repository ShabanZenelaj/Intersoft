-- Server-side errors, kept so a developer can see what actually broke in
-- production rather than relying on whatever scrolled past in a terminal.
--
-- Three kinds land here:
--   server_error        a request that ended in a 5xx
--   uncaught_exception  a throw nothing caught (the process then exits)
--   unhandled_rejection a promise that rejected with no catch
--
-- Request bodies are stored with secrets redacted before insert — see
-- lib/error-log.js. Nothing here should ever contain a password or token.

create table error_logs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('server_error', 'uncaught_exception', 'unhandled_rejection')),

  -- The error itself.
  name text not null default '',
  message text not null default '',
  stack text,

  -- Request context, null for process-level crashes that have no request.
  method text,
  path text,
  status int,
  query jsonb not null default '{}'::jsonb,
  body jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,

  -- Who was making the call, when we know.
  admin_id uuid references admins(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,

  created_at timestamptz not null default now()
);

-- Reading the log means "the newest ones", optionally narrowed to a kind.
create index error_logs_created_at_idx on error_logs (created_at desc);
create index error_logs_kind_created_at_idx on error_logs (kind, created_at desc);

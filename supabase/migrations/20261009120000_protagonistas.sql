-- Programa Protagonistas: candidaturas, pedidos de aviso e acesso ao painel.
--
-- Tudo usa o prefixo protagonistas_ para conviver com as outras tabelas do projeto.
-- O site (chave publishable/anon) só consegue chamar protagonistas_enviar(); não lê nem
-- altera nenhuma tabela. Quem está em protagonistas_admins (por e-mail do login do
-- Supabase Auth) lê as candidaturas e muda status e anotações. A análise com IA é
-- gravada pela Edge Function protagonistas-ia, com a service role.

-- ---------------------------------------------------------------- tabelas

create table if not exists public.protagonistas_candidaturas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  oportunidade text not null,
  oportunidade_titulo text not null default '',
  nome text not null,
  email text not null,
  whatsapp text not null default '',
  cidade text not null default '',
  relacao text not null default '',
  respostas jsonb not null default '[]'::jsonb,
  criterios jsonb not null default '{}'::jsonb,
  pagina text not null default '',
  status text not null default 'Nova'
    check (status in ('Nova', 'Em análise', 'Pré-selecionada', 'Selecionada', 'Não selecionada')),
  notas text not null default '',
  ia jsonb,
  ia_nota smallint check (ia_nota between 0 and 100),
  ia_analisada_em timestamptz
);

create index if not exists protagonistas_candidaturas_oportunidade_idx
  on public.protagonistas_candidaturas (oportunidade, created_at desc);

create table if not exists public.protagonistas_avisos (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  tipo text not null,
  oportunidade text not null default '',
  email text not null,
  pagina text not null default ''
);

create table if not exists public.protagonistas_admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

alter table public.protagonistas_candidaturas enable row level security;
alter table public.protagonistas_avisos enable row level security;
alter table public.protagonistas_admins enable row level security;

-- O Supabase concede tudo em public para anon/authenticated por padrão; aqui só o necessário.
revoke all on public.protagonistas_candidaturas from anon, authenticated;
revoke all on public.protagonistas_avisos from anon, authenticated;
revoke all on public.protagonistas_admins from anon, authenticated;

-- ---------------------------------------------------------------- acesso do painel

create or replace function public.protagonistas_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.protagonistas_admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- No Supabase as funções novas também ganham EXECUTE direto para anon; fecha.
revoke all on function public.protagonistas_is_admin() from public, anon;
grant execute on function public.protagonistas_is_admin() to authenticated;

grant select on public.protagonistas_candidaturas to authenticated;
grant update (status, notas) on public.protagonistas_candidaturas to authenticated;
grant select on public.protagonistas_avisos to authenticated;

drop policy if exists "admins leem candidaturas" on public.protagonistas_candidaturas;
create policy "admins leem candidaturas" on public.protagonistas_candidaturas
  for select to authenticated using (public.protagonistas_is_admin());

drop policy if exists "admins atualizam candidaturas" on public.protagonistas_candidaturas;
create policy "admins atualizam candidaturas" on public.protagonistas_candidaturas
  for update to authenticated
  using (public.protagonistas_is_admin())
  with check (public.protagonistas_is_admin());

drop policy if exists "admins leem avisos" on public.protagonistas_avisos;
create policy "admins leem avisos" on public.protagonistas_avisos
  for select to authenticated using (public.protagonistas_is_admin());

-- ---------------------------------------------------------------- envio pelo site

create or replace function public.protagonistas_enviar(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text := coalesce(payload ->> 'tipo', '');
  v_entrada jsonb := coalesce(payload -> 'respostas', '[]'::jsonb);
  v_respostas jsonb := '[]'::jsonb;
  v_criterios jsonb := coalesce(payload -> 'criterios', '{}'::jsonb);
  v_item jsonb;
  v_campo text;
  v_valor text;
  v_nome text;
  v_email text;
begin
  if jsonb_typeof(v_entrada) <> 'array' or jsonb_array_length(v_entrada) > 40 then
    raise exception 'respostas inválidas' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(v_entrada) loop
    v_campo := left(coalesce(v_item ->> 'campo', ''), 60);
    v_valor := btrim(left(coalesce(v_item ->> 'valor', ''), 6000));
    -- Campo-armadilha invisível para pessoas: preenchido = robô. Responde ok e descarta.
    if v_campo = 'website' then
      if v_valor <> '' then
        return jsonb_build_object('ok', true);
      end if;
      continue;
    end if;
    v_respostas := v_respostas || jsonb_build_array(jsonb_build_object(
      'campo', v_campo,
      'label', left(coalesce(v_item ->> 'label', ''), 300),
      'valor', v_valor
    ));
  end loop;

  select r ->> 'valor' into v_email
  from jsonb_array_elements(v_respostas) r where r ->> 'campo' = 'email' limit 1;
  v_email := lower(coalesce(v_email, ''));
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'e-mail inválido' using errcode = '22023';
  end if;

  if v_tipo = 'candidatura' then
    select r ->> 'valor' into v_nome
    from jsonb_array_elements(v_respostas) r where r ->> 'campo' = 'nome' limit 1;
    if coalesce(v_nome, '') = '' or coalesce(payload ->> 'oportunidade', '') = '' then
      raise exception 'candidatura incompleta' using errcode = '22023';
    end if;
    if jsonb_typeof(v_criterios) <> 'object' or length(v_criterios::text) > 20000 then
      v_criterios := '{}'::jsonb;
    end if;

    insert into public.protagonistas_candidaturas
      (oportunidade, oportunidade_titulo, nome, email, whatsapp, cidade, relacao, respostas, criterios, pagina)
    values (
      left(payload ->> 'oportunidade', 120),
      left(coalesce(payload ->> 'oportunidadeTitulo', v_criterios ->> 'titulo', ''), 200),
      v_nome,
      v_email,
      coalesce((select r ->> 'valor' from jsonb_array_elements(v_respostas) r where r ->> 'campo' = 'whats' limit 1), ''),
      coalesce((select r ->> 'valor' from jsonb_array_elements(v_respostas) r where r ->> 'campo' = 'cidade' limit 1), ''),
      coalesce((select r ->> 'valor' from jsonb_array_elements(v_respostas) r where r ->> 'campo' = 'relacao' limit 1), ''),
      v_respostas,
      v_criterios,
      left(coalesce(payload ->> 'pagina', ''), 300)
    );
  elsif v_tipo in ('aviso-mural', 'aviso-oportunidade') then
    insert into public.protagonistas_avisos (tipo, oportunidade, email, pagina)
    values (v_tipo, left(coalesce(payload ->> 'oportunidade', ''), 120), v_email, left(coalesce(payload ->> 'pagina', ''), 300));
  else
    raise exception 'tipo desconhecido' using errcode = '22023';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.protagonistas_enviar(jsonb) from public;
grant execute on function public.protagonistas_enviar(jsonb) to anon, authenticated;

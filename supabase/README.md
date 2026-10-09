# Candidaturas do Programa Protagonistas no Supabase

Projeto: **Sistemas Academia da Magia** (`https://aldereysqsrdiehyrfkh.supabase.co`).
Tudo usa o prefixo `protagonistas_` e não mexe nas outras tabelas do projeto.

| Peça | O que faz |
|---|---|
| `migrations/20261009120000_protagonistas.sql` | Tabelas `protagonistas_candidaturas`, `protagonistas_avisos`, `protagonistas_admins`, regras de acesso (RLS) e a função `protagonistas_enviar`, a única coisa que o site consegue chamar. |
| `functions/protagonistas-ia` | Análise de aderência com o Claude, usada pelo painel. Só responde a quem está em `protagonistas_admins`. |
| `functions/protagonistas-notificar` | E-mail para a diretoria a cada candidatura, via Resend. Opcional. |
| `../protagonistas/admin/` | Painel em **https://protagonistas.academiadamagia.com.br/admin/**. |

**Quem acessa o quê:**
- **Site, com a chave publishable:** só envia candidaturas e pedidos de aviso. Não lê nada.
- **Admins, logados com e-mail e senha:** leem tudo e mudam o status e as anotações.
- **A IA:** recebe as respostas e os critérios da oportunidade, mas não o e-mail, o WhatsApp nem o Instagram do candidato.

## Situação (09/10/2026)

Instalado pelo conector do Supabase:
- migração aplicada (em 4 partes: `protagonistas_1_tabelas`, `protagonistas_2a_is_admin`, `protagonistas_2b_politicas`, `protagonistas_3_enviar`);
- `protagonistas-ia` publicada;
- `diretoria@academiadamagia.com.br` e `academiadamagia.mkt@gmail.com` liberados em `protagonistas_admins`;
- site ligado à chave publishable.

Faltam: os logins do painel (passo 2.1), o segredo `ANTHROPIC_API_KEY` (passo 4.2) e, se quiserem, o e-mail (passo 5).

## Instalação

### 1. Banco (obrigatório)
**SQL Editor › New query** › cole o conteúdo de `migrations/20261009120000_protagonistas.sql` › **Run**. Pode rodar de novo sem problema.

Pela CLI: `supabase link --project-ref aldereysqsrdiehyrfkh && supabase db push`.

### 2. Quem acessa o painel (obrigatório)
1. **Authentication › Users › Add user › Create new user**: e-mail + senha, com *Auto Confirm User* marcado. Faça isso para cada pessoa da curadoria.
2. No **SQL Editor**, libere esses e-mails, sempre em minúsculas:
   ```sql
   insert into public.protagonistas_admins (email) values
     ('diretoria@academiadamagia.com.br'),
     ('academiadamagia.mkt@gmail.com');
   ```

Para tirar o acesso de alguém: `delete from public.protagonistas_admins where email = '...';`

### 3. Ligar o site (obrigatório)
Em **Project Settings › API Keys**, copie a chave **publishable** (`sb_publishable_…`) ou, se o projeto usa as chaves antigas, a **anon public**. Ela é pública por natureza: o banco só deixa essa chave chamar `protagonistas_enviar`. Coloque-a em `site.supabase.publishableKey` (`content/protagonistas.json`) e rode o build, ou mande para o Claude.

⚠️ Nunca use a chave **secret / service_role** no site.

### 4. Análise com IA (recomendado)
1. **Edge Functions › Deploy a new function › Via Editor**, nome `protagonistas-ia`, cole `functions/protagonistas-ia/index.ts` › **Deploy**. Deixe *Verify JWT* **ligado**.
2. **Edge Functions › Secrets**: `ANTHROPIC_API_KEY` = chave criada em https://platform.claude.com (*API Keys*; a conta precisa de créditos).

Pela CLI: `supabase secrets set ANTHROPIC_API_KEY=...` e `supabase functions deploy protagonistas-ia`.

### 5. E-mail para a diretoria (opcional)
1. Crie uma conta em https://resend.com e verifique o domínio `academiadamagia.com.br`. São alguns registros DNS, no mesmo painel em que foi criado o CNAME do site. Depois crie uma **API key**.
2. **Edge Functions › Deploy a new function**, nome `protagonistas-notificar`, cole `functions/protagonistas-notificar/index.ts`, e **desligue** *Verify JWT*. Na CLI isso já vem de `config.toml`.
3. **Secrets**:
   | Nome | Valor |
   |---|---|
   | `RESEND_API_KEY` | chave do Resend |
   | `WEBHOOK_SECRET` | um texto aleatório longo |
   | `NOTIFY_FROM` | `Programa Protagonistas <protagonistas@academiadamagia.com.br>` |
   | `NOTIFY_TO` | `diretoria@academiadamagia.com.br` |
   | `PANEL_URL` | `https://protagonistas.academiadamagia.com.br/admin/` |
4. **Database › Webhooks › Create a new hook**:
   - tabela `protagonistas_candidaturas`, evento **Insert**;
   - tipo **Supabase Edge Functions** › `protagonistas-notificar`;
   - em *HTTP Headers*, adicione `x-webhook-secret` com o mesmo valor de `WEBHOOK_SECRET`.

## Onde ver as candidaturas
- **Painel**: https://protagonistas.academiadamagia.com.br/admin/. Tem filtros, análise com IA, comparação, status, anotações e **Baixar CSV**.
- **Supabase**: Table Editor › `protagonistas_candidaturas`. A coluna `oportunidade` identifica cada vaga (ex.: `protagonista-agir`), e `respostas` guarda todas as respostas.

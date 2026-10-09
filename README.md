# Academia da Magia — sites

- `index.html` — landing page do **Kit do Protagonista**.
- `protagonistas/` — hub do **Programa Protagonistas** (v2), gerado a partir de `content/protagonistas.json`.
- `supabase/` — banco das candidaturas, análise com IA (desligada: `site.ia`) e aviso por e-mail, no projeto Supabase *Sistemas Academia da Magia*. Instalação em [`supabase/README.md`](supabase/README.md).
- `protagonistas/admin/` — painel de curadoria (login do Supabase), em `/admin/` do site.

## Programa Protagonistas

Site estático, sem dependências. Rotas geradas:

| URL | Arquivo |
|---|---|
| `/protagonistas` | `protagonistas/index.html` |
| `/protagonistas/oportunidades` | `protagonistas/oportunidades/index.html` |
| `/protagonistas/oportunidades/[slug]` (+ `#candidatura`) | `protagonistas/oportunidades/[slug]/index.html` |
| `/protagonistas/historias` | `protagonistas/historias/index.html` |
| `/protagonistas/[slug]` | `protagonistas/[slug]/index.html` |

Todos os links são relativos, então o site funciona em qualquer caminho base.

### Editar conteúdo

1. Edite `content/protagonistas.json` (oportunidades, protagonistas, formulário, filtros).
2. Rode `node scripts/build-protagonistas.mjs` (Node 18+).
3. Faça commit do JSON e das páginas regeneradas.

O build valida slugs, os vínculos `oportunidade.selected ↔ protagonista.opp` e os status.

- **Status** de oportunidade: `aberta` (mostra formulário), `breve` (captura de e-mail), `andamento`, `encerrada` (liga ao perfil de quem foi selecionado).
- **Fotos**: coloque o arquivo em `protagonistas/assets/img/` e mapeie o id do slot em `images` (ex.: `"person-becca": "pessoas/becca.webp"`). Slots sem imagem mostram um placeholder descrevendo o que entra ali. Ids usados: `person-<slug>`, `profile-hero-<slug>`, `gal-<slug>-<n>`, `opp-<slug>`, `pri-action-1`, `pri-action-video`, `camila-photo`, `final-m0`…`final-m5`.
- **Formulários**: as candidaturas e os pedidos de aviso vão para o Supabase (`site.supabase.url` + `site.supabase.publishableKey`) pela função `protagonistas_enviar`. Sem a chave, o formulário mostra um erro com o e-mail da diretoria, nunca uma confirmação falsa. Ver [`supabase/README.md`](supabase/README.md).
- **SEO**: `site.url` + `site.basePath` geram canonical, Open Graph e `protagonistas/sitemap.xml`.

### Publicação (https://protagonistas.academiadamagia.com.br)

O workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) gera as páginas e publica a pasta `protagonistas/` no GitHub Pages a cada push na branch padrão do repositório. O arquivo `CNAME` é gerado pelo build a partir de `site.url`.

Configuração única:
1. **DNS** (no painel onde o domínio academiadamagia.com.br é gerenciado): registro **CNAME**, nome `protagonistas`, valor `morettiacademia.github.io`.
2. **GitHub › Settings › Pages**: *Source* = **GitHub Actions**; *Custom domain* = `protagonistas.academiadamagia.com.br`; depois que o certificado sair, marque **Enforce HTTPS**.

⚠️ Datas, requisitos, contrapartidas, jornada da Pri e bios da Becca e da Carol são conteúdo de exemplo do handoff — validar antes de publicar.

# Academia da Magia — sites

- `index.html` — landing page do **Kit do Protagonista**.
- `protagonistas/` — hub do **Programa Protagonistas** (v2), gerado a partir de `content/protagonistas.json`.
- `apps-script/` — backend das candidaturas (e-mail, planilha e painel administrativo com IA). Instalação em [`apps-script/README.md`](apps-script/README.md).

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
- **Formulários**: `site.formEndpoint` recebe a URL do backend em [`apps-script/`](apps-script/README.md), que envia cada candidatura por e-mail para a diretoria, grava numa planilha e serve o painel administrativo com análise por IA. Vazio = o formulário só mostra a confirmação na tela, **sem enviar dados**.
- **SEO**: `site.url` + `site.basePath` geram canonical, Open Graph e `protagonistas/sitemap.xml`.

⚠️ Datas, requisitos, contrapartidas, jornada da Pri e bios da Becca e da Carol são conteúdo de exemplo do handoff — validar antes de publicar.

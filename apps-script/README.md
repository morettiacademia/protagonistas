# Candidaturas do Programa Protagonistas (Google Apps Script)

Este é o "servidor" do site, e roda de graça na sua conta Google. Ele faz três coisas:

1. **E-mail**: a cada candidatura, envia todas as respostas para **diretoria@academiadamagia.com.br**. Responder o e-mail já responde para o candidato.
2. **Planilha**: guarda cada candidatura numa planilha do Google Drive, *Programa Protagonistas — Candidaturas*. Os pedidos de "avise-me" ficam na aba *Avisos*.
3. **Painel administrativo**: uma página protegida por senha para ler as candidaturas, mudar o status, fazer anotações e usar o Claude para avaliar a aderência de cada pessoa à oportunidade.

## Instalação (uma vez, uns 15 minutos)

Use a conta Google da Academia que deve ser dona da planilha. Os e-mails saem em nome dessa conta.

1. Acesse https://script.google.com e clique em **Novo projeto**. Dê o nome *Protagonistas*.
2. **Código**: apague o conteúdo de `Código.gs` e cole o conteúdo de [`Code.gs`](Code.gs).
3. **Painel**: clique em **+ › HTML**, dê o nome `Admin` (sem `.html`) e cole o conteúdo de [`Admin.html`](Admin.html).
4. **Manifesto**: em **Configurações do projeto** (engrenagem), marque *Mostrar o arquivo de manifesto "appsscript.json"*. Volte ao editor, abra `appsscript.json` e cole o conteúdo de [`appsscript.json`](appsscript.json).
5. **Propriedades**: em **Configurações do projeto › Propriedades do script**, adicione:
   | Propriedade | Valor |
   |---|---|
   | `ADMIN_PASSWORD` | a senha do painel (use uma senha forte e compartilhe só com o time) |
   | `ANTHROPIC_API_KEY` | a chave da API do Claude (ver abaixo) |
   | `ADMIN_EMAIL` | *(opcional)* outro destino para os e-mails. Sem ela, vai para diretoria@academiadamagia.com.br |
6. **Setup**: no editor, escolha a função `setup` na barra de cima e clique em **Executar**. O Google vai pedir autorização (planilhas, enviar e-mail, acessar serviços externos): aceite. A planilha é criada no seu Drive.
7. **Publicar**: clique em **Implantar › Nova implantação › App da Web**.
   - *Executar como*: **Eu**
   - *Quem pode acessar*: **Qualquer pessoa** (o site precisa enviar candidaturas sem login; o painel é protegido pela senha)
   Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`).
8. **Ligar o site**: em `content/protagonistas.json`, coloque essa URL em `site.formEndpoint` e rode `node scripts/build-protagonistas.mjs`. (Ou mande a URL para o Claude fazer isso.)

Pronto. A mesma URL `/exec`, aberta no navegador, é o **painel administrativo**.

### Chave da API do Claude

Crie em https://platform.claude.com → *API Keys* (é preciso ter créditos na conta). Cada análise de candidatura custa alguns centavos de dólar. A chave fica só nas propriedades do script, nunca no site.

Sem a chave, tudo funciona (e-mail, planilha, painel), menos os botões de IA.

## Como usar o painel

- **Filtros** por oportunidade e status, e busca por nome, e-mail ou cidade.
- **Analisar com IA**, uma por uma ou todas as pendentes de uma vez. Para cada pessoa, o Claude devolve:
  - uma nota de aderência de 0 a 100;
  - um resumo;
  - cada pré-requisito marcado como *atende*, *parcial*, *não atende* ou *não informado*, com o trecho da resposta que serve de evidência;
  - pontos fortes e de atenção;
  - perguntas sugeridas para a conversa.
- **Ordenar por maior aderência** coloca as melhores notas no topo.
- **Comparar candidatos com IA** (com uma oportunidade selecionada) coloca lado a lado todas as candidaturas já analisadas e sugere uma ordem, com a recomendação de quem chamar para conversar.
- **Status e anotações** ficam salvos na planilha.

A IA recebe as respostas e os critérios da oportunidade, mas **não recebe e-mail, WhatsApp nem Instagram**. Ela é instruída a não considerar características pessoais (gênero, idade etc.) e a tratar as respostas como conteúdo, não como instruções. A decisão final é sempre do time.

## Quando mudar o código

Depois de colar uma versão nova de `Code.gs` ou `Admin.html`, publique de novo: **Implantar › Gerenciar implantações › (lápis) › Versão: Nova versão › Implantar**. A URL continua a mesma.

## Limites

- E-mails por dia: 100 numa conta Gmail comum, 1.500 no Google Workspace.
- Cada análise leva de 10 a 40 segundos.

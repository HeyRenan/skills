---
name: lp-export
description: Exports and adapts a RD Station landing page (LP) into the Método Supera WordPress repo: captures the HTML, swaps the RD form for Contact Form 7, registers the slug in the theme and the CRM integration, optimizes images, runs QA, and sets up the LP repo and the theme MR. Use when the user gives an RD Station LP URL and a slug, or asks to export, adapt, migrate or import an LP from RD Station.
argument-hint: <url-rd-station> <slug> [title]
---

Exporta e adapta uma LP do RD Station para o WordPress do Método Supera. Mantenha o layout do RD intacto e troque só o necessário: integração de lead, chrome global do tema e tracking.

Argumentos em `$ARGUMENTS`: `<url>` URL pública da LP no RD, `<slug>` slug da LP (pasta, URL e registro), `<title>` opcional (`<title>` da página).

Se faltar o slug, o `NAME` (identificador da LP no CRM) ou o texto do submit, **pergunte antes de registrar no CRM**: o identificador precisa ser byte-idêntico dos dois lados.

O diretório atual é a raiz do repo WordPress `metodosupera`. Os caminhos são relativos a ela.

## Realidade

Cada LP é uma **pasta física na raiz** (ex.: `estrategias-de-memoria/`), servida em `cadastro.metodosupera.com.br/<slug>`. Não é uma page do WP: é um `index.php` avulso que dá `require wp-load.php` e imprime o HTML cru do RD, chamando `wp_head()`/`wp_footer()`. Por isso precisa do registro no `scripts-footer.php`.

É export RD a pasta com `index.php` + `files/` + `agradecimento/` e **sem** `src/`, `build/`, `dist/`, `package.json`. **Referência-ouro:** `como-construir-reserva-cognitiva/`.

Assets do RD vêm com nomes **hasheados com `$` e sem extensão** (`files/$w2tg0qynft`): não renomeie. Banners e fundos costumam continuar em `https://d335luupugsy2.cloudfront.net/...` (tratados no passo 5).

## Fluxo

Copie e acompanhe. Leia cada referência só ao chegar no passo.

```
- [ ] 1. Capturar e adaptar index.php e agradecimento/  → references/adapt.md
- [ ] 2. Registrar no tema e no CRM                      → references/register.md
- [ ] 3. Conferir o Contact Form 7                       → references/register.md
- [ ] 4. Teste seguro de lead (regra abaixo)
- [ ] 5. Imagens e QA                                    → references/post-qa.md
- [ ] 6. Repos e MR                                      → references/repos.md
- [ ] 7. Checklist final (abaixo)
```

## Segurança de lead (obrigatório ao testar)

Teste local em `http://metodosupera.test/<slug>/`, servido por Valet/Herd. Não use `php -S`. **Sempre com a barra final**: as imagens usam `./files/...` e, sem a barra, tudo dá 404 (falso-positivo, não bug).

O `enqueue_lead` tem trava de teste: `$forceTestRoute` é verdadeiro quando o nome contém `somadev` ou `teste`, e então usa `FUNIL_DE_VENDAS_UNIDADE_TESTE_TOKEN` (unidade PILOTO), nunca uma unidade real.

- **Nunca** envie o form pelo browser com nome real. O plugin `integracao-rd-station` envia ao RD em todo submit e não tem guarda de teste: criaria lead real no RD de produção.
- Para provar o Funil com segurança, chame `enqueue_lead()` direto (isola do RD), com nome contendo `teste`, num script PHP temporário que dá `require wp-load.php` e `require_once '<raiz>/wp-content/plugins/simpleenqueuejobs/jobs/adaptJobFunctions.php'`. Apague o script depois.

```php
enqueue_lead(['nome'=>'teste ...','email_lead'=>'teste@somadev.com.br','celular'=>'11999999999',
  'identificador'=>'NAME_DA_LP','idade'=>['...'],'bairros'=>['1'],
  'aluno'=>['Não sou aluno, mas quero uma experiência Supera']]);
```

Esperado: `Oportunidades importadas com sucesso`, `Origem do lead = NAME_DA_LP`, unidade PILOTO. Com `aluno=['Sou aluno Supera']`: `Lead já é aluno` (não vai ao funil).

## Checklist final

```
- [ ] <slug>/ com index.php + files/ + agradecimento/
- [ ] Cabeçalho PHP (wp-load, SLUG, NAME, filtros CF7), `php -l` limpo
- [ ] Head: scripts (`?>/assets` colado), wp_head(), GTM-KNZW9KPD no topo do head e <noscript> logo após <body>, trackers RD removidos
- [ ] Favicon conferido contra https://metodosupera.com.br/ ao vivo, nas duas páginas
- [ ] <body class="default-form ..."> escolhido pelo fundo do card do form
- [ ] <form> do RD trocado pelo shortcode do CF7; heading solto movido para {{str_form_title}}
- [ ] QA da adaptação (classes de bug em post-qa.md, seção C; não é checklist fixo de widgets): âncoras internas, target="_self" em CTA de âncora, CSS do tema vs widgets custom do RD, contraste do form, card duplicado (#rd-box vs card do tema), submit não cortado. Abra a LP inteira e olhe: cada LP tem estrutura diferente
- [ ] do_action('wp_footer') antes de </body>
- [ ] Agradecimento: /../../, <body> limpo, GTM, sem resíduo de outra campanha, CTA no destino certo (perguntou se não tinha certeza)
- [ ] Slug nas DUAS listas de scripts-footer.php (slug `<slug>`), e confirmar em runtime que o default-form.min.css sai no <head> renderizado: `[...document.querySelectorAll('link[rel=stylesheet]')].some(l=>l.href.includes('default-form.min.css'))`. Se der false mesmo com o slug registrado, o tema está em checkout na branch errada (tem que estar na feat/<slug>): código certo não carrega se a working tree do tema está noutra branch
- [ ] NAME no in_array de integracao-form-crm.php, byte-idêntico
- [ ] Teste seguro feito (nome `teste`, rota funil PILOTO), origem = NAME
- [ ] Pós: imagens em webp/local, QA visual; listar exatamente o que mudou
- [ ] LP no repo próprio (nome "LP - <Nome>", path sem lp-, README flat, commit direto na main)
- [ ] Tema: branch feat/<slug> a partir da origin/master fresca, MR aberta/atualizada via /templeforge:open (target master), repo do tema devolvido à branch original que estava em checkout, sem misturar WIP alheio
```

LPs existentes e bugs conhecidos: [references/existing-lps.md](references/existing-lps.md). Consulte só ao auditar ou comparar.

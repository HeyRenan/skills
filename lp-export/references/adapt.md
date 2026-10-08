# Capturar e adaptar

## Contents
- Capturar
- index.php
- Página de obrigado

## Capturar

- Crie `<slug>/`, `<slug>/files/`, `<slug>/agradecimento/`.
- `curl -sSL -A "Mozilla/5.0" "<url>" -o <slug>/index.php` (HTML cru; o comentário `<!-- saved from url -->` pode ficar).
- Página de obrigado conforme a tarefa: nova, ou copie a `agradecimento/` inteira de outra LP e adapte. Se o HTML capturado não expõe a URL da página de obrigado, procure um atributo `data-asset-action` (ou similar) no form: costuma ser uma string base64 com a URL de redirecionamento pós-envio. Decodifique com `base64 -d` para achar a página real, que pode até ser de outra campanha.

## index.php

**a) Cabeçalho PHP no topo absoluto** (antes do `<!DOCTYPE`):

```php
<?php
$path = realpath(__DIR__ . '/../') . '/';
require_once($path . 'wp-load.php');

define('SLUG', 'SLUG_DA_LP');
define('NAME', 'IDENTIFICADOR_DA_LP');

add_filter('wpcf7_form_tag', function ($tag) {
    if ($tag['basetype'] === 'submit') { $tag['values'][0] = 'TEXTO DO SUBMIT'; }
    if (in_array($tag['name'], ['lista_akna', 'script'])) { $tag['values'][0] = SLUG; }
    if ($tag['name'] === 'identificador') { $tag['values'][0] = NAME; }
    return $tag;
});

add_filter('wpcf7_form_elements', function ($content) {
    return str_replace('{{str_form_title}}', 'TÍTULO DO FORM (ou string vazia)', $content);
});
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
```

Se a LP já tem um heading próprio (componente `rd-text`) logo acima de onde o form entra, **não duplique**: apague o heading solto e use o texto dele em `{{str_form_title}}`, que é renderizado **dentro** do card do form. Só use string vazia se não houver heading para reaproveitar.

**b) Head**, logo após `<title>` (que deve virar o `<title>` recebido em `$ARGUMENTS`) e antes dos estilos do RD:

```php
<script type='text/javascript' src='<?php bloginfo('template_url') ?>/assets/js/jquery-1.11.1.min.js'></script>
<script type='text/javascript' src='<?php bloginfo('template_url') ?>/assets/js/jquery.mask.js'></script>
<script type='text/javascript' src='<?php bloginfo('template_url') ?>/assets/js/supera.min.js'></script>
```

E `<?php wp_head(); ?>` antes de `</head>`.

> Escreva `?>/assets` **colado**. Um espaço (`?>/ assets`) quebra o path (bug real na `momento-supera`).

**c) GTM.** Mantenha o container **`GTM-KNZW9KPD`** (head + `<noscript>`) quando vier no export; é o GTM do Supera. Se a tarefa pedir e não houver, adicione os snippets abaixo. **A posição importa** (job "Tags GTM Landing Pages Supera"): o `<script>` fica **o mais alto possível dentro de `<head>`**, logo após a abertura, antes de qualquer meta/style. O `<noscript>` fica **imediatamente** após a abertura de `<body>`. O RD costuma deixar os dois no meio ou no fim: cheque e mova.

```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-KNZW9KPD');</script>
<!-- End Google Tag Manager -->
```

```html
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KNZW9KPD"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
```

**d) Favicon.** **Nunca confie** no `<link rel="icon">` do export do RD nem no das LPs irmãs (ex.: `favicon-1.png` de 2020): já ficou desatualizado. Busque o atual no site principal:

```bash
curl -sSL -A "Mozilla/5.0" "https://metodosupera.com.br/" | grep -oE '<link[^>]*icon[^>]*>'
```

Troque os `<link>` de favicon da LP pelos retornados (normalmente `icon` 32x32 + 192x192 e `apple-touch-icon`). Aplique em `index.php` e em `agradecimento/index.php`.

**e) Remover** os `<script src>` de tracking e form do RD: `ajax.googleapis.com/.../jquery`, `jquery.validate`, `select2.min.js`, `lead-tracking/*`, `rd/stable/rdlps*`, `loader-scripts/*`, `landing-page-attributes`, `data-field-name="landing_page"`. Remova também qualquer `<script>` ou `<div>` que só existia para o form do RD que você vai apagar no item (g): handler de `conversionSuccess`, redirect pós-envio, honeypot. **Mantenha** os `<style>`, os IDs `rd-*` e os seletores `[class^="rdstation-popup-position"]`.

**f) Body:** `<body class="default-form default-form--white">`. Use `--dark` em fundo escuro, ou só `default-form`. A escolha segue o fundo do card do form (ver post-qa.md, seção C, item 4).

**g) Formulário.** Apague o `<div id="rd-form-...">...</form></div>` inteiro (a div que embrulha a `<form>`, **não** o card que a contém) e ponha no lugar:

```php
<div class="coluna-direita">
    <div class="form">
        <p class="description">
            <?php echo do_shortcode('[contact-form-7 title="Formulário padrão"]'); ?>
    </div>
</div>
```

O `<p class="description">` fica sem fechar: é o padrão, não conserte.

**h)** `<?php do_action('wp_footer'); ?>` antes de `</body>`.

## Página de obrigado (`agradecimento/index.php`)

- Cabeçalho PHP com `wp-load` em **`/../../`** (um nível mais fundo) e `define` de SLUG/NAME. `<body>` sem classes. Sem os scripts jQuery/mask/supera (não há form).
- GTM `GTM-KNZW9KPD` (head + `<noscript>`), mesma regra de posição do item (c). Favicon: mesma checagem do item (d).
- Se a página capturada é HTML cru salvo do browser (sem `<?php` no topo, comentário `<!-- saved from url=... -->`), ela **não tem** `wp-load`, `wp_head()` nem `wp_footer()`: adicione. Pode também carregar **trackers crus obsoletos**: `./files/analytics.js`, `./files/js`, `./files/js(1)`, `./files/js(2)`, `./files/js(3)`, `<link href="./files/css">`, `<link href="./files/select2.min.css">`. Remova tudo.
- Limpe meta, título e canonical de **outra campanha** (resíduo comum ao reaproveitar): `<title>`, `og:title`, `description` com o nome de outra LP. `og:image`/`twitter:image` **não** são resíduo se apontarem para o banner genérico do Supera (`.../1728493460068banner-site-02.png`). Atualize `<link rel="canonical">` para `https://cadastro.metodosupera.com.br/<slug>/agradecimento`.
- Botão de CTA: se o `href`/`title` vieram de outra campanha, **não invente** o destino. Pergunte ao dono da tarefa, ou deixe explícito no relatório final que ficou pendente. Propague as UTMs da URL de entrada (use o `id` do `<a>` do RD):

```html
<script>
(function() {
  var btn = document.getElementById('ID_DO_BOTAO_RD');
  var params = new URLSearchParams(window.location.search);
  var utms = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
  var query = utms.filter(function(k){ return params.get(k); }).map(function(k){ return k+'='+encodeURIComponent(params.get(k)); }).join('&');
  if (query) btn.href += (btn.href.indexOf('?') === -1 ? '?' : '&') + query;
})();
</script>
```

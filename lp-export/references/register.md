# Registrar no tema, no CRM e no Contact Form 7

## Tema e CRM

Use o **slug de URL** (= `<slug>`). O tema decide o que enfileirar por `$request_uri_path_trimmed` (caminho da URL, sem barras) em `wp-content/themes/supera/functions/scripts-footer.php`, não por `is_page()` nem pelo `SLUG` do PHP. Duas listas `in_array($request_uri_path_trimmed, [...])` importam (hoje com basicamente os mesmos slugs):

1. **Excluir chrome global**: dentro do `if (!is_page(...) && ...)` que enfileira `pages.css`, `header.css`, `footer.css`, `scripts.js`. **Toda LP de export tem que estar aqui**, senão header e footer do site vazam por cima.
2. **Carregar `default-form`**: enfileira `default-form.css`, `default-form-config.js`, `default-form-rd-tag.js`. **Toda LP com formulário tem que estar aqui.**

Adicione `<slug>` às **duas**.

> `SLUG` (PHP) ≠ slug de URL ≠ nome da pasta. Em `scripts-footer.php` use o slug de URL (o caminho servido). Pastas com prefixo `lp-` costumam perder o prefixo na URL.

Em `wp-content/themes/supera/functions/integracao/integracao-form-crm.php`, função `enqueue_lead`, adicione o **identificador** (`NAME`) ao `in_array($identificador, [...])` que faz `$origin = $identificador`. O `$identificador` que chega é o `NAME` da LP (campo `identificador` do CF7, preenchido pelo filtro `wpcf7_form_tag`). O funil identifica o lead por esse `$origin` (`Origem do lead`). **Tem que ser byte-idêntico** a uma string da lista; senão o lead ainda é enviado, mas cai no fallback `$origin = "Site-Supera"`, silenciosamente errado.

## Contact Form 7

Garanta o form de título **exato** `Formulário padrão`: é o que todas as LPs chamam via `do_shortcode('[contact-form-7 title="Formulário padrão"]')`. Se já existir, reuse; não crie um novo por LP. Additional settings: `enviar_lead`.

Conteúdo:

```
<strong style="display: block;text-align: center; text-transform: uppercase;">{{str_form_title}}</strong>
<br>
[dynamichidden emailvendedor id:emailvendedor]
<p>
    <label class="icone-nome" for="nome"><i>Nome</i>[text* nome id:nome class:nome placeholder "Nome"]</label>
</p>
<p>
    <label class="icone-email" for="email"><i>E-mail</i>[email* email_lead id:email class:email placeholder "E-mail"]</label>
</p>
<p>
    <label class="icone-telefone" for="telefone"><i>Telefone</i>[tel* celular id:telefone class:cel  placeholder "Telefone"]</label>
</p>
<p class="formtitle">
    <label class="icone-unidades"><i>Qual sua idade?</i></label>[select* idade include_blank "Menos de 15 anos" "Entre 16 e 25 anos" "Entre 26 e 35 anos" "Entre 36 a 45 anos" "Entre 46 a 60 anos" "Entre 61 a 80 anos" "Mais de 80 anos"]
</p>
<p class="formtitle">
    <label class="icone-unidades"><i>Escolha o SUPERA mais próximo</i></label>[select* cat include_blank "Acre - AC" "Amazonas – AM" "Bahia – BA" "Ceará – CE" "Distrito Federal – DF" "Espírito Santo – ES" "Goiás - GO" "Maranhão – MA" "Mato Grosso do Sul – MS" "Mato Grosso – MT" "Minas Gerais – MG" "Pará – PA" "Paraíba – PB" "Paraná – PR" "Pernambuco – PE" "Piauí – PI" "Rio de Janeiro – RJ" "Rio Grande do Norte – RN" "Rio Grande do Sul – RS" "Rondônia – RO" "Santa Catarina - SC" "São Paulo – SP" "Sergipe - SE" "Tocantins – TO"]
</p>
<p style="display:none" class="select-unidades">
    <label class="icone-unidades"><i>Selecione uma Unidade</i></label>
    <span>[select* uni include_blank ""] </span>
</p>
<p class="select-bairros">
    <span>[select bairros  class:required_field include_blank] </span>
</p>
<p>
    <label for="aluno"><i>Você é aluno Supera?</i>[select* aluno "Selecione..." "Sou aluno Supera" "Sou ex-aluno Supera" "Nunca fui aluno Supera" "Não sou aluno, mas quero uma experiência Supera"]</label>
</p>
<p>[checkbox newletter "Eu concordo em receber comunicações e ofertas personalizadas de acordo com meus interesses."]</p>
<p class="notice-form" style="color:#363233;margin-top:10px;float: left;">
    Ao informar meus dados, eu concordo com a <a href="https://metodosupera.com.br/politica-de-privacidade-supera/" target="_blank">Política de Privacidade</a>.<input type="hidden" data-privacy="true" name="privacy_policy" value="1">
</p>
[recaptcha]
<p>[submit "Quero meu guia"]</p>
<div style="display:none;">
    <input type="checkbox" data-privacy="true" name="communications"  value="1">
    [dynamictext referer-page "CF7_URL"]
    [text lista_akna ""]
    [text script ""]
    [text utm_source ""]
    [text utm_medium ""]
    [text utm_campaign ""]
    [text utm_content ""]
    [text utm_term ""]
    [text c_utmz id:cookieutmz ""]
    [text identificador ""]
    [dynamichidden identificador_vendedor id:identificador_vendedor]
    [dynamichidden idunidade id:idunidade]
</div>
<small class="line participacao-warning" style="width:100%;text-align:center;color: #000000;font-weight:bold">Unidade escolhida não participante da promoção.</small>
```

Como os campos casam com o cabeçalho PHP da LP (filtros do `adapt.md`, item a, em runtime):

| Campo CF7 | Preenchido com |
| --- | --- |
| `[submit]` | texto do botão da campanha |
| `lista_akna` | `SLUG` |
| `script` | `SLUG` |
| `identificador` | `NAME` |
| `{{str_form_title}}` (no `<strong>`) | trocado pelo filtro `wpcf7_form_elements` |

Por isso o mesmo `Formulário padrão` serve todas as LPs: o que muda por campanha vem do PHP. Não ajuste o CF7 por LP.

O gate `aluno` já roteia: "Sou aluno", "Sou ex-aluno" e "Nunca fui aluno Supera" vão só ao RD; "Não sou aluno, mas quero uma experiência Supera" vai ao RD **e** ao Funil de Vendas. Não precisa de código de integração novo.

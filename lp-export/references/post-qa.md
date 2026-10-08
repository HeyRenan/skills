# Pós: imagens e QA

## Contents
- A. Imagens
- B. QA visual e funcional
- C. Classes de bug após a adaptação

Roda **depois** que a LP já funciona. Regra geral: **não redesenhe** a LP; corrija só o que quebrou ou pesa.

## A. Imagens

**A.1 Baixar as imagens remotas do cloudfront.** Toda LP ainda aponta 2 a 4 imagens para `https://d335luupugsy2.cloudfront.net/...` (banner, fundos, ícones sociais). Localize:

```bash
grep -oE 'https://d335luupugsy2\.cloudfront\.net/[^")'"'"' ]+' index.php | sort -u
```

Para cada imagem de **conteúdo** (não meta): baixe para `files/` e troque a URL absoluta pelo caminho relativo `./files/<arquivo>`.
- **Exceção:** `og:image` e `twitter:image` (meta social) podem continuar remotas, porque não são renderizadas na página.
- Fundo em CSS (`background-image:url(...)`) conta como imagem de conteúdo: localize também.

**A.2 Otimizar e converter para webp.** Alvos: os maiores arquivos (banners `$hash` de 0,5 a 1,2 MB, PNGs grandes). Nem todo asset RD tem extensão; descubra o tipo real antes:

```bash
cd lp-slug/files
for f in *; do printf "%s: " "$f"; file -b "$f"; done
du -k * | sort -rn | head
```

Converta recomprimindo **no mesmo nome**, sem adicionar `.webp`: não vale caçar todas as referências para renomear. Webp com nome sem extensão funciona no browser, o tipo vem do header.

```bash
cwebp -q 82 entrada.png -o saida.webp   # depois: mv saida.webp entrada (mesmo nome original)
```

Cuidados: não converta PDFs nem fontes. PNG com transparência vira webp com transparência (`cwebp` preserva). Meça antes e depois e relate a economia no relatório final.

**A.3 Artefatos que não deveriam estar no repo.** PDF ou imagem "original" pesada (várias vezes o tamanho da versão otimizada) ao lado da otimizada é candidata a sair do repo (hospedar em outro lugar). Confirme com o dono antes de apagar.

## B. QA visual e funcional

Abra a LP e a página de obrigado no browser local (`http://metodosupera.test/<slug>/`, **com barra final**). Cheque:

**Visual**
- Nenhuma imagem quebrada (`src` 404), incluindo fundos CSS e o banner que era remoto.
- Fontes carregaram (senão falta o `<link>` do Google Fonts do original).
- Botões com cor e estilo (conflito de CSS do WP pode zerar estilo; uma regra pontual resolve).
- Layout não colapsou (chrome global do tema não vazou por cima; senão confirme o registro em `scripts-footer.php`, ver register.md).
- Mobile: o RD é responsivo; confira que nada do WP quebrou o breakpoint.

**Funcional**
- Máscara de telefone funciona (depende de `jquery.mask`; cuidado com o bug do `/ assets` com espaço, adapt.md item b).
- Selects encadeados (estado → unidade → bairro) populam.
- Envio do form: validação, recaptcha, lead sai com `identificador = NAME` e `lista_akna`/`script = SLUG`.
- Página de obrigado: CTA leva ao destino certo e propaga UTM (se aplicável).
- GTM `GTM-KNZW9KPD` dispara (`window.dataLayer` populado / aba Network), sem tracker do RD sobrando.

**Ao reportar:** liste **exatamente** o que foi alterado. Nada implícito. Correções válidas: URL de imagem, regra CSS pontual, `<link>` de fonte ausente. **Não** faça: mexer em espaçamento, cores ou tipografia do original, nem reorganizar seções.

> **Segurança de lead:** nunca dispare lead real para produção/CRM ao testar o envio. Siga a seção "Segurança de lead" do SKILL.md antes de testar.

## C. Classes de bug após a adaptação

Lentes de QA, não checklist de widgets. **Cada LP é diferente**: layout, seções e widgets variam infinitamente (contador, abas, carrossel, timeline). **Não existe lista fixa de bugs.** Estas são as *causas-raiz* que quebram coisas depois da adaptação: (a) você **removeu o form do RD**, (b) o HTML do RD agora roda sob o **CSS/JS do tema WP**, (c) o card do form do RD e o card do tema podem se sobrepor.

1. **Âncoras internas apontando para dentro do que foi removido.** Qualquer `href="#id"` cujo alvo ficava dentro do bloco do form removido vira link morto.
   ```bash
   grep -oE 'href="#[a-z0-9-]+"' index.php | sort -u   # cada alvo ainda existe como id?
   ```
   Re-atribua o `id` que faltou ao elemento equivalente (ex.: o wrapper do CF7).

2. **`target="_blank"` em link de âncora.** O RD às vezes deixa `_blank` em botão que é âncora: abre aba nova em vez de rolar. Troque para `_self`. (Opcional: `<style>html{scroll-behavior:smooth}</style>`.)

3. **CSS/JS do tema vazando no markup do RD.** O tema agora estiliza **todo** o HTML do RD e pode quebrar qualquer widget que dependia do CSS exclusivo do RD (line-height, posicionamento, z-index, overflow...). Passe o olho em **cada** elemento custom ou interativo e corrija com **override pontual no elemento afetado** (ex.: `#rd-text-xxxxx strong { ... !important }`), sem mexer no resto. Exemplo real: o tema forçava `line-height` pequeno em `span` e os números grandes de um contador transbordavam; resolvido com `line-height` explícito só naquele valor.

4. **Contraste do formulário.** O modificador do `<body>` se escolhe pelo **fundo do card do form** (`.coluna-direita`/`.form`), não pela seção:
   - `default-form--white`: pinta **todo** texto do form de branco, então só use com card **escuro**.
   - `default-form` (base): labels escuras sobre card claro. **Caso comum** (o card do CF7 renderiza claro mesmo em seção colorida).
   - `default-form--dark`: cria card escuro com texto branco.
   Sintoma de escolha errada: texto branco sumindo no card claro. Troque `--white` pelo base `default-form`.

5. **Padding/fundo duplicados: o box do RD (`#rd-box-xxxxx`) por cima do card do tema.** Quando o form do RD morava dentro de um `#rd-box` estilizado (background-color + padding, geralmente para virar um "card" visual em torno do form), e o item (g) do adapt.md troca só o `<div id="rd-form-...">` interno pelo shortcode, o `#rd-box` continua com seu próprio background/padding **por fora** do card que o `default-form.css` do tema já desenha. Resultado: card-dentro-de-card e form espremido. Fix pontual (no `<head>`, com `!important` para vencer o `<style>` inline do RD, que vem depois no DOM):
   ```css
   #rd-box-xxxxx { background-color: transparent !important; padding: 0 !important; }
   ```
   Se esse box também continha um heading de texto (RD `rd-text`) pensado para contrastar com o background removido, o heading pode ficar **ilegível** (cor pensada para o fundo antigo, agora sobre o fundo da seção). Resolva movendo o heading para `{{str_form_title}}` (adapt.md item a, e register.md): ele passa a renderizar **dentro** do card do tema, que já tem contraste correto. Não tente recolorir o texto solto.

6. **Submit do CF7 cortando texto longo.** O submit herda largura fixa da coluna com `white-space: pre`/`overflow: clip`; copy longa é cortada. Fix pontual: `input[type="submit"] { white-space: normal; height: auto; }`.

7. **reCAPTCHA "Invalid domain for site key" no local.** Esperado: o domínio de teste não está liberado na chave. **Não é bug**; some em produção.

Ferramentas: `chrome-devtools` (screenshot + `evaluate_script` para medir `getBoundingClientRect`, `scrollWidth` vs `clientWidth`, `getComputedStyle`) acham conflitos de layout rápido. Mas **abra a LP inteira e olhe**: o widget quebrado da próxima LP você ainda não viu.

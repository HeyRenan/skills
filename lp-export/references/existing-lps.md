# LPs existentes (referência, pode ficar desatualizado)

Tabela de auditoria (pasta → slug de URL → `SLUG` PHP → `NAME` PHP → casa no CRM?) no momento do último levantamento:

| Pasta | Slug de URL | `SLUG` (PHP) | `NAME` (PHP) | Casa no CRM? |
| --- | --- | --- | --- | --- |
| `como-construir-reserva-cognitiva` | `como-construir-reserva-cognitiva` | `lp-e-book-como-construir-reserva-cognitiva` | `LP e-book como construir reserva cognitiva` | ✅ |
| `como-melhorar-a-concentracao` | `como-melhorar-a-concentracao` | `lp-e-book-como-melhorar-a-concentracao` | `LP e-book como melhorar a concentração` | ✅ |
| `como-melhorar-comunicacao` | `como-melhorar-comunicacao` | `lp-e-book-como-melhorar-comunicacao` | `LP e-book como melhorar a comunicação` | ✅ |
| `como-parar-de-procrastinar` | `como-parar-de-procrastinar` | `lp-como-parar-de-procrastinar` | `LP como parar de procrastinar` | ✅ |
| `ebook-estudo-cientifico` | `ebook-estudo-cientifico` | `lp-estudo-cientifico` | `LP Estudo Científico` | ✅ |
| `estrategias-de-memoria` | `estrategias-de-memoria` | `lp-e-book-estrategias-de-memoria` | `LP e-book Estratégias de memória` | ✅ |
| `exercicio-sono-e-alimentacao` | `exercicio-sono-e-alimentacao` | `exercicio-sono-e-alimentacao` | `LP - Exercício, Sono e Alimentação` | ❌ mismatch (CRM tem `LP e-book Exercício, Sono e Alimentação`) |
| `melhore-o-desempenho-do-seu-filho` | `melhore-o-desempenho-do-seu-filho` | `lp-e-book-melhore-o-desempenho-do-seu-filho` | `LP e-book melhore o desempenho do seu filho` | ✅ |
| `momento-supera` | `momento-supera` | `lp-momento-supera` | `LP momento supera` | ✅ |
| `revista-supera-edicao-15` | `revista-supera-edicao-15` | `lp-revista-supera-15` | `Revista Método SUPERA 15ª Edição` | ✅ |
| `treine-o-raciocinio-para-concursos` | `treine-o-raciocinio-para-concursos` | `lp-treine-o-raciocinio-para-concursos` | `LP Treine o Raciocínio para Concursos` | ❌ mismatch (CRM tem `LP e-book Treine o Raciocínio para Concursos`) |
| `lp-por-que-devo-exercitar-minha-memoria` | `por-que-devo-exercitar-minha-memoria` | `lp-por-que-devo-exercitar-minha-memoria` | `LP por que devo exercitar minha memória` | ❌ mismatch (CRM tem `LP e-book por que devo exercitar minha memória`) |
| `o-segredo-dos-super-idosos` | `o-segredo-dos-super-idosos` | — | `O Segredo dos Superidosos` | ✅ |
| `live-superdotacao-em-foco` | `live-superdotacao-em-foco` | `lp-live-superdotacao-em-foco` | `LP Live Superdotação em foco` | ✅ |

Outras entradas na lista do `scripts-footer` que **não** são export RD clássico (têm build próprio, não seguem este fluxo): `supera-quiz-soft-skills`, `guia-60`, `semana-cerebro-2026`, `estudo-supera`, `o-que-e-o-supera`.

**Bugs conhecidos que não são seus para corrigir de bandeja** (só se a tarefa pedir, e com confirmação do dono):
- As 3 LPs marcadas ❌ têm `NAME` divergente da entrada no CRM (`integracao-form-crm.php`): o `$origin` não é setado para esses leads até alguém decidir qual string é a canônica e igualar os dois lados.
- `momento-supera/index.php`: tem `<?php bloginfo('template_url') ?>/ assets/js/jquery.mask.js` (espaço antes de `assets`), então a máscara de telefone está quebrada.
- A maioria das `agradecimento/index.php` mais antigas é HTML cru salvo do browser (ver adapt.md): só migre quando for tocar nelas por outro motivo.
- `ebook-estudo-cientifico` é fora do padrão Bricks do RD (sem `id="rd-*"`, fontes próprias em `files/fonts/`): não force os seletores das demais.

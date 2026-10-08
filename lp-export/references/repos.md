# Repositórios e deploy

Duas pontas, repositórios **diferentes**.

## A) A LP → repo próprio, commit direto na `main`

- Remote (SSH): `git@gitlab.com:somadevbr-group/projetos_metodo-supera/<slug>.git`.
- O repo é criado no GitLab **antes** do push. Convenção de nome (confirmada via API nos repos irmãos): **nome de exibição** do projeto = `LP - <Nome>` (ex.: `LP - Live Superdotação em foco`), **path/slug** = `<slug>` **sem** prefixo `lp-` (mesmo quando o nome de exibição sugere um). Com `glab`:
  ```bash
  glab repo create <slug> --group somadevbr-group/projetos_metodo-supera --name "LP - <Nome>" --defaultBranch main --internal
  ```
- Dentro de `<slug>/`: `git init -b main` → `git remote add origin …` → `git add .` → commit → `git push -u origin main`.
- **README** no padrão flat dos irmãos: `# Supera LP - <Nome>`, passo de clone, criar `Formulário padrão` com o conteúdo de register.md, `enviar_lead`, e `Go to http://yourproject.test/<slug>`. Copie de um irmão (ex.: `como-construir-reserva-cognitiva/README.md`) e troque só título e URLs. Sem `.gitignore`; cheque que não sobe `.DS_Store` nem backup.

## B) Mudanças do tema (`scripts-footer.php` + `integracao-form-crm.php`) → MR no repo principal

- Repo principal = **`supera-update`** (git root `wp-content/themes/supera`, remote `git@gitlab.com:somadevbr-group/supera-update.git`). **Default branch = `master`** (não `main`).
- Antes de mexer: `git status` no repo do tema. Se a branch em checkout já tiver mudanças não commitadas de outra tarefa, **não são suas**: `git stash push -u -m "..."` para guardar, faça seu trabalho, e restaure (`git stash pop`) só depois de devolver a branch original, sem misturar os dois.
- Branch **`feat/<slug>`** a partir da `origin/master` **fresca** (`git fetch && git checkout -b feat/<slug> origin/master`), não a partir da branch que estava em checkout, que costuma estar atrás.
- Refaça as duas edições de register.md nessa branch nova (confira se a `master` já não tem outras entradas que sua cópia local não tinha, e incorpore as duas). Espere **conflito em `integracao-form-crm.php`** se reaproveitar um patch em vez de reeditar: resolva **mantendo as duas adições**, nunca sobrescrevendo a lista da master.
- Abrir ou atualizar a MR: use a skill **`/templeforge:open`** (plugin templeforge). Ela detecta a branch/MR já existente e faz update em vez de duplicar. Fluxo mínimo: escreva `summary.md`/`changes.md`/`testing.md` num scratch dir e um `manifest.json` (`slug`, `title`, `project: somadevbr-group/supera-update`, `sections`), depois `node <plugin>/scripts/ship-flow.mjs manifest.json`. Sem Wrike task para esse tipo de tarefa, pode usar `"strictness": "loose"`. Se `templeforge` não estiver disponível, fallback manual: `git push -u origin feat/<slug> -o merge_request.create -o merge_request.target=master -o merge_request.title="…" -o merge_request.description="…"` (descrição em **linha única**; push option não aceita `\n`).
- Commits **sem** linha de co-autoria.
- Ao terminar de testar, **devolva o repo do tema à branch original** que estava em checkout (`git stash pop` se tinha guardado algo no início). Se ainda for testar mais depois, pode deixar em `feat/<slug>` temporariamente; só avise que o registro não vale na branch original até isso acontecer (o `default-form.min.css` só sai na branch com o registro).

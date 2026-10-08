---
name: gitlab-mr-comment
description: Posts a review thread (bug) or plain comment (nit) on a GitLab merge request in the user's fixed review pattern. Visual issues get a screenshot; code-only issues are anchored to the exact lines with a short technical explanation. Use when the user asks to open a thread, flag an adjustment, leave a review comment, or report a visual or code issue on an MR.
argument-hint: <iid?> <bug|nit?> <description of the adjustment>
---

Post a review note on a GitLab MR. Act directly: no draft, no questions, no summary.

User input: $ARGUMENTS

## 1. Resolve

```
IID=<from input, else the current branch's MR: glab mr view>
PROJ=$(git remote get-url origin | sed -E 's#^(git@[^:]+:|https?://[^/]+/)##; s#\.git$##; s#/#%2F#g')
HANDLE=@<author username from: glab mr view $IID>
MR_URL=$(glab api "projects/$PROJ/merge_requests/$IID" | python3 -c "import sys,json;print(json.load(sys.stdin)['web_url'])")
```

Channel: **thread** by default, **comment** only for `nit`.

## 2. Classify

| Kind | Reached by | Screenshot | Anchor | Tone |
| --- | --- | --- | --- | --- |
| **Visual** | Looking at a page | Required | none | Plain, non-technical |
| **Behavior** | Using the feature or the MR: wrong result, conflict, CI failure | none | none | Plain, non-technical |
| **Code-only** | Reading code only: a bug or smell no user can see | none | exact lines | Light technical |

- Visual → take a screenshot (step 3) and upload it. It gives `$MD`.
- Code-only → get `FILE` and `LINE` from `glab mr diff $IID`: the new-file line of a changed line. If the problem is on an unchanged line, anchor to the nearest changed one and name the real line in the text.

## 3. Screenshot (Visual only)

Capture with whatever tool can do it (browser tool, screenshot script). Save inside the workspace root, e.g. `./.review-shots/x.png`.

- Crop to the smallest element that shows the issue (the button, the card), never its section or wrapper. Full viewport only when the page layout is the subject.
- Use a desktop viewport (1440x900), not the mobile default.
- Look at the result. If it frames the whole screen for a non-layout issue, the target was too broad: narrow it and re-shoot.

Upload exactly like this. `glab api -F file=@` fails (`{"error":"file is invalid"}`) and `glab auth token` gives no usable token. The `glab config get token` value is OAuth, so use `Bearer`.

```
T=$(glab config get token --host gitlab.com | tr -d '\r\n')
MD=$(curl -s -X POST "https://gitlab.com/api/v4/projects/$PROJ/uploads" \
  -H "Authorization: Bearer $T" \
  -F "file=@./.review-shots/x.png;type=image/png" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['markdown'])")
```

Self-hosted: swap `gitlab.com` for the remote's host in both places.

## 4. Body

1. Opening, verbatim: `@HANDLE, consegue dar uma olhada nesse ajuste:`
2. Summary:
   - Visual, Behavior: one or two plain sentences, one keyword.
   - Code-only: two short sentences. First the **cause**: what is wrong, in plain words (what shares, overrides or misses what). Then the **effect**: what breaks because of it. Name only the one or two identifiers where the cause lives, in backticks. Do not list symptoms, every affected file, or the mechanism step by step. The reader must understand the problem without opening the code. One finding per thread.
     Example: "Os trabalhos usam a mesma taxonomia `category` dos posts do Journal. Com `category.php`, toda página de categoria passa a mostrar trabalhos, inclusive as categorias do Journal."
3. `$MD` on its own line (Visual only).

Never: emoji, greeting, `Bug:`/`Nit:` labels, code at the start, suggestions or solutions, a list of symptoms, more than two identifiers, more than one finding per thread.

If the draft names what breaks before saying why it breaks, rewrite it cause first.

## 5. Post

Capture the response in `RESP`:

```
# thread: Visual or Behavior
RESP=$(glab api "projects/$PROJ/merge_requests/$IID/discussions" -f "body=$BODY")

# thread: Code-only
read BASE START HEAD < <(glab api "projects/$PROJ/merge_requests/$IID" \
  | python3 -c "import sys,json;r=json.load(sys.stdin)['diff_refs'];print(r['base_sha'],r['start_sha'],r['head_sha'])")
RESP=$(glab api "projects/$PROJ/merge_requests/$IID/discussions" \
  -f "body=$BODY" -f "position[position_type]=text" \
  -f "position[base_sha]=$BASE" -f "position[start_sha]=$START" -f "position[head_sha]=$HEAD" \
  -f "position[new_path]=$FILE" -f "position[old_path]=$FILE" -F "position[new_line]=$LINE")

# comment: nit, any kind (Code-only: put FILE:LINE in the text)
RESP=$(glab api "projects/$PROJ/merge_requests/$IID/notes" -f "body=$BODY")
```

Build the link (works for a thread and a comment):

```
NOTE_ID=$(echo "$RESP" | python3 -c "import sys,json;d=json.load(sys.stdin);print((d.get('notes') or [d])[0]['id'])")
echo "$MR_URL#note_$NOTE_ID"
```

## 6. Output

Always print the note link, and nothing else. On a failed command, print the error instead.

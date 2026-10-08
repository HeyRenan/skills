#!/usr/bin/env python3
"""Pack the review threads of a GitLab MR with what changed since each was opened.

  threads.py <iid> [--all]     --all: threads from every author, resolved ones included

Default: unresolved threads opened by the current glab user. Run inside the repo. Read-only.
"""
import json
import re
import subprocess
import sys


def run(*cmd):
    done = subprocess.run(cmd, capture_output=True, text=True)
    if done.returncode:
        sys.exit(f"{' '.join(cmd[:4])}…: {done.stderr.strip() or done.stdout.strip()}")
    return done.stdout


def api(path):
    return json.loads(run('glab', 'api', path))


def clip(text, size):
    text = re.sub(r'\s+', ' ', text or '').strip()
    return text if len(text) <= size else text[: size - 1] + '…'


def project_path():
    remote = run('git', 'remote', 'get-url', 'origin').strip()
    path = re.sub(r'^(git@[^:]+:|https?://[^/]+/)', '', remote)
    return re.sub(r'\.git$', '', path).replace('/', '%2F')


def all_pages(path):
    items, page = [], 1
    while True:
        chunk = api(f'{path}{"&" if "?" in path else "?"}per_page=100&page={page}')
        items += chunk
        if len(chunk) < 100:
            return items
        page += 1


def hunks_near(old_sha, new_sha, file, line, radius=6):
    """Diff hunks between the two commits that touch the area around `line` (numbered in old_sha)."""
    diff = subprocess.run(['git', 'diff', '-U0', old_sha, new_sha, '--', file], capture_output=True, text=True)
    if diff.returncode:
        return 'old commit not available locally (force-push?): judge from the current MR diff'
    if not diff.stdout.strip():
        return f'{file} not touched since the comment'
    blocks, current = [], None
    for text in diff.stdout.split('\n'):
        header = re.match(r'@@ -(\d+)(?:,(\d+))? ', text)
        if header:
            start, count = int(header.group(1)), int(header.group(2) or 1)
            current = [] if start - radius <= line <= start + max(count, 1) + radius else None
            if current is not None:
                blocks.append(current)
        elif current is not None and text[:1] in '+-':
            current.append(text)
    lines = [t for block in blocks for t in block][:30]
    return '\n'.join(f'    {t}' for t in lines) if lines else f'{file} changed, but not near line {line}'


def main(args):
    everything = '--all' in args
    iid = next(a for a in args if not a.startswith('--'))
    proj = project_path()
    me = api('user')['username']
    mr = api(f'projects/{proj}/merge_requests/{iid}')
    subprocess.run(['git', 'fetch', '-q', 'origin'], capture_output=True)
    head_now = mr['diff_refs']['head_sha']
    commits = api(f'projects/{proj}/merge_requests/{iid}/commits?per_page=100')
    print(f"MR !{iid} {mr['web_url']}  head={head_now[:8]}  user={me}")

    shown = 0
    for discussion in all_pages(f'projects/{proj}/merge_requests/{iid}/discussions'):
        notes = [n for n in discussion['notes'] if not n.get('system')]
        if not notes or not notes[0].get('resolvable'):
            continue
        first, resolved = notes[0], all(n.get('resolved') for n in notes if n.get('resolvable'))
        if not everything and (resolved or first['author']['username'] != me):
            continue
        shown += 1
        position = first.get('position') or {}
        file, line = position.get('new_path'), position.get('new_line')
        where = f'{file}:{line}' if file and line else 'unattached'
        print(f"\n#{shown} {where}  by={first['author']['username']}  at={first['created_at'][:16]}  resolved={resolved}")
        print(f"  link: {mr['web_url']}#note_{first['id']}")
        print(f"  BODY: {clip(first['body'], 400)}")
        for reply in notes[1:4]:
            print(f"  REPLY {reply['author']['username']}: {clip(reply['body'], 160)}")
        if file and line:
            then = position.get('head_sha')
            if then == head_now:
                print('  CHANGE: no new commits since the comment')
            else:
                print('  CHANGE (diff from the commit at comment time to now, near the line):')
                print(hunks_near(then, head_now, file, int(line)))
        else:
            later = [c for c in commits if c['committed_date'] > first['created_at']]
            print('  COMMITS AFTER: ' + ('; '.join(f"{c['short_id']} {clip(c['title'], 70)}" for c in later[:8]) or 'none'))
    if not shown:
        print('no matching threads')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])

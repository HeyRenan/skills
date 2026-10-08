#!/usr/bin/env python3
"""Find a past Claude Code session and print a compact digest of it.

  recover.py list [terms...] [--days N]     candidate sessions, newest and best match first
  recover.py extract <id-prefix|path> [--max N]   digest of one session

Reads ~/.claude/projects/*/*.jsonl. Prints user and assistant text only, never tool output.
"""
import glob
import json
import os
import re
import sys
import time
from datetime import datetime

ROOT = os.path.expanduser('~/.claude/projects')
NOISE_START = ('<', 'Caveat:', '[Request interrupted', 'Base directory for this skill')


def text_of(content, role):
    """Plain text of a message, or '' for tool results, thinking and system wrappers."""
    if isinstance(content, str):
        parts = [content]
    else:
        parts = [b.get('text', '') for b in content if isinstance(b, dict) and b.get('type') == 'text']
    text = '\n'.join(p for p in parts if p).strip()
    if role == 'user' and text.startswith(NOISE_START):
        return ''
    return re.sub(r'\s+', ' ', text)


def records(path):
    with open(path, errors='ignore') as handle:
        for line in handle:
            try:
                yield json.loads(line)
            except ValueError:
                continue


def clip(text, size):
    return text if len(text) <= size else text[: size - 1] + '…'


def session_files(days):
    """Sessions from the last `days`, skipping any written in the last 2 minutes (the running one)."""
    now = time.time()
    files = [f for f in glob.glob(f'{ROOT}/*/*.jsonl') if now - days * 86400 <= os.path.getmtime(f) <= now - 120]
    return sorted(files, key=os.path.getmtime, reverse=True)


def summarize(path, terms):
    first = last = cwd = branch = ''
    turns = hits = 0
    for line in open(path, errors='ignore'):
        low = line.lower()
        hits += sum(low.count(t) for t in terms)
        if '"type":"assistant"' in line:
            turns += 1
        if '"type":"user"' not in line:
            continue
        try:
            record = json.loads(line)
        except ValueError:
            continue
        cwd = cwd or record.get('cwd', '')
        branch = record.get('gitBranch') or branch
        message = record.get('message') or {}
        text = text_of(message.get('content', ''), 'user')
        if text and not record.get('isMeta'):
            first = first or text
            last = text
    return {'path': path, 'id': os.path.basename(path)[:-6], 'cwd': cwd, 'branch': branch,
            'turns': turns, 'hits': hits, 'first': first, 'last': last,
            'mtime': os.path.getmtime(path)}


def command_list(args):
    days = 14
    if '--days' in args:
        index = args.index('--days')
        days = int(args[index + 1])
        args = args[:index] + args[index + 2:]
    terms = [a.lower() for a in args]
    rows = [summarize(f, terms) for f in session_files(days)]
    rows = [r for r in rows if r['turns'] > 0]
    if terms:
        rows = [r for r in rows if r['hits'] > 0]
        rows.sort(key=lambda r: (r['hits'] / max(r['turns'], 1), r['mtime']), reverse=True)
    for r in rows[:10]:
        when = datetime.fromtimestamp(r['mtime']).strftime('%m-%d %H:%M')
        print(f"{r['id'][:8]}  {when}  {os.path.basename(r['cwd']) or '?'}  turns={r['turns']}"
              + (f"  hits={r['hits']}" if terms else '') + f"  first: {clip(r['first'], 70)}  | last: {clip(r['last'], 60)}")
    if not rows:
        print('no session found; widen with --days or change the terms')


def resolve(target):
    if os.path.isfile(target):
        return target
    matches = glob.glob(f'{ROOT}/*/{target}*.jsonl')
    if len(matches) != 1:
        sys.exit(f'{len(matches)} sessions match "{target}"; use a longer id prefix')
    return matches[0]


def command_extract(args):
    limit = 6000
    if '--max' in args:
        index = args.index('--max')
        limit = int(args[index + 1])
        args = args[:index] + args[index + 2:]
    path = resolve(args[0])
    asks, replies, files, commits, wrike = [], [], [], [], set()
    cwd = branch = start = end = ''
    turns = 0
    for record in records(path):
        cwd = cwd or record.get('cwd', '')
        branch = record.get('gitBranch') or branch
        stamp = record.get('timestamp', '')
        start = start or stamp
        end = stamp or end
        message = record.get('message') or {}
        content = message.get('content', '')
        kind = record.get('type')
        if kind == 'user' and not record.get('isMeta'):
            text = text_of(content, 'user')
            if text:
                asks.append(clip(text, 240))
                wrike.update(re.findall(r'wrike\.com/\S*?id=(\d+)', text))
        elif kind == 'assistant':
            turns += 1
            text = text_of(content, 'assistant')
            if text:
                replies.append(clip(text, 600))
            for block in content if isinstance(content, list) else []:
                if block.get('type') != 'tool_use':
                    continue
                data = block.get('input', {})
                if block['name'] in ('Write', 'Edit', 'NotebookEdit') and data.get('file_path'):
                    files.append(data['file_path'])
                command = data.get('command', '') if block['name'] == 'Bash' else ''
                if 'git commit' in command:
                    found = re.search(r'-m\s+["\']([^"\'\n]+)', command)
                    commits.append(found.group(1) if found else 'commit')
                if ('git push' in command or 'glab mr create' in command) and commits[-1:] != ['(pushed or opened MR)']:
                    commits.append('(pushed or opened MR)')
    unique_files = list(dict.fromkeys(reversed(files)))[:25][::-1]
    out = [f"SESSION {os.path.basename(path)[:-6]}  cwd={cwd}  branch={branch}  turns={turns}  {start[:16]} to {end[:16]}"]
    if wrike:
        out.append('WRIKE ' + ', '.join(sorted(wrike)))
    shown = asks if len(asks) <= 20 else asks[:5] + ['…'] + asks[-14:]
    out.append('USER ASKS')
    out += [f'  {i}. {a}' if a != '…' else '  …' for i, a in enumerate(shown, 1)]
    if unique_files:
        out.append('FILES EDITED (oldest first)')
        out += [f'  {f}' for f in unique_files]
    if commits:
        out.append('COMMITS AND PUSHES')
        out += [f'  {c}' for c in commits[-10:]]
    out.append('LAST ASSISTANT MESSAGES')
    out += [f'  > {r}' for r in replies[-3:]]
    print(clip('\n'.join(out), limit))


if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in ('list', 'extract'):
        sys.exit(__doc__)
    (command_list if sys.argv[1] == 'list' else command_extract)(sys.argv[2:])

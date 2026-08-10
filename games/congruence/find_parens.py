import re

with open(r'C:\Users\samsung\.gemini\antigravity\scratch\halomath\games\congruence\game.js', 'r', encoding='utf-8') as f:
    content = f.read()
    lines = content.split('\n')

# Track cumulative paren balance, ignoring parens inside strings/regex/comments
balance = 0
in_string = None  # None, "'", '"', '`'
in_line_comment = False
in_block_comment = False
prev_balance = 0

suspicious = []

for line_no, line in enumerate(lines, 1):
    line_open = 0
    line_close = 0
    i = 0
    while i < len(line):
        c = line[i]
        
        # Handle block comments
        if in_block_comment:
            if c == '*' and i + 1 < len(line) and line[i+1] == '/':
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue
        
        # Handle line comments
        if in_line_comment:
            break
            
        # Handle strings
        if in_string:
            if c == '\\':
                i += 2  # skip escaped char
                continue
            if c == in_string:
                in_string = None
            i += 1
            continue
        
        # Not in string/comment
        if c == '/' and i + 1 < len(line) and line[i+1] == '/':
            in_line_comment = True
            break
        if c == '/' and i + 1 < len(line) and line[i+1] == '*':
            in_block_comment = True
            i += 2
            continue
        if c in ("'", '"', '`'):
            in_string = c
            i += 1
            continue
        if c == '(':
            line_open += 1
        elif c == ')':
            line_close += 1
        i += 1
    
    in_line_comment = False
    balance += line_open - line_close
    
    # Report if balance changes significantly or goes negative
    if balance < 0:
        suspicious.append(f"Line {line_no}: NEGATIVE balance={balance} | {line.strip()}")
    
    if line_open - line_close >= 2 and '(' not in ('forEach', 'map', 'filter'):
        suspicious.append(f"Line {line_no}: +{line_open-line_close} (bal={balance}) | {line.strip()[:100]}")
    
    prev_balance = balance

print(f"Final balance: {balance} (should be 0)")
print(f"\nSuspicious lines (large positive imbalance):")
for s in suspicious:
    print(s)

# Also find the regions where balance increases without decreasing
print(f"\n\n=== Balance at key function boundaries ===")
balance2 = 0
in_string2 = None
in_block2 = False
for line_no, line in enumerate(lines, 1):
    i = 0
    while i < len(line):
        c = line[i]
        if in_block2:
            if c == '*' and i+1 < len(line) and line[i+1] == '/':
                in_block2 = False; i += 2; continue
            i += 1; continue
        if in_string2:
            if c == '\\': i += 2; continue
            if c == in_string2: in_string2 = None
            i += 1; continue
        if c == '/' and i+1 < len(line) and line[i+1] == '/': break
        if c == '/' and i+1 < len(line) and line[i+1] == '*': in_block2 = True; i += 2; continue
        if c in ("'", '"', '`'): in_string2 = c; i += 1; continue
        if c == '(': balance2 += 1
        elif c == ')': balance2 -= 1
        i += 1
    
    stripped = line.strip()
    if stripped.startswith('function ') or stripped.startswith('async function') or 'function ' in stripped[:30]:
        print(f"Line {line_no}: balance={balance2} | {stripped[:80]}")

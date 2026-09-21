# -*- coding: utf-8 -*-
# 원본 kitchen-master를 한 픽셀도 바꾸지 않고, 위쪽만 T픽셀 늘린다.
#  - 벽(회벽) 열: 맨 위 몇 줄의 회벽 무늬를 위로 반복
#  - 굴뚝·기둥처럼 위로 이어지는 물체 열: 맨 위 64줄을 위아래로 뒤집어 가며 반복(벽돌 줄이 이어지게)
import os
from PIL import Image

A = r"C:\Users\samsung\.gemini\antigravity\scratch\halomath\games\math-game\games\similar-kitchen\assets"
SRC = os.path.join(A, 'kitchen-master.png')
OUT = os.path.join(A, 'kitchen-scene.png')
T = 200          # 늘릴 높이
PLASTER_ROWS = 12   # 회벽 반복에 쓰는 맨 위 줄 수 (선반은 y=15부터라 그 위까지)
OBJ_PERIOD = 64     # 굴뚝 반복 주기

src = Image.open(SRC).convert('RGB')
W, H = src.size
sp = src.load()

# 회벽 색: 벽 한가운데 맨 위 줄의 중앙값
def med(vals):
    v = sorted(vals); return v[len(v)//2]
pl = tuple(med([sp[x, 5][i] for x in range(300, 850)]) for i in range(3))
print('plaster color', pl)

def far(p, q): return max(abs(p[0]-q[0]), abs(p[1]-q[1]), abs(p[2]-q[2]))

# 각 열이 회벽인지 물체인지: 맨 위 두 줄이 회벽색과 얼마나 다른가
isobj = [x >= 1057 for x in range(W)]
runs = []; s = None
for x in range(W + 1):
    o = isobj[x] if x < W else False
    if o and s is None: s = x
    if (not o) and s is not None: runs.append((s, x - 1)); s = None
print('object column runs (top rows):', runs)

out = Image.new('RGB', (W, H + T))
out.paste(src, (0, T))
op = out.load()

def pingpong(k, n):
    # k=0,1,2,... -> 0..n-1, n-1..0, 0.. 처럼 왔다갔다
    m = k % (2 * n)
    return m if m < n else 2 * n - 1 - m

nrows = []
for x in range(W):
    base = sp[x, 0]; n = 0
    while n < 16 and far(sp[x, n], base) <= 26: n += 1
    nrows.append(max(3, n))
print('wall rows used: min', min(nrows), 'max', max(nrows))
# 벽 열의 색: 위쪽 몇 줄의 평균을 좌우 ±4열까지 평균내어 줄무늬·세로 얼룩을 없앤다
def colavg(x):
    n = nrows[x]; r = g = b = 0
    for yy in range(n):
        p = sp[x, yy]; r += p[0]; g += p[1]; b += p[2]
    return (r/n, g/n, b/n)
raw = [colavg(x) for x in range(W)]
wallcol = []
for x in range(W):
    lo, hi = max(0, x-4), min(W-1, x+4)
    # 물체 열과 섞이지 않게: 같은 종류(벽) 열만 평균
    cs = [raw[i] for i in range(lo, hi+1) if not isobj[i]] or [raw[x]]
    wallcol.append(tuple(int(round(sum(c[j] for c in cs)/len(cs))) for j in range(3)))
for x in range(W):
    for k in range(1, T + 1):        # 원본 맨 위 줄 바로 위 = k=1
        y = T - k
        if isobj[x]:
            sy = pingpong(k - 1, OBJ_PERIOD)
            op[x, y] = sp[x, sy]
        else:
            op[x, y] = wallcol[x]      # 벽은 줄이 안 생기도록 세로로 같은 색

out.save(OUT, 'PNG')
print('saved', OUT, out.size)

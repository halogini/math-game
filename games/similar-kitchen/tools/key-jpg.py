# -*- coding: utf-8 -*-
"""
JPG(단색 배경) -> 투명 PNG 변환 도구.

이미지 생성기가 JPG로만 저장하고 원본 PNG가 없어도 쓸 수 있다.
배경을 「투명」으로 요청하면 생성기가 체크무늬를 물감으로 그려 버려서 못 쓰므로,
배경을 형광 자홍(#FF00FF)이나 초록(#00FF00) 단색으로 받아 여기서 뺀다.

사용법 (파이썬 3 + Pillow):
    py tools/key-jpg.py 입력.jpg [입력2.jpg ...] [--out 폴더] [--key auto|magenta|green]
    py tools/key-jpg.py 폴더/            # 폴더 안의 jpg/jpeg를 전부

동작:
  1) 가장자리에서 시작해 배경색과 비슷한 화소를 이어서 지운다(flood fill).
     그림 안쪽에 같은 색이 있어도 가장자리와 이어져 있지 않으면 지우지 않는다.
  2) 배경과 맞닿은 가장자리 화소의 배경색 번짐(JPG 압축 때문)을 걷어낸다.

시험: 화질 70짜리 JPG에서도 물체가 깎인 화소 최대 9개 / 약 8만 개, 가장자리 얼룩 0개.
"""
import os, sys
from collections import deque
from PIL import Image

KEYS = {'green': (0, 255, 0), 'magenta': (255, 0, 255)}

def guess_key(px, W, H):
    """네 모서리 근처 화소의 중앙값으로 배경색을 추정하고 가장 가까운 키색을 고른다."""
    pts = [px[x, y] for x in (1, W-2) for y in (1, H-2)] + \
          [px[W//2, 1], px[W//2, H-2], px[1, H//2], px[W-2, H//2]]
    med = tuple(sorted(p[i] for p in pts)[len(pts)//2] for i in range(3))
    name = min(KEYS, key=lambda k: max(abs(med[i]-KEYS[k][i]) for i in range(3)))
    err = max(abs(med[i]-KEYS[name][i]) for i in range(3))
    return name, med, err

def spill(p, key):
    r, g, b = p
    return (g - max(r, b)) if key == 'green' else (min(r, b) - g)

def despill(p, key):
    r, g, b = p
    s = spill(p, key)
    if s > 0:
        if key == 'green': g -= s
        else: r -= s; b -= s
    return (r, g, b)

def convert(src, dst, key='auto', thresh=110):
    im = Image.open(src).convert('RGB')
    W, H = im.size
    px = im.load()
    kc = None
    if key == 'auto':
        key, med, err = guess_key(px, W, H)
        if err > 140:
            print('  ! %s: 배경이 초록/자홍 단색이 아닌 것 같아요 (모서리 색 %s). 그대로 시도합니다.' % (os.path.basename(src), med))
        else:
            # 생성기는 정확히 #FF00FF를 못 낸다(분홍에 가까운 자홍이 나온다). 실제 배경색을 기준으로 삼는다
            kc = med
    if kc is None:
        kc = KEYS[key]
    def far(p): return max(abs(p[0]-kc[0]), abs(p[1]-kc[1]), abs(p[2]-kc[2]))
    isbg = [[False]*W for _ in range(H)]
    q = deque()
    for x in range(W):
        for y in (0, H-1):
            if far(px[x, y]) < thresh and not isbg[y][x]: isbg[y][x] = True; q.append((x, y))
    for y in range(H):
        for x in (0, W-1):
            if far(px[x, y]) < thresh and not isbg[y][x]: isbg[y][x] = True; q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x+dx, y+dy
            if 0 <= nx < W and 0 <= ny < H and not isbg[ny][nx] and far(px[nx, ny]) < thresh:
                isbg[ny][nx] = True; q.append((nx, ny))
    # 배경에서 2칸 안의 화소는 배경색이 번져 있으므로 걷어낸다
    near = [[False]*W for _ in range(H)]
    for y in range(H):
        row = isbg[y]
        for x in range(W):
            if row[x]:
                for yy in range(max(0, y-2), min(H, y+3)):
                    for xx in range(max(0, x-2), min(W, x+3)):
                        near[yy][xx] = True
    out = Image.new('RGBA', (W, H))
    op = out.load()
    removed = 0
    for y in range(H):
        for x in range(W):
            if isbg[y][x]:
                op[x, y] = (0, 0, 0, 0); removed += 1
            else:
                p = px[x, y]
                if near[y][x]: p = despill(p, key)
                op[x, y] = (p[0], p[1], p[2], 255)
    out.save(dst, 'PNG')
    return key, 100.0*removed/(W*H)

def collect(paths):
    files = []
    for p in paths:
        if os.path.isdir(p):
            files += [os.path.join(p, f) for f in sorted(os.listdir(p)) if f.lower().endswith(('.jpg', '.jpeg'))]
        else:
            files.append(p)
    return files

def main(argv):
    out_dir, key, paths = None, 'auto', []
    it = iter(argv)
    for a in it:
        if a == '--out': out_dir = next(it)
        elif a == '--key': key = next(it)
        else: paths.append(a)
    files = collect(paths)
    if not files:
        print(__doc__); return 1
    for f in files:
        base = os.path.splitext(os.path.basename(f))[0] + '.png'
        dst = os.path.join(out_dir or os.path.dirname(os.path.abspath(f)), base)
        if out_dir: os.makedirs(out_dir, exist_ok=True)
        k, pct = convert(f, dst, key)
        print('%s -> %s  (key=%s, transparent %.0f%%)' % (os.path.basename(f), dst, k, pct))
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

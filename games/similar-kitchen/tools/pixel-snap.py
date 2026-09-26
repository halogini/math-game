# -*- coding: utf-8 -*-
"""
「픽셀 아트처럼 보이는」 생성 그림 -> 진짜 픽셀 아트 투명 PNG.

그림 생성기는 네모 픽셀을 흉내만 낸다. 확대하면 네모 안에 색이 번져 있고, 색이 수만 개다.
배경도 투명으로 못 받아서 단색(자홍 등)으로 받는다. 이 도구가 둘 다 정리한다.

  1) 격자 찾기: 색이 바뀌는 경계가 가장 잘 맞는 네모 크기(칸 수)와 시작 위치를 찾는다.
  2) 칸마다 가운데 부분의 중앙값 색 하나로 칠한다(번짐 제거).
  3) 배경: 가장자리 칸과 이어져 있고 배경색에 가까운 칸만 투명으로 만든다(칸 단위 flood fill).
     그림 안쪽 색은 배경과 이어져 있지 않으면 건드리지 않는다.
  4) 색 수를 줄인다(기본 32색). 픽셀 아트처럼 팔레트가 정리된다.
  5) 칸 하나를 정수 배로 키워 저장한다(가장 가까운 이웃, 흐림 없음).

사용법 (py + Pillow):
    py tools/pixel-snap.py 원본.png 결과.png [--cells N] [--colors 32] [--tol 70] [--size 1024]
      --cells  한 줄의 칸 수를 직접 준다(자동으로 못 찾을 때)
      --tol    배경색과 이 거리(RGB) 안이면 배경으로 본다
      --size   결과 캔버스 한 변(칸 × 정수 배율을 이 크기 안에서 가장 크게, 남는 곳은 투명 여백)
      --match  원본 한 변을 이 칸 수로 본 크기로 픽셀을 맞춘다(예: 55 = 곰). 그림마다 픽셀 크기가 같아진다
"""
import sys
from collections import deque
from PIL import Image

def edge_profile(px, W, H):
    """열(세로선)·행(가로선)마다 옆 화소와의 색 차이 합. 격자 경계에서 크다."""
    col = [0.0] * W
    row = [0.0] * H
    for y in range(0, H, 2):
        for x in range(1, W):
            a, b = px[x - 1, y], px[x, y]
            col[x] += abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])
    for x in range(0, W, 2):
        for y in range(1, H):
            a, b = px[x, y - 1], px[x, y]
            row[y] += abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])
    return col, row

def grid_score(prof, L, s):
    """칸 크기 s일 때 가장 잘 맞는 시작 위치와 점수. 경계(off + k*s)에 차이가 몰릴수록 점수가 높다."""
    mean = sum(prof) / len(prof) or 1
    best = (0.0, 0.0)
    for o10 in range(0, int(s * 10), 5):
        off = o10 / 10
        tot, cnt, k = 0.0, 0, 0
        while True:
            x = int(round(off + k * s))
            if x >= L: break
            if x > 0:
                tot += max(prof[x - 1], prof[x], prof[x + 1] if x + 1 < L else 0)
                cnt += 1
            k += 1
        if cnt and tot / cnt / mean > best[0]: best = (tot / cnt / mean, off)
    return best

def find_grid(col, row, W, H, lo=24, hi=128):
    """픽셀은 정사각형이라 가로·세로에 같은 칸 크기를 쓴다(시작 위치는 따로).
    칸 크기를 두 배로 잘못 잡으면(경계를 하나 걸러 맞춤) 점수가 비슷하게 나오므로,
    최고 점수의 90% 안에 드는 것 가운데 칸이 가장 작은(칸 수가 가장 많은) 것을 고른다."""
    res = []
    for n in range(lo, hi + 1):
        s = W / n
        scx, ox = grid_score(col, W, s)
        scy, oy = grid_score(row, H, s)
        res.append((scx + scy, n, s, ox, oy))
    top = max(r[0] for r in res)
    ok = [r for r in res if r[0] >= top * 0.9]
    return max(ok, key=lambda r: r[1])

def median(vals):
    vals = sorted(vals)
    return vals[len(vals) // 2]

def key_only(src, dst, tol):
    """격자를 건드리지 않고 배경만 지운다(화소 단위).
    생성기가 네모 블록을 고르게 그리지 않은 그림은 어떤 격자로 맞춰도 선이 삐뚤빼뚤해진다.
    원본을 그대로 두고 배경만 지우는 편이 게임 화면 크기에서 가장 자연스럽다.
      1) 네 가장자리 화소의 중앙값 = 배경색
      2) 가장자리와 이어져 있고 배경색에 가까운 화소만 투명(flood fill)
      3) 투명과 맞닿은 화소 가운데 배경색 쪽으로 물든 것(분홍 번짐)을 두 번 더 걷어 낸다"""
    im = Image.open(src).convert('RGB')
    W, H = im.size
    px = im.load()
    edge = [px[x, 0] for x in range(W)] + [px[x, H - 1] for x in range(W)] + \
           [px[0, y] for y in range(H)] + [px[W - 1, y] for y in range(H)]
    bg = tuple(median([c[k] for c in edge]) for k in range(3))
    t2 = tol * tol
    def d2(c): return (c[0]-bg[0])**2 + (c[1]-bg[1])**2 + (c[2]-bg[2])**2
    trans = bytearray(W * H)
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if not trans[y*W+x] and d2(px[x, y]) <= t2: trans[y*W+x] = 1; q.append((x, y))
    for y in range(H):
        for x in (0, W - 1):
            if not trans[y*W+x] and d2(px[x, y]) <= t2: trans[y*W+x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        for a, b in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
            if 0 <= a < W and 0 <= b < H and not trans[b*W+a] and d2(px[a, b]) <= t2:
                trans[b*W+a] = 1; q.append((a, b))
    fr2 = (tol * 2.2) ** 2
    for _ in range(2):
        drop = []
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                i = y*W+x
                if trans[i]: continue
                if (trans[i-1] or trans[i+1] or trans[i-W] or trans[i+W]) and d2(px[x, y]) <= fr2:
                    drop.append(i)
        for i in drop: trans[i] = 1
    out = Image.new('RGBA', (W, H))
    op = out.load()
    for y in range(H):
        for x in range(W):
            if not trans[y*W+x]:
                r, g, b = px[x, y]; op[x, y] = (r, g, b, 255)
    out.save(dst, 'PNG')
    print('key only: background %s, transparent %.0f%%' % (bg, 100.0 * sum(trans) / (W * H)))

def main():
    args = sys.argv[1:]
    if len(args) < 2:
        print(__doc__); sys.exit(1)
    src, dst = args[0], args[1]
    opt = {'--cells': None, '--colors': '32', '--tol': '70', '--size': '1024', '--match': None}
    it = iter(args[2:])
    for a in it:
        if a == '--keyonly': opt['--keyonly'] = True; continue
        if a in opt: opt[a] = next(it)
    if opt.get('--keyonly'):
        key_only(src, dst, float(opt['--tol'])); return
    im = Image.open(src).convert('RGB')
    W, H = im.size
    px = im.load()

    if opt['--cells']:
        n = int(opt['--cells']); nx = ny = n; ox = oy = 0.0
    else:
        col, row = edge_profile(px, W, H)
        sc, nx, s, ox, oy = find_grid(col, row, W, H)
        ny = int(round(H / s))
        print('grid: cell %.2f px (%d x %d), offset (%.1f, %.1f), score %.2f' % (s, nx, ny, ox, oy, sc))
    cw, ch = W / nx, H / ny

    # 칸 경계: 시작 위치 앞의 부분 칸도 하나로 본다
    def edges(off, s, L):
        e = [0]
        x = off
        while x < L - 0.5:
            if x > 0.5: e.append(int(round(x)))
            x += s
        e.append(L)
        return e
    ex, ey = edges(ox, cw, W), edges(oy, ch, H)
    gx, gy = len(ex) - 1, len(ey) - 1

    # 칸 색 = 가운데 절반 영역에서 가장 많이 나온 색(비슷한 색끼리 묶어 센 뒤 그 묶음의 평균).
    # 채널별 중앙값을 쓰면 흰 반짝임 + 검은 눈동자처럼 섞인 칸에서 어디에도 없는 색(주황)이 생겼다
    cells = [[None] * gx for _ in range(gy)]
    for j in range(gy):
        y0, y1 = ey[j], ey[j + 1]
        for i in range(gx):
            x0, x1 = ex[i], ex[i + 1]
            qx0, qx1 = x0 + (x1 - x0) // 4, x1 - (x1 - x0) // 4
            qy0, qy1 = y0 + (y1 - y0) // 4, y1 - (y1 - y0) // 4
            if qx1 <= qx0: qx0, qx1 = x0, x1
            if qy1 <= qy0: qy0, qy1 = y0, y1
            groups = {}
            for y in range(qy0, qy1):
                for x in range(qx0, qx1):
                    r, g, b = px[x, y]
                    k = (r // 24, g // 24, b // 24)
                    s = groups.get(k)
                    if s is None: groups[k] = [1, r, g, b]
                    else: s[0] += 1; s[1] += r; s[2] += g; s[3] += b
            c, r, g, b = max(groups.values(), key=lambda s: s[0])
            cells[j][i] = (r // c, g // c, b // c)

    # 배경색 = 가장자리 칸의 중앙값
    border = [cells[0][i] for i in range(gx)] + [cells[gy - 1][i] for i in range(gx)] + \
             [cells[j][0] for j in range(gy)] + [cells[j][gx - 1] for j in range(gy)]
    bg = tuple(median([c[k] for c in border]) for k in range(3))
    tol = float(opt['--tol'])
    def near(c): return ((c[0]-bg[0])**2 + (c[1]-bg[1])**2 + (c[2]-bg[2])**2) ** 0.5 <= tol
    trans = [[False] * gx for _ in range(gy)]
    q = deque()
    for j in range(gy):
        for i in range(gx):
            if (i in (0, gx - 1) or j in (0, gy - 1)) and near(cells[j][i]):
                trans[j][i] = True; q.append((i, j))
    while q:
        i, j = q.popleft()
        for di, dj in ((1,0),(-1,0),(0,1),(0,-1)):
            a, b = i + di, j + dj
            if 0 <= a < gx and 0 <= b < gy and not trans[b][a] and near(cells[b][a]):
                trans[b][a] = True; q.append((a, b))
    print('background %s, transparent cells %d / %d' % (bg, sum(map(sum, trans)), gx * gy))

    # 작은 그림(칸 1개 = 화소 1개) + 색 수 줄이기
    small = Image.new('RGB', (gx, gy))
    sp = small.load()
    for j in range(gy):
        for i in range(gx):
            sp[i, j] = cells[j][i]
    pal = small.quantize(colors=int(opt['--colors']), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = Image.new('RGBA', (gx, gy), (0, 0, 0, 0))
    op, pp = out.load(), pal.load()
    # 색을 줄이다 원래 색과 많이 달라진 칸은 원래 색을 지킨다.
    # 눈 반짝임처럼 드물지만 중요한 점(흰색)이 가장 가까운 큰 색 무리(크림색)에 합쳐지는 것을 막는다
    keep = 60
    for j in range(gy):
        for i in range(gx):
            if not trans[j][i]:
                r, g, b = pp[i, j]; o = cells[j][i]
                if ((r-o[0])**2 + (g-o[1])**2 + (b-o[2])**2) ** 0.5 > keep: r, g, b = o
                op[i, j] = (r, g, b, 255)

    # --match: 원본 한 변이 N칸인 그림과 픽셀 크기를 같게 맞춘다(가장 가까운 이웃으로 칸 수를 바꾼다)
    if opt['--match']:
        m = int(opt['--match'])
        f = m / (W / cw)
        tw, th = max(1, int(round(gx * f))), max(1, int(round(gy * f)))
        if (tw, th) != (gx, gy):
            out = out.resize((tw, th), Image.NEAREST)
            print('match: %d x %d cells -> %d x %d' % (gx, gy, tw, th))
            gx, gy = tw, th


    # 정수 배로 키워 정사각 캔버스 가운데에 놓는다
    size = int(opt['--size'])
    k = max(1, min(size // gx, size // gy))
    big = out.resize((gx * k, gy * k), Image.NEAREST)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(big, ((size - gx * k) // 2, (size - gy * k) // 2))
    canvas.save(dst, 'PNG')
    print('saved %s: %d x %d cells, x%d -> %d x %d' % (dst, gx, gy, k, size, size))

if __name__ == '__main__':
    main()

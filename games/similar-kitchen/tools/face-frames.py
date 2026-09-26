# -*- coding: utf-8 -*-
"""
손님 픽셀 그림 한 장 -> 표정 프레임(눈 감음, 웃음).

생성기로 프레임을 따로 그리면 윤곽이 한 겹씩 달라져 넘길 때 떨린다.
그래서 기준 그림(pixel-snap.py 결과)의 눈 칸만 바꿔 프레임을 만든다. 나머지 칸은 그대로다.

  -blink.png : 눈을 털색으로 덮고 가운데 줄에 감은 눈 선을 긋는다
  -happy.png : 눈을 ∩ 모양 웃는 눈으로 바꾸고, 눈 바깥 아래에 분홍 볼을 찍는다

눈 찾기: 흰 반짝임 칸(아주 밝은 칸)에서 시작해 이어진 어두운 칸을 모은다(얼굴 한가운데 가까운 두 개).
자동으로 못 찾으면 --eyes x0,y0,x1,y1:x0,y0,x1,y1 (칸 좌표, 끝 포함)로 직접 준다. 눈이 하나만 보이면 하나만 준다.

사용법 (py -3 + Pillow):
    py -3 tools/face-frames.py assets/cust2-bear.png
      -> assets/cust2-bear-blink.png, assets/cust2-bear-happy.png
"""
import sys
from collections import Counter, deque
from PIL import Image

def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

def grid_of(im):
    """칸 크기 k와 격자 시작(ox, oy). pixel-snap 결과는 칸이 정수 배로 커져 있다."""
    px = im.load(); W, H = im.size
    runs = Counter()
    for y in range(0, H, 5):
        x = 0
        while x < W:
            c = px[x, y]; x0 = x
            while x < W and px[x, y] == c: x += 1
            if c[3] and x0 > 0 and x < W: runs[x - x0] += 1
    k = runs.most_common(1)[0][0]
    xs = [x for x in range(W) if any(px[x, y][3] for y in range(0, H, 3))]
    ys = [y for y in range(H) if any(px[x, y][3] for x in range(0, W, 3))]
    return k, xs[0] % k, ys[0] % k

def to_cells(im, k, ox, oy):
    px = im.load(); W, H = im.size
    gw, gh = (W - ox) // k, (H - oy) // k
    return [[px[ox + i * k + k // 2, oy + j * k + k // 2] for i in range(gw)] for j in range(gh)], gw, gh

def find_eyes(cells, gw, gh):
    """흰 반짝임 칸 -> 이어진 어두운 칸 덩어리. 얼굴 한가운데에 가까운 두 덩어리를 눈으로 본다."""
    hl = [(i, j) for j in range(gh) for i in range(gw)
          if cells[j][i][3] and min(cells[j][i][:3]) > 225]
    eyes, used = [], set()
    for (i, j) in hl:
        if (i, j) in used: continue
        blob, q = {(i, j)}, deque([(i, j)])
        while q:
            a, b = q.popleft()
            for da in (-1, 0, 1):
                for db in (-1, 0, 1):
                    x, y = a + da, b + db
                    if (x, y) in blob or not (0 <= x < gw and 0 <= y < gh): continue
                    c = cells[y][x]
                    if c[3] and (lum(c) < 70 or min(c[:3]) > 225) and abs(x - i) <= 4 and abs(y - j) <= 4:
                        blob.add((x, y)); q.append((x, y))
        used |= blob
        xs = [p[0] for p in blob]; ys = [p[1] for p in blob]
        if len(blob) >= 4: eyes.append((min(xs), min(ys), max(xs), max(ys)))
    eyes.sort(key=lambda e: abs((e[0] + e[2]) / 2 - gw / 2))
    eyes = sorted(eyes[:2], key=lambda e: e[0])
    return eyes

def fur_around(cells, e):
    """눈 둘레(바로 바깥 한 칸)에서 가장 많은 색 = 덮을 털색."""
    x0, y0, x1, y1 = e
    cnt = Counter()
    for y in range(y0 - 1, y1 + 2):
        for x in range(x0 - 1, x1 + 2):
            if x0 <= x <= x1 and y0 <= y <= y1: continue
            try: c = cells[y][x]
            except IndexError: continue
            if c[3] and lum(c) >= 70: cnt[c] += 1
    return cnt.most_common(1)[0][0]

def dark_of(cells, e):
    x0, y0, x1, y1 = e
    cnt = Counter(cells[y][x] for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if lum(cells[y][x]) < 70)
    return cnt.most_common(1)[0][0]

def paint(im, k, ox, oy, i, j, c):
    im.paste(c, (ox + i * k, oy + j * k, ox + (i + 1) * k, oy + (j + 1) * k))

def main():
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(1)
    src = a[0]
    im = Image.open(src).convert('RGBA')
    k, ox, oy = grid_of(im)
    cells, gw, gh = to_cells(im, k, ox, oy)
    if '--eyes' in a:
        spec = a[a.index('--eyes') + 1]
        eyes = [tuple(int(v) for v in s.split(',')) for s in spec.split(':')]
    else:
        eyes = find_eyes(cells, gw, gh)
    print('cell %d px, grid start (%d, %d), eyes %s' % (k, ox, oy, eyes))
    # 자동으로는 두 눈을 찾는다. 비스듬히 선 손님(경주마)처럼 눈이 하나만 보이면 --eyes로 하나만 준다
    if len(eyes) != 2 and '--eyes' not in a:
        print('눈을 두 개 찾지 못했다. --eyes로 직접 주세요.'); sys.exit(2)

    base = src[:-4]
    # 눈 감음: 털로 덮고 눈 높이 가운데(조금 아래) 줄에 선
    blink = im.copy()
    for e in eyes:
        fur, dark = fur_around(cells, e), dark_of(cells, e)
        x0, y0, x1, y1 = e
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): paint(blink, k, ox, oy, x, y, fur)
        ym = (y0 + y1 + 1) // 2
        for x in range(x0, x1 + 1): paint(blink, k, ox, oy, x, ym, dark)
    blink.save(base + '-blink.png')

    # 웃음: ∩ 눈(가운데 윗줄 + 양 끝 아랫줄) + 눈 바깥 아래 분홍 볼
    happy = im.copy()
    pink = (238, 128, 132, 255)
    for n, e in enumerate(eyes):
        fur, dark = fur_around(cells, e), dark_of(cells, e)
        x0, y0, x1, y1 = e
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): paint(happy, k, ox, oy, x, y, fur)
        yt = (y0 + y1) // 2
        for x in range(x0 + 1, x1): paint(happy, k, ox, oy, x, yt, dark)
        paint(happy, k, ox, oy, x0, yt + 1, dark); paint(happy, k, ox, oy, x1, yt + 1, dark)
        # 볼: 바깥쪽으로 한 칸 비켜 두 칸
        by = y1 + 1
        bx = [x0 - 1, x0] if n == 0 else [x1, x1 + 1]
        for x in bx:
            if 0 <= x < gw and 0 <= by < gh and cells[by][x][3]: paint(happy, k, ox, oy, x, by, pink)
    happy.save(base + '-happy.png')
    print('saved %s-blink.png, %s-happy.png' % (base, base))

if __name__ == '__main__':
    main()

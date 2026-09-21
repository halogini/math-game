# -*- coding: utf-8 -*-
# kitchen-scene(카운터·도마·오븐이 있는 장면)의 뒷벽을 kitchen-back-wall로 갈아 끼운다.
# 오븐(굴뚝 포함)은 그대로 남긴다: 행마다 오븐 왼쪽 윤곽을 찾아서 그 왼쪽만 새 벽으로 바꾼다.
import os, colorsys
from PIL import Image

A = r"C:\Users\samsung\.gemini\antigravity\scratch\halomath\games\math-game\games\similar-kitchen\assets"
scene = Image.open(os.path.join(A, 'kitchen-scene.png')).convert('RGB')
back = Image.open(os.path.join(A, 'kitchen-back-wall.png')).convert('RGB')
W, H = scene.size
sp = scene.load(); bp = back.load()

Y_CUT = 407            # 이 줄 위쪽만 새 벽. 아래(바닥 띠·카운터)는 기존 그대로
WALL_ROWS = 375        # 새 벽에서 가져올 줄 수 (0..374)
BASE_SRC = (660, 692)  # 뒷벽 그림의 굽도리 줄 범위 (32줄)

# 새 벽 캔버스 (W x Y_CUT)
nw = Image.new('RGB', (W, Y_CUT)); np_ = nw.load()
for y in range(WALL_ROWS):
    for x in range(W): np_[x, y] = bp[x, y]
for i in range(Y_CUT - WALL_ROWS):
    sy = BASE_SRC[0] + i
    for x in range(W): np_[x, WALL_ROWS + i] = bp[x, sy]

def hsv(p):
    h, s, v = colorsys.rgb_to_hsv(p[0]/255, p[1]/255, p[2]/255); return h, s, v

def V(p): return hsv(p)[2]

# 오븐 왼쪽 윤곽선 = 어두운 화소(밝기 0.36 미만) 중, 왼쪽 4칸 앞과 오른쪽 6칸 뒤가 모두 밝은 것.
# (선반 널빤지의 가로 윤곽선은 오른쪽도 어두워서 여기서 걸러진다)
left = [None] * Y_CUT
for y in range(Y_CUT):
    found = None
    for x in range(1005, 1112):
        if V(sp[x, y]) < 0.36 and V(sp[x-4, y]) >= 0.40 and V(sp[x+6, y]) >= 0.40:
            found = x; break
    left[y] = found
# 빈 행은 위아래 이웃으로 메우고, 끝까지 없으면 기본값
last = None
for y in range(Y_CUT):
    if left[y] is None: left[y] = last
    else: last = left[y]
nxt = None
for y in range(Y_CUT - 1, -1, -1):
    if left[y] is None: left[y] = nxt
    else: nxt = left[y]
left = [(v if v is not None else 1013) for v in left]
# 들쭉날쭉한 잡음 정리: 이웃 5행의 중앙값
sm = []
for y in range(Y_CUT):
    win = sorted(left[max(0, y-2):y+3]); sm.append(win[len(win)//2])
left = sm
# 돔 아래쪽(290줄부터)은 오븐 몸통이라 왼쪽 끝이 1013 근처다. 그보다 크게 나온 값은 잘못 잡힌 것
for y in range(290, Y_CUT):
    if left[y] > 1030: left[y] = 1013
print('oven left edge sample rows:', {y: left[y] for y in (0, 60, 120, 200, 250, 300, 350, 400)})

out = scene.copy(); op = out.load()
for y in range(Y_CUT):
    for x in range(left[y] - 1):          # 윤곽선 자체(left)는 오븐 것을 남긴다
        op[x, y] = np_[x, y]
out.save(os.path.join(A, 'kitchen-full.png'), 'PNG')
print('saved kitchen-full.png', out.size)

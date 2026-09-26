#!/usr/bin/env python3
"""OG-обложка «Погода в горах» 1200×630 для og:image (шеринг/превью ссылок).
Тот же почерк, что у PWA-иконок (gen_icons.py): тёмное небо, горы, луна, звёзды.
Чистый PNG-энкодер на zlib (PIL в среде нет). Результат: icons/og-cover.png."""
import os, struct, zlib

W, H = 1200, 630

def write_png(path, w, h, px):
    raw = b""
    for y in range(h):
        raw += b"\x00" + bytes(px[y])
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)

BG_TOP = (16, 28, 48, 255)     # небо сверху
BG_BOT = (11, 18, 32, 255)     # #0b1220 снизу
MT_FAR = (143, 163, 191, 255)  # #8fa3bf
MT_MID = (70, 92, 122, 255)
MT_NEAR = (223, 234, 242, 255) # #dfeaf2
SNOW = (255, 255, 255, 255)
MOON = (232, 244, 248, 255)
STAR = (198, 214, 232, 255)

px = [bytearray(W * 4) for _ in range(H)]

def setp(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        i = x * 4
        px[y][i:i+4] = bytes(c)

# вертикальный градиент неба
for y in range(H):
    t = y / (H - 1)
    c = tuple(round(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t) for i in range(3)) + (255,)
    row = bytes(c) * W
    px[y][:] = row

def tri(x0, y0, x1, y1, x2, y2, c):
    pts = sorted([(x0, y0), (x1, y1), (x2, y2)], key=lambda p: p[1])
    (ax, ay), (bx, by), (cx, cy) = pts
    def interp(y, xa, ya, xb, yb):
        if yb == ya: return xa
        return xa + (xb - xa) * (y - ya) / (yb - ya)
    for y in range(max(0, ay), min(H, cy + 1)):
        xl = interp(y, ax, ay, cx, cy)
        xr = interp(y, ax, ay, bx, by) if y <= by else interp(y, bx, by, cx, cy)
        if xl > xr: xl, xr = xr, xl
        for x in range(max(0, int(xl)), min(W, int(xr) + 1)):
            setp(x, y, c)

def circle(cx, cy, r, c):
    for y in range(max(0, cy - r), min(H, cy + r + 1)):
        for x in range(max(0, cx - r), min(W, cx + r + 1)):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                setp(x, y, c)

# звёзды (детерминированные позиции — без random, чтобы файл был воспроизводим)
for i in range(90):
    x = (i * 761 + 137) % W
    y = (i * 389 + 71) % 340
    if (x - 940) ** 2 + (y - 150) ** 2 > 90 ** 2:  # не по луне
        setp(x, y, STAR)
        if i % 9 == 0:
            setp(x + 1, y, STAR); setp(x, y + 1, STAR)

# луна
circle(940, 150, 56, MOON)
circle(916, 132, 48, BG_TOP)  # серп: перекрываем сдвинутым кругом цвета неба

# дальняя гряда (серо-голубая)
tri(0, H, 260, 300, 560, H, MT_FAR)
tri(380, H, 660, 340, 940, H, MT_FAR)
# снег на дальней
tri(210, 350, 260, 300, 312, 352, SNOW)
# средняя гряда
tri(500, H, 800, 290, 1130, H, MT_MID)
tri(760, H, 1010, 380, 1200, H, MT_MID)
# ближняя гора (белая, крупная слева)
tri(60, H, 430, 240, 830, H, MT_NEAR)
tri(700, H, 950, 400, 1200, H, MT_NEAR)
# снег на ближней
tri(376, 292, 430, 240, 488, 296, SNOW)

os.makedirs("icons", exist_ok=True)
write_png("icons/og-cover.png", W, H, px)
print("ok icons/og-cover.png", W, "x", H)

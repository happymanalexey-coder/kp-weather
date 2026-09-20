#!/usr/bin/env python3
"""Иконки PWA «Погода в горах»: тёмный фон, белые горы, бирюзовая луна.
   Чистый PNG-энкодер на zlib (PIL в среде нет). Результат: icons/icon-192.png, icon-512.png."""
import os, struct, zlib

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

def make_icon(size):
    bg = (11, 18, 32, 255)          # #0b1220
    mt_far = (143, 163, 191, 255)   # #8fa3bf
    mt_near = (223, 234, 242, 255)  # #dfeaf2
    snow = (255, 255, 255, 255)
    moon = (232, 244, 248, 255)     # как серп в шапке
    px = [bytearray(bg * size) for _ in range(size)]

    def setp(x, y, c):
        if 0 <= x < size and 0 <= y < size:
            i = x * 4
            px[y][i:i+4] = bytes(c)

    def tri(x0, y0, x1, y1, x2, y2, c):
        # scanline заливка треугольника
        pts = sorted([(x0, y0), (x1, y1), (x2, y2)], key=lambda p: p[1])
        (ax, ay), (bx, by), (cx, cy) = pts
        def interp(y, xa, ya, xb, yb):
            if yb == ya: return xa
            return xa + (xb - xa) * (y - ya) / (yb - ya)
        for y in range(max(0, ay), min(size, cy + 1)):
            xl = interp(y, ax, ay, cx, cy)
            if y <= by:
                xr = interp(y, ax, ay, bx, by)
            else:
                xr = interp(y, bx, by, cx, cy)
            if xl > xr: xl, xr = xr, xl
            for x in range(max(0, int(xl)), min(size, int(xr) + 1)):
                setp(x, y, c)

    def circle(cx, cy, r, c):
        for y in range(max(0, cy - r), min(size, cy + r + 1)):
            for x in range(max(0, cx - r), min(size, cx + r + 1)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    setp(x, y, c)

    s = size / 512.0  # масштаб от макета 512
    # дальняя гора (серо-голубая)
    tri(int(40*s), size, int(230*s), int(150*s), int(430*s), size, mt_far)
    # снег на дальней
    tri(int(196*s), int(196*s), int(230*s), int(150*s), int(266*s), int(198*s), snow)
    # ближняя гора (белая)
    tri(int(120*s), size, int(330*s), int(110*s), int(512*s), size, mt_near)
    # снег на ближней
    tri(int(292*s), int(170*s), int(330*s), int(110*s), int(372*s), int(176*s), snow)
    # луна
    circle(int(408*s), int(104*s), int(34*s), moon)
    return px

os.makedirs("icons", exist_ok=True)
for size in (192, 512):
    write_png(f"icons/icon-{size}.png", size, size, make_icon(size))
    print("ok", size)

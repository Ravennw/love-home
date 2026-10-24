/* 背景：沿用 ravenweng.com 的「流动咖啡光」算法（home/pixelbg.js 的 FLOW.dark），
   色阶换成壁炉 / 日落的暖橘玫瑰色，比主站黑夜咖啡更温馨。
   64×120 小画布逐帧算亮度 → 咖啡色阶，放大到 112% 屏幕并在画布内模糊，叠 0.1 颗粒；30 帧、3 倍速。 */
(() => {
  const cv = document.createElement('canvas');
  cv.id = 'flowbg';
  cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  const grain = document.createElement('div');
  grain.id = 'flowgrain';
  grain.setAttribute('aria-hidden', 'true');
  cv.after(grain);

  const pal = ['#140a08', '#2c1611', '#4c281d', '#76402b', '#a35d3e', '#c98156', '#dfa070']
    .map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const F = {
    tilt: 0.3, blur: 18, base: 0.18,
    bands: [
      { c: 0.1, w: 0.1, a: 0.6, amp: 0.06, sp: 0.12 },
      { c: 0.36, w: 0.11, a: 0.5, amp: 0.08, sp: 0.1 },
      { c: 0.62, w: 0.1, a: 0.5, amp: 0.08, sp: 0.14 },
      { c: 0.9, w: 0.1, a: 0.65, amp: 0.06, sp: 0.11 },
    ],
  };
  const SPEED = 3, FW = 64, FH = 120;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const src = document.createElement('canvas');
  src.width = FW;
  src.height = FH;
  const img = src.getContext('2d').createImageData(FW, FH);
  cv.width = FW * 2;
  cv.height = FH * 2;

  const shade = (L) => {
    L = Math.min(1, Math.max(0, L)) * 6;
    const i = Math.min(5, L | 0), f = L - i, a = pal[i], b = pal[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };

  let T = 0, last = 0, drawn = 0;
  function frame(now) {
    if (!still && now - drawn < 32) return requestAnimationFrame(frame);
    drawn = now;
    T += Math.min(0.1, (now - (last || now)) / 1000) * SPEED;
    last = now;
    const d = img.data;
    for (let y = 0; y < FH; y++) {
      const yy = y / FH;
      let L = F.base;
      for (const b of F.bands) {
        const cy = b.c + Math.sin(T * b.sp * 2 + b.c * 9) * b.amp;
        const w = b.w * (1 + 0.25 * Math.sin(T * b.sp * 1.3 + b.c * 5));
        const a = b.a * (0.82 + 0.18 * Math.sin(T * b.sp * 1.7 + b.c * 13));
        L += a * Math.exp(-((yy - cy) ** 2) / (2 * w * w));
      }
      for (let x = 0; x < FW; x++) {
        const xx = x / FW;
        const side = 1 - F.tilt + F.tilt * 2 * (0.35 + 0.65 * xx);
        const flow = 1 + 0.1 * Math.sin(xx * 5.5 - T * 0.5 + yy * 7) + 0.06 * Math.sin(xx * 11 + T * 0.33 - yy * 4);
        const [r, g, bb] = shade(L * side * flow), p = (y * FW + x) * 4;
        d[p] = r; d[p + 1] = g; d[p + 2] = bb; d[p + 3] = 255;
      }
    }
    src.getContext('2d').putImageData(img, 0, 0);
    const g = cv.getContext('2d');
    g.filter = `blur(${((F.blur * cv.width) / (innerWidth * 1.12)).toFixed(2)}px)`;
    g.imageSmoothingEnabled = true;
    g.drawImage(src, 0, 0, cv.width, cv.height);
    g.filter = 'none';
    if (!still) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

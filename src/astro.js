// 太陽・月・惑星の位置（およそ0.5°以内。小学校の観察には十分）
// 惑星: JPL「Keplerian Elements for Approximate Positions of the Major Planets」表1（1800〜2050年）
// 月: Meeus『天文アルゴリズム』の主な項だけ
const ASTRO = (() => {
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const EPS = 23.43928 * D2R;
  const norm = a => ((a % 360) + 360) % 360;
  const EL = {
    mercury: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
    venus:   [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255, 0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
    earth:   [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
    mars:    [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
    jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
    saturn:  [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]
  };
  function jd(date) { return date.getTime() / 86400000 + 2440587.5; }
  function helio(name, T) {
    const e0 = EL[name];
    const a = e0[0] + e0[6] * T, e = e0[1] + e0[7] * T, I = (e0[2] + e0[8] * T) * D2R;
    const L = e0[3] + e0[9] * T, w = e0[4] + e0[10] * T, O = e0[5] + e0[11] * T;
    const om = (w - O) * D2R, Om = O * D2R;
    let M = norm(L - w); if (M > 180) M -= 360; M *= D2R;
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const co = Math.cos(om), so = Math.sin(om), cO = Math.cos(Om), sO = Math.sin(Om), cI = Math.cos(I), sI = Math.sin(I);
    return [
      (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
      (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
      (so * sI) * xp + (co * sI) * yp
    ];
  }
  function eclToEq(x, y, z) {
    const ye = y * Math.cos(EPS) - z * Math.sin(EPS), ze = y * Math.sin(EPS) + z * Math.cos(EPS);
    const r = Math.hypot(x, ye, ze);
    return { ra: norm(Math.atan2(ye, x) * R2D), dec: Math.asin(ze / r) * R2D, dist: r };
  }
  function planet(name, date) {
    const T = (jd(date) - 2451545) / 36525;
    const p = helio(name, T), E = helio('earth', T);
    return eclToEq(p[0] - E[0], p[1] - E[1], p[2] - E[2]);
  }
  function sun(date) {
    const T = (jd(date) - 2451545) / 36525;
    const E = helio('earth', T);
    return eclToEq(-E[0], -E[1], -E[2]);
  }
  function moon(date) {
    const d = jd(date) - 2451545;
    const Lp = norm(218.316 + 13.176396 * d), Mp = norm(134.963 + 13.064993 * d) * D2R;
    const F = norm(93.272 + 13.229350 * d) * D2R, M = norm(357.529 + 0.98560028 * d) * D2R;
    const D = norm(297.850 + 12.190749 * d) * D2R;
    const lam = Lp + 6.289 * Math.sin(Mp) - 1.274 * Math.sin(Mp - 2 * D) + 0.658 * Math.sin(2 * D)
      + 0.214 * Math.sin(2 * Mp) - 0.186 * Math.sin(M) - 0.114 * Math.sin(2 * F)
      - 0.059 * Math.sin(2 * Mp - 2 * D) - 0.057 * Math.sin(Mp - 2 * D + M) + 0.053 * Math.sin(Mp + 2 * D);
    const bet = 5.128 * Math.sin(F) + 0.281 * Math.sin(Mp + F) + 0.278 * Math.sin(Mp - F) + 0.173 * Math.sin(2 * D - F);
    const l = lam * D2R, b = bet * D2R;
    const r = eclToEq(Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b));
    r.lon = norm(lam);
    return r;
  }
  // 月齢（新月からの日数）と、光っている割合
  function moonPhase(date) {
    const T = (jd(date) - 2451545) / 36525;
    const E = helio('earth', T);
    const sunLon = norm(Math.atan2(-E[1], -E[0]) * R2D);
    const elong = norm(moon(date).lon - sunLon); // 0=新月 180=満月
    return { elong, age: elong / 360 * 29.530589, frac: (1 - Math.cos(elong * D2R)) / 2, waxing: elong < 180 };
  }
  function lst(date, lon) { return norm(280.46061837 + 360.98564736629 * (jd(date) - 2451545) + lon); }
  function altAz(ra, dec, date, lat, lon) {
    const H = (lst(date, lon) - ra) * D2R, d = dec * D2R, p = lat * D2R;
    const alt = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H));
    const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.cos(H) * Math.sin(p));
    return { alt: alt * R2D, az: norm(az * R2D) };
  }
  return { planet, sun, moon, moonPhase, lst, altAz, jd, norm };
})();
if (typeof module !== 'undefined') module.exports = ASTRO;

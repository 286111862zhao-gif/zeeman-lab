/** Teaching model, not a calibration certificate for a physical instrument. SI throughout. */
export const c = 299792458;
export const referenceEM = 1.7588e11; // C kg^-1, comparison value specified in the exercise
export const muB = 9.2740100783e-24; // J T^-1
export const h = 6.62607015e-34;
export const wavelength = 546.1e-9;
export const upperG = 2;
export const lowerG = 1.5;

const finite = (n, name) => {
  if (!Number.isFinite(Number(n))) throw new TypeError(`${name} 必须为有限数`);
  return Number(n);
};
const positive = (n, name) => {
  n = finite(n, name);
  if (n <= 0) throw new RangeError(`${name} 必须大于零`);
  return n;
};

/** A reproducible, explicitly simulated 0→5→0 A hysteresis loop (Tesla).
 * Both branches meet at 5 A. Descending branch retains 12 mT at zero current.
 * No random readings: repeated measurement of one instrument state is consistent.
 */
export function field(current, branch = 'up') {
  const i = finite(current, '励磁电流');
  if (i < 0 || i > 10) throw new RangeError('励磁电流需在 0–10 A 模拟范围内');
  const base = .17 * i - .002 * i * i;
  const down = ['down', 'descending', '下降'].includes(branch);
  const hysteresis = down && i <= 5 ? .033 * Math.sin(Math.PI * i / 5) + .012 * (1 - i / 5) : 0;
  return base + hysteresis;
}

/** FSR in wavenumber m^-1; multiply by c for Hz. */
export function freeSpectralRange(d) { return 1 / (2 * positive(d, '空气间隔 d（m）')); }

/** Diameter-squared separation / same-family adjacent-order D² step. */
export function splitRatio(B, dMeters, delta = .5) {
  B = finite(B, 'B（T）');
  if (B < 0) throw new RangeError('B 必须为非负磁感应强度');
  return referenceEM * positive(delta, 'Δ(Mg)') * B * positive(dMeters, 'd（m）') / (2 * Math.PI * c);
}

export function landeG(L, S, J) {
  if (J === 0) return 0;
  return 1 + (J * (J + 1) + S * (S + 1) - L * (L + 1)) / (2 * J * (J + 1));
}

/** Weak-field LS model, with explicit optional nonphysical legacy comparison g_P=1.
 * transition.shift is Δ(gM) of that one transition; delta between two shifts is
 * the Δ(Mg) to enter into the e/m formula. sigma signs use ΔM = Mu − Ml.
 */
export function energyLevels(B, options = {}) {
  B = finite(B, 'B（T）');
  const gu = 2, gl = options.legacyGP1 ? 1 : 1.5;
  const upper = [-1, 0, 1].map(M => ({ M, J: 1, g: gu, shift: M * gu, energy: M * gu * muB * B }));
  const lower = [-2, -1, 0, 1, 2].map(M => ({ M, J: 2, g: gl, shift: M * gl, energy: M * gl * muB * B }));
  const transitions = [];
  for (const u of upper) for (const l of lower) {
    const deltaM = u.M - l.M;
    if (Math.abs(deltaM) > 1) continue;
    const shift = gu * u.M - gl * l.M;
    transitions.push({
      Mu: u.M, Ml: l.M, deltaM, shift,
      label: deltaM === 0 ? 'π' : deltaM > 0 ? 'σ⁺' : 'σ⁻',
      family: deltaM === 0 ? 'pi' : deltaM > 0 ? 'sigmaPlus' : 'sigmaMinus',
      energy: shift * muB * B,
      frequency: shift * muB * B / h,
      wavenumber: shift * muB * B / (h * c),
    });
  }
  return { upper, lower, transitions, gu, gl, B, approximate: !!options.legacyGP1 };
}

const xy = p => {
  const x = Array.isArray(p) ? p[0] : p.x;
  const y = Array.isArray(p) ? p[1] : p.y;
  return { x: finite(x, 'x'), y: finite(y, 'y') };
};

/** Circumcircle from exactly three distinct points; works in any consistent unit. */
export function circleFromThree(points) {
  if (!Array.isArray(points) || points.length !== 3) throw new RangeError('三点画圆恰需三个点');
  const [p, q, r] = points.map(xy);
  const ax = q.x - p.x, ay = q.y - p.y, bx = r.x - p.x, by = r.y - p.y;
  const scale = Math.max(Math.hypot(ax, ay), Math.hypot(bx, by));
  const determinant = 2 * (ax * by - ay * bx);
  if (!scale || Math.abs(determinant) <= 1e-10 * scale * scale) throw new RangeError('三点共线或过于接近，请约隔 120° 重新取点');
  const aa = ax * ax + ay * ay, bb = bx * bx + by * by;
  const ux = (aa * by - bb * ay) / determinant;
  const uy = (ax * bb - bx * aa) / determinant;
  const x = p.x + ux, y = p.y + uy, radius = Math.hypot(ux, uy);
  const residual = Math.max(...[p, q, r].map(t => Math.abs(Math.hypot(t.x - x, t.y - y) - radius)));
  return { x, y, radius, diameter: 2 * radius, residual };
}

/** Geometry checks cannot establish whether the operator chose a brightness peak.
 * That separate check uses the rendered image's radial intensity profile.
 */
export function circleQuality(points) {
  let circle;
  try { circle = circleFromThree(points); }
  catch (e) { return { ok: false, warnings: [e.message], angles: [], gaps: [], minGap: 0, arcSpan: 0 }; }
  const angles = points.map(xy).map(p => (Math.atan2(p.y - circle.y, p.x - circle.x) * 180 / Math.PI + 360) % 360).sort((a, b) => a - b);
  const gaps = angles.map((a, i) => (angles[(i + 1) % 3] - a + 360) % 360);
  const minGap = Math.min(...gaps), arcSpan = 360 - Math.max(...gaps);
  const warnings = [];
  if (arcSpan < 200 || minGap < 70 || Math.max(...gaps) > 170) warnings.push('三点挤在窄弧或分布不均；请沿同一亮环的亮度峰中心约隔 120° 取点');
  return { ok: !warnings.length, warnings, angles, gaps, minGap, arcSpan, circle };
}

export function calculateEM({ B, d, delta, numerator, denominator }) {
  B = positive(B, 'B（T）'); d = positive(d, 'd（m）');
  delta = positive(delta, 'Δ(Mg)');
  numerator = finite(numerator, 'D_b²−D_a²');
  if (numerator <= 0) throw new RangeError('D_b²−D_a² 必须为正；复核 a 内 b 外');
  denominator = positive(denominator, 'ΔD² = D_K−1²−D_K²');
  if (B > 3 || d > .02) throw new RangeError('量级自检：B 须由高斯换为 T，d 须化为 m');
  return 2 * Math.PI * c * numerator / (delta * B * d * denominator);
}

export function relativeError(value, reference = referenceEM) { return Math.abs(value - reference) / Math.abs(reference) * 100; }

/** First-order independent-input propagation for the ratio result (fractional 1σ). */
export function relativeUncertainty({ B, uB, d, ud, numerator, uNumerator, denominator, uDenominator }) {
  return Math.hypot(uB / positive(B, 'B'), ud / positive(d, 'd'), uNumerator / positive(numerator, '分裂 D² 差'), uDenominator / positive(denominator, '自由光谱区 D² 差'));
}

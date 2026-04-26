#version 300 es
precision highp float;
out vec4 o;

uniform vec2  uRes;
uniform float uTime;

uniform float uBass, uMid, uHi;
uniform float uBassRaw, uMidRaw, uHiRaw;
uniform float uOnBass, uOnMid, uOnHi;
uniform float uBounce;
uniform float uCentroid;
uniform float uSlow, uBeat, uSegments;

uniform vec3  uPalA[4];
uniform vec3  uPalB[4];
uniform float uPalMix;

uniform vec4  uColMap;
uniform float uColBase;

uniform float uRegSegOff;
uniform float uRegTwist;
uniform float uRegWarp;
uniform float uRegRings;
uniform float uRegSparkle;
uniform float uRegRays;
uniform float uRegHue;

uniform float uSwitchFlash;
uniform float uBrightness;
uniform float uEnergy;
uniform float uWhiteout;
uniform float uBeatPresence;

uniform sampler2D uSpectrum;

#define TAU 6.28318530718
#define PI  3.14159265359

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1, 0)), u.x),
    mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x),
    u.y
  );
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    s += a * vnoise(p);
    p = r * p * 2.02;
    a *= 0.5;
  }
  return s;
}

vec3 palOne(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}
vec3 pal(float t) {
  vec3 ca = palOne(t, uPalA[0], uPalA[1], uPalA[2], uPalA[3]);
  vec3 cb = palOne(t, uPalB[0], uPalB[1], uPalB[2], uPalB[3]);
  return mix(ca, cb, uPalMix);
}

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

vec2 kaleido(vec2 p, float n) {
  float r = length(p);
  float a = atan(p.y, p.x);
  float seg = TAU / n;
  a = mod(a, seg);
  a = abs(a - seg * 0.5);
  return vec2(cos(a), sin(a)) * r;
}

void main() {
  vec2 frag = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);

  float pulse = 0.88 + 0.30 * uEnergy + 0.10 * uBounce + 0.18 * uSwitchFlash;
  vec2 p = frag / pulse;

  float twist = (uSlow * 0.035
    + 0.22 * sin(uSlow * 0.27) * (1.0 - exp(-2.2 * length(p)))) * uRegTwist;
  p = rot(twist) * p;

  float seg = max(3.0, uSegments + uRegSegOff + floor(uMid * 5.0 + uOnMid * 2.0));
  p = kaleido(p, seg);

  float t = uTime * 0.035 + uSlow * 0.10;
  vec2 drift = 0.55 * vec2(sin(uSlow * 0.27), cos(uSlow * 0.19));
  drift += 0.45 * vec2(uHi - uBass, uMid - 0.5 * (uBass + uHi));

  vec2 q = vec2(
    fbm(p * 1.6 + drift + vec2(0.0, t)),
    fbm(p * 1.6 + drift + vec2(5.2, -t))
  );
  vec2 r = vec2(
    fbm(p * 2.7 + 4.0 * q + vec2(1.7 + t * 0.7, 9.2)),
    fbm(p * 2.7 + 4.0 * q + vec2(8.3, 2.8 - t * 0.7))
  );
  float warpAmt = (0.7 + 1.0 * uMid + 0.55 * uBass + 0.35 * uOnMid) * uRegWarp;
  float n = fbm(p * 2.2 + warpAmt * r + 0.16 * uHi * sin(p.yx * 14.0 + uTime * 0.7));

  float rad = length(p);
  float ringMod = mix(0.4, 1.0, uBeatPresence);
  float rings = sin(rad * (5.5 + 6.0 * uBass + 3.0 * uOnMid) - uTime * 0.28)
                * uRegRings * ringMod;
  n = mix(n, n + 0.20 * rings, 0.4);

  float ci = n
    + 0.18 * length(q)
    + uColBase
    + 0.30 * uCentroid * uColMap.x
    + 0.15 * uBass * uColMap.y
    + 0.15 * uMid  * uColMap.z
    + 0.15 * uHi   * uColMap.w
    + 0.005 * uTime
    + uBeat * 0.05
    + uRegHue * 0.4;
  vec3 col = pal(ci);

  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 1.0 + 0.45 * uEnergy + 0.25 * uSwitchFlash);

  col = mix(col, col * col * 1.8, clamp(uBass * 0.45, 0.0, 0.40));

  float ridgeMask = smoothstep(0.58, 0.86, n);
  col += ridgeMask * uHiRaw * pal(ci + 0.42) * 0.55;
  float troughMask = smoothstep(0.42, 0.12, n);
  col += troughMask * uBassRaw * pal(ci - 0.18) * 0.40;
  float edgeMask = 1.0 - smoothstep(0.0, 0.18, abs(n - 0.5));
  col += edgeMask * uMidRaw * pal(ci + 0.7) * 0.25;

  float ang = atan(p.y, p.x);
  float su = (ang + PI) / TAU;
  float rayA = texture(uSpectrum, vec2(su, 0.5)).r;
  float rayB = texture(uSpectrum, vec2(su + 0.003, 0.5)).r;
  float ray = max(rayA, rayB);
  float rays = ray * exp(-1.3 * rad) * (0.35 + 0.70 * uEnergy) * uRegRays;
  col += rays * pal(ci + 0.55) * 0.42;

  vec2 gp = p * 13.0 + vec2(uSlow * 0.4, -uSlow * 0.3);
  vec2 cell = floor(gp);
  float seedA = hash(cell);
  float seedB = hash(cell + 17.31);
  float gate = step(0.94, seedA);
  float twinklePhase = seedB * TAU + uTime * (1.2 + 3.0 * seedA);
  float twinkle = pow(max(0.0, sin(twinklePhase)), 10.0);
  float glintBase = mix(0.05, 0.30, uBeatPresence);
  float glint = gate * twinkle * (glintBase + 1.2 * uOnHi) * uRegSparkle;
  col += glint * pal(ci + 0.85) * 0.45;

  col *= uBrightness;

  col += pal(ci + 0.10) * (0.08 * uBass + 0.14 * uOnBass);

  float glow = exp(-2.5 * rad) * (0.08 + 0.70 * uEnergy);
  col += glow * pal(ci + 0.3) * 0.18;

  float vigOuter = 0.55 + 0.85 * uEnergy;
  float vigInner = 0.05 + 0.10 * uEnergy;
  col *= smoothstep(vigOuter, vigInner, rad);

  col = max(col, vec3(0.0));
  col = vec3(1.0) - exp(-col * 0.95);

  col = mix(col, vec3(1.0), clamp(uWhiteout + uSwitchFlash * 0.05, 0.0, 0.55));

  float grain = (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.04;
  col += grain;

  o = vec4(col, 1.0);
}

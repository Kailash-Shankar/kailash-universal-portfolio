"use client";
import { useState, useEffect, useRef } from "react";

function cmr(p0, p1, p2, p3, t) {
  const t2 = t*t, t3 = t2*t;
  return {
    x: 0.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y: 0.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
  };
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

const GF = 0.73;

const WPTS = [
  [-0.12, GF], [-0.02, GF], [0.03, GF], [0.07, GF],
  [0.10, GF],
  [0.130, 0.660],[0.155, 0.490],[0.175, 0.350],
  [0.195, 0.240],[0.215, 0.175],[0.235, 0.148],[0.255, 0.138],
  [0.275, 0.148],[0.295, 0.175],[0.315, 0.240],
  [0.345, 0.390],[0.378, 0.580],[0.410, GF],[0.455, GF],
  [0.474, 0.640],[0.492, 0.480],[0.514, 0.330],[0.538, 0.220],
  [0.562, 0.162],[0.588, 0.142],[0.614, 0.162],[0.638, 0.220],
  [0.660, 0.330],[0.682, 0.480],[0.698, 0.640],[0.712, GF],
  [0.758, 0.580],[0.800, GF],
  [0.850, GF],[0.930, GF],[1.020, GF],[1.120, GF],[1.180, GF],
];
const SPG = 72;
const NUM_CARS = 5;
const ARC_SEP = 54;
const RAIL_OFF = 5;
const NUM_SPARKLES = 45;

// Draw a classic 4-point star (sharp elongated arms like a real twinkling star)
function drawStar4(ctx, cx, cy, outerR, innerR, rotation) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = rotation + (i * Math.PI) / 4;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export default function UCPortfolio() {
  const [scrolled, setScrolled] = useState(false);
  const canvasRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const o = new IntersectionObserver(
      es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("vis"); o.unobserve(e.target); } }),
      { threshold: 0.07, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".r").forEach(el => o.observe(el));
    return () => o.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId, lastTS = null;
    let smoothSpeed = 3.5, trainIdx = 0;
    let W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W; canvas.height = H;

    let pts = [], minY = 0, maxY = 1;
    let liftStart = 0, liftEnd = 0;
    let cumLen = [];
    let totalLen = 0;

    function idxAtLen(s) {
      s = ((s % totalLen) + totalLen) % totalLen;
      let lo = 0, hi = cumLen.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cumLen[mid] < s) lo = mid + 1; else hi = mid;
      }
      return lo;
    }

    let stars = [];
    function makeStars() {
      stars = Array.from({ length: 150 }, () => ({
        x: Math.random(), y: Math.random() * 0.65,
        r: Math.random() * 1.1 + 0.25,
        base: Math.random() * 0.65 + 0.15,
        phase: Math.random() * Math.PI * 2,
      }));
    }
    makeStars();

    // ── STAR SPARKLES: sharp 4-point twinkling stars with cross gleam
    let sparkles = [];
    function makeSparkles() {
      sparkles = Array.from({ length: NUM_SPARKLES }, () => ({
        x: Math.random(),
        y: Math.random() * 0.82,
        outerR: Math.random() * 5.5 + 2.5,
        innerFrac: Math.random() * 0.08 + 0.05, // very tight inner = very spiky arms
        phase: Math.random() * Math.PI * 2,
        twinkleRate: Math.random() * 1.4 + 0.6,
        drift: (Math.random() - 0.5) * 0.000055,
        rise: Math.random() * 0.000035 + 0.000012,
        rotation: Math.random() * Math.PI / 4,
        rotSpeed: (Math.random() - 0.5) * 0.008,
        warm: Math.random() > 0.3, // ~70% warm gold/white, ~30% cool blue-white
      }));
    }
    makeSparkles();

    function drawSparkles(ts) {
      const t = ts * 0.001;
      sparkles.forEach(sp => {
        sp.x  += sp.drift  * 16.667;
        sp.y  -= sp.rise   * 16.667;
        sp.rotation += sp.rotSpeed;
        if (sp.y < -0.03) { sp.y = 0.85; sp.x = Math.random(); }
        if (sp.x < -0.02)  sp.x = 1.02;
        if (sp.x >  1.02)  sp.x = -0.02;

        // Sharpen the twinkle: power curve makes most time dim, quick bright flash
        const raw = Math.sin(t * sp.twinkleRate + sp.phase);
        const tw = Math.pow(Math.max(0, raw), 2.2);
        const alpha = tw * 0.92 + 0.04;

        const cx = sp.x * W;
        const cy = sp.y * H;
        const outerR = sp.outerR * (0.65 + 0.35 * tw);
        const innerR = outerR * sp.innerFrac;

        ctx.save();
        ctx.globalAlpha = alpha;

        // 1. Soft outer glow halo
        const glowR = outerR * 4.5;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
        if (sp.warm) {
          glow.addColorStop(0,    `rgba(255, 230, 120, ${0.55 * tw})`);
          glow.addColorStop(0.25, `rgba(255, 200, 60,  ${0.28 * tw})`);
          glow.addColorStop(0.6,  `rgba(200, 140, 20,  ${0.10 * tw})`);
          glow.addColorStop(1,    "rgba(0,0,0,0)");
        } else {
          glow.addColorStop(0,    `rgba(220, 240, 255, ${0.55 * tw})`);
          glow.addColorStop(0.25, `rgba(180, 220, 255, ${0.28 * tw})`);
          glow.addColorStop(0.6,  `rgba(100, 160, 255, ${0.10 * tw})`);
          glow.addColorStop(1,    "rgba(0,0,0,0)");
        }
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, Math.PI * 2); ctx.fill();

        // 2. Cross gleam lines (horizontal + vertical lens-flare effect)
        const gleamLen = outerR * 6.5;
        ctx.globalAlpha = alpha * 0.6 * tw;
        const midCol = sp.warm ? "rgba(255,245,160,0.9)" : "rgba(200,230,255,0.9)";

        const makeGleam = (x1, y1, x2, y2) => {
          const g = ctx.createLinearGradient(x1, y1, x2, y2);
          g.addColorStop(0,    "rgba(0,0,0,0)");
          g.addColorStop(0.38, "rgba(255,255,255,0.08)");
          g.addColorStop(0.48, midCol);
          g.addColorStop(0.5,  "rgba(255,255,255,1.0)");
          g.addColorStop(0.52, midCol);
          g.addColorStop(0.62, "rgba(255,255,255,0.08)");
          g.addColorStop(1,    "rgba(0,0,0,0)");
          return g;
        };

        ctx.lineWidth = 0.9;
        ctx.strokeStyle = makeGleam(cx - gleamLen, cy, cx + gleamLen, cy);
        ctx.beginPath(); ctx.moveTo(cx - gleamLen, cy); ctx.lineTo(cx + gleamLen, cy); ctx.stroke();
        ctx.strokeStyle = makeGleam(cx, cy - gleamLen, cx, cy + gleamLen);
        ctx.beginPath(); ctx.moveTo(cx, cy - gleamLen); ctx.lineTo(cx, cy + gleamLen); ctx.stroke();

        // 3. Diagonal secondary gleam (45°, subtler)
        const d = gleamLen * 0.4 * 0.707;
        ctx.globalAlpha = alpha * 0.25 * tw;
        ctx.lineWidth = 0.6;
        const diagCol = sp.warm ? "rgba(255,220,100,0.5)" : "rgba(180,210,255,0.5)";
        ctx.strokeStyle = diagCol;
        ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke();

        // 4. Core 4-point star shape
        ctx.globalAlpha = alpha;
        ctx.shadowColor = sp.warm ? "rgba(255, 230, 100, 0.95)" : "rgba(180, 220, 255, 0.95)";
        ctx.shadowBlur  = outerR * 3.5 * tw;

        const starG = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR);
        if (sp.warm) {
          starG.addColorStop(0,   "rgba(255, 255, 245, 1.0)");
          starG.addColorStop(0.3, "rgba(255, 248, 185, 0.95)");
          starG.addColorStop(0.7, "rgba(255, 210, 60,  0.80)");
          starG.addColorStop(1,   "rgba(200, 150, 0,   0.0)");
        } else {
          starG.addColorStop(0,   "rgba(255, 255, 255, 1.0)");
          starG.addColorStop(0.3, "rgba(215, 238, 255, 0.95)");
          starG.addColorStop(0.7, "rgba(140, 190, 255, 0.80)");
          starG.addColorStop(1,   "rgba(80,  130, 255, 0.0)");
        }
        ctx.fillStyle = starG;
        drawStar4(ctx, cx, cy, outerR, innerR, sp.rotation);
        ctx.fill();

        ctx.restore();
      });
    }

    let ptero = { x: W * 0.72, y: H * 0.20, phase: 0 };

    function buildTrack() {
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      canvas.width = W; canvas.height = H;
      const raw = WPTS.map(([xf, yf]) => ({ x: xf * W, y: yf * H }));
      pts = [];
      const N = raw.length;
      for (let i = 0; i < N - 1; i++) {
        const p0 = raw[Math.max(0, i-1)];
        const p1 = raw[i];
        const p2 = raw[i+1];
        const p3 = raw[Math.min(N-1, i+2)];
        for (let s = 0; s < SPG; s++) pts.push(cmr(p0, p1, p2, p3, s/SPG));
      }
      pts.push({ ...raw[N-1] });
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i-3)];
        const b = pts[Math.min(pts.length-1, i+3)];
        const dx = b.x-a.x, dy = b.y-a.y;
        const len = Math.hypot(dx, dy) || 1;
        pts[i].tx = dx/len; pts[i].ty = dy/len;
        pts[i].nx = -dy/len; pts[i].ny = dx/len;
      }
      minY = Math.min(...pts.map(p=>p.y));
      maxY = Math.max(...pts.map(p=>p.y));
      cumLen = new Array(pts.length).fill(0);
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y;
        cumLen[i] = cumLen[i-1] + Math.hypot(dx, dy);
      }
      totalLen = cumLen[pts.length - 1] || 1;
      liftStart = pts.findIndex(p => p.x >= WPTS[4][0]*W);
      liftEnd   = pts.findIndex(p => p.x >= WPTS[10][0]*W);
      if (liftStart < 0) liftStart = 0;
      if (liftEnd   < 0) liftEnd   = pts.length;
    }

    function drawSky(ts) {
      const skyG = ctx.createLinearGradient(0, 0, 0, H);
      skyG.addColorStop(0,       "#030612");
      skyG.addColorStop(0.20,    "#06103c");
      skyG.addColorStop(0.48,    "#0a2264");
      skyG.addColorStop(GF*0.92, "#0d3898");
      skyG.addColorStop(GF,      "#0e3ea0");
      skyG.addColorStop(GF+0.10, "#071855");
      skyG.addColorStop(1,       "#030612");
      ctx.fillStyle = skyG;
      ctx.fillRect(0, 0, W, H);
      const hg = ctx.createRadialGradient(W*0.5, GF*H, 0, W*0.5, GF*H, W*0.72);
      hg.addColorStop(0,   "rgba(20,90,220,0.38)");
      hg.addColorStop(0.4, "rgba(6,200,217,0.07)");
      hg.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
      const t = ts * 0.001;
      stars.forEach(s => {
        const tw = s.base + Math.sin(t * 1.3 + s.phase) * (1 - s.base) * 0.65;
        ctx.beginPath();
        ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(215,235,255,${tw})`;
        ctx.fill();
      });
    }

    function drawSilhouette() {
      const gY = GF * H;
      const S = "rgba(3, 8, 52, 0.97)";
      ctx.fillStyle = S; ctx.fillRect(0, gY, W, H - gY + 2);
      ctx.fillStyle = S;
      [[0.03,0.095],[0.08,0.130],[0.13,0.120],[0.17,0.095]].forEach(([fx,fh]) => {
        const sx=fx*W, sh=H*fh, sw=W*0.032;
        ctx.beginPath(); ctx.moveTo(sx-sw*0.6, gY); ctx.lineTo(sx, gY-sh); ctx.lineTo(sx+sw*0.6, gY);
        ctx.closePath(); ctx.fill();
      });
      ctx.fillRect(0, gY-H*0.065, W*0.20, H*0.010);
      ctx.strokeStyle = S; ctx.lineWidth = H*0.007;
      [[0, 0.18, W*0.10, gY],[W*0.10, gY, 0.18*W, 0.18*H]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      });
      ctx.fillStyle = S;
      ctx.beginPath();
      ctx.moveTo(W*0.16, gY);
      ctx.lineTo(W*0.185, gY-H*0.038); ctx.lineTo(W*0.190, gY-H*0.024);
      ctx.lineTo(W*0.205, gY-H*0.072); ctx.lineTo(W*0.210, gY-H*0.055);
      ctx.lineTo(W*0.225, gY-H*0.108); ctx.lineTo(W*0.232, gY-H*0.088);
      ctx.lineTo(W*0.248, gY-H*0.148); ctx.lineTo(W*0.254, gY-H*0.128);
      ctx.lineTo(W*0.268, gY-H*0.184);
      ctx.bezierCurveTo(W*0.278, gY-H*0.220, W*0.290, gY-H*0.225, W*0.300, gY-H*0.216);
      ctx.lineTo(W*0.312, gY-H*0.195); ctx.lineTo(W*0.320, gY-H*0.208);
      ctx.lineTo(W*0.334, gY-H*0.168); ctx.lineTo(W*0.342, gY-H*0.145);
      ctx.lineTo(W*0.355, gY-H*0.108); ctx.lineTo(W*0.362, gY-H*0.072);
      ctx.lineTo(W*0.372, gY-H*0.040); ctx.lineTo(W*0.378, gY);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(W*0.145, gY); ctx.lineTo(W*0.162, gY-H*0.105); ctx.lineTo(W*0.178, gY-H*0.080);
      ctx.lineTo(W*0.192, gY-H*0.125); ctx.lineTo(W*0.208, gY); ctx.closePath(); ctx.fill();
      ctx.fillStyle = S;
      [[0.370,0.082,0.9],[0.385,0.100,1.0],[0.400,0.086,0.95],[0.415,0.075,0.85]].forEach(([fx,fh,sc]) => {
        const px=fx*W, ph=H*fh*sc;
        ctx.beginPath(); ctx.moveTo(px-W*0.005,gY);
        ctx.bezierCurveTo(px-W*0.007,gY-ph*0.45,px+W*0.010,gY-ph*0.72,px+W*0.003,gY-ph);
        ctx.lineTo(px+W*0.010,gY-ph);
        ctx.bezierCurveTo(px+W*0.014,gY-ph*0.72,px-W*0.002,gY-ph*0.45,px+W*0.001,gY);
        ctx.closePath(); ctx.fill();
        [[-1.25,-0.72],[-0.42,-1.0],[0.42,-1.0],[1.22,-0.68],[1.52,-0.18]].forEach(([dx,dy]) => {
          const fr=W*0.034*sc;
          ctx.beginPath(); ctx.moveTo(px+W*0.003,gY-ph);
          ctx.bezierCurveTo(px+W*0.003+dx*fr*0.42,gY-ph+dy*fr*0.42,px+W*0.003+dx*fr*0.84,gY-ph+dy*fr*0.86,px+W*0.003+dx*fr,gY-ph+dy*fr);
          ctx.lineWidth=W*0.007*sc; ctx.strokeStyle=S; ctx.stroke();
          ctx.beginPath(); ctx.ellipse(px+W*0.003+dx*fr*0.74,gY-ph+dy*fr*0.74,fr*0.19,fr*0.085,Math.atan2(dy,dx),0,Math.PI*2);
          ctx.fillStyle=S; ctx.fill();
        });
      });
      ctx.fillStyle = S;
      const gx=W*0.495, globeR=Math.min(W*0.055,H*0.100), globeBase=gY-globeR*0.08;
      [[0.046,0.008],[0.032,0.016],[0.020,0.024]].forEach(([pw,ph]) => { ctx.fillRect(gx-W*pw,gY-H*ph*3,W*pw*2,H*ph); });
      ctx.beginPath(); ctx.moveTo(gx-W*0.012,gY-H*0.050); ctx.lineTo(gx-W*0.010,globeBase-globeR);
      ctx.lineTo(gx+W*0.010,globeBase-globeR); ctx.lineTo(gx+W*0.012,gY-H*0.050); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(gx,globeBase,globeR,0,Math.PI*2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(gx,globeBase,globeR,0,Math.PI*2); ctx.clip();
      ctx.strokeStyle="rgba(6,200,217,0.10)"; ctx.lineWidth=0.8;
      [-0.6,-0.2,0,0.2,0.6].forEach(lat => {
        const ly=globeBase+lat*globeR, lw=Math.sqrt(Math.max(0,globeR*globeR-(lat*globeR)**2));
        ctx.beginPath(); ctx.ellipse(gx,ly,lw,lw*0.28,0,0,Math.PI*2); ctx.stroke();
      });
      [-0.55,0,0.55].forEach(lon => {
        ctx.beginPath(); ctx.ellipse(gx+lon*globeR*0.48,globeBase,globeR*Math.sqrt(1-lon*lon*0.23),globeR,0,0,Math.PI*2); ctx.stroke();
      });
      ctx.restore();
      ctx.fillStyle = S;
      const ax=W*0.607, aHt=H*0.228, aIW=W*0.065, aThk=W*0.020;
      ctx.fillRect(ax-aIW-aThk, gY-aHt, aThk, aHt); ctx.fillRect(ax+aIW, gY-aHt, aThk, aHt);
      ctx.beginPath(); ctx.arc(ax, gY-aHt, aIW+aThk, Math.PI, 0); ctx.arc(ax, gY-aHt, aIW, 0, Math.PI, true); ctx.closePath(); ctx.fill();
      ctx.fillRect(ax-aThk*0.6,gY-aHt-aThk*1.8,aThk*1.2,aThk*1.8);
      ctx.beginPath(); ctx.moveTo(ax-aThk,gY-aHt-aThk*1.8); ctx.lineTo(ax,gY-aHt-aThk*4.0); ctx.lineTo(ax+aThk,gY-aHt-aThk*1.8); ctx.closePath(); ctx.fill();
      ctx.fillRect(ax-aIW-aThk-W*0.025,gY-aHt*0.40,W*0.025,aHt*0.40); ctx.fillRect(ax+aIW+aThk,gY-aHt*0.40,W*0.025,aHt*0.40);
      ctx.fillStyle = S;
      [[0.658,0.090],[0.670,0.112],[0.683,0.094],[0.696,0.082]].forEach(([fx,fh]) => {
        const px=fx*W,ph=H*fh;
        ctx.beginPath(); ctx.moveTo(px,gY-ph);
        ctx.lineTo(px+W*0.009,gY-ph*0.50); ctx.lineTo(px+W*0.018,gY-ph*0.50);
        ctx.lineTo(px+W*0.011,gY-ph*0.27); ctx.lineTo(px+W*0.022,gY-ph*0.27);
        ctx.lineTo(px+W*0.005,gY); ctx.lineTo(px-W*0.005,gY);
        ctx.lineTo(px-W*0.022,gY-ph*0.27); ctx.lineTo(px-W*0.011,gY-ph*0.27);
        ctx.lineTo(px-W*0.018,gY-ph*0.50); ctx.lineTo(px-W*0.009,gY-ph*0.50);
        ctx.closePath(); ctx.fill();
      });
      ctx.fillStyle = S; ctx.fillRect(W*0.71,gY-H*0.100,W*0.15,H*0.100);
      for (let b=0;b<13;b++) { if(b%2===0) ctx.fillRect(W*0.71+b*W*0.0115,gY-H*0.100-H*0.010,W*0.007,H*0.010); }
      [[0.716,0.158,0.019],[0.735,0.202,0.022],[0.754,0.168,0.018],
       [0.774,0.238,0.025],[0.793,0.188,0.021],[0.815,0.210,0.022],[0.835,0.155,0.018]].forEach(([fx,fh,fw]) => {
        const tx=fx*W,th=H*fh,tw=W*fw;
        ctx.fillRect(tx-tw/2,gY-th,tw,th);
        ctx.beginPath(); ctx.moveTo(tx-tw/2-W*0.003,gY-th); ctx.lineTo(tx,gY-th-H*0.040); ctx.lineTo(tx+tw/2+W*0.003,gY-th); ctx.closePath(); ctx.fill();
        for(let b=0;b<3;b++) ctx.fillRect(tx-tw/2+b*(tw/3),gY-th-H*0.002,tw/4,H*0.009);
        ctx.fillStyle="rgba(3,6,16,0.45)";
        [0.30,0.55,0.75].forEach(fy=>ctx.fillRect(tx-W*0.003,gY-th*fy,W*0.006,H*0.013));
        ctx.fillStyle=S;
      });
      ctx.fillStyle = S; ctx.beginPath(); ctx.moveTo(W*0.84,gY);
      ctx.lineTo(W*0.852,gY-H*0.058); ctx.lineTo(W*0.858,gY-H*0.045);
      ctx.lineTo(W*0.870,gY-H*0.088); ctx.lineTo(W*0.878,gY-H*0.072);
      ctx.lineTo(W*0.892,gY-H*0.128); ctx.lineTo(W*0.900,gY-H*0.108);
      ctx.lineTo(W*0.914,gY-H*0.162);
      ctx.bezierCurveTo(W*0.924,gY-H*0.182,W*0.934,gY-H*0.188,W*0.944,gY-H*0.178);
      ctx.lineTo(W*0.956,gY-H*0.155); ctx.lineTo(W*0.966,gY-H*0.168);
      ctx.lineTo(W*0.978,gY-H*0.138); ctx.lineTo(W*0.990,gY-H*0.152);
      ctx.lineTo(W*1.000,gY-H*0.118); ctx.lineTo(W*1.000,gY); ctx.closePath(); ctx.fill();
      const fade=ctx.createLinearGradient(0,gY-H*0.10,0,H);
      fade.addColorStop(0,"rgba(3,8,52,0)"); fade.addColorStop(0.55,"rgba(3,6,16,0.25)"); fade.addColorStop(1,"rgba(3,6,16,0.65)");
      ctx.fillStyle=fade; ctx.fillRect(0,gY-H*0.10,W,H-(gY-H*0.10));
    }

    function drawPtero() {
      ptero.phase += 0.028; ptero.x -= 0.55;
      if (ptero.x < -160) { ptero.x = W+140; ptero.y = H*(0.14+Math.random()*0.20); }
      const wf = Math.sin(ptero.phase) * 0.42;
      ctx.save(); ctx.translate(ptero.x, ptero.y); ctx.scale(0.80, 0.80);
      ctx.fillStyle = "rgba(3,8,52,0.70)";
      ctx.beginPath(); ctx.ellipse(0,0,18,6,-0.15,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(20,-4,10,5,-0.12,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(28,-4); ctx.lineTo(42,-5); ctx.lineTo(28,-2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(15,-8); ctx.lineTo(26,-19); ctx.lineTo(12,-8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-15,0); ctx.bezierCurveTo(-24,5,-35,3,-37,-5); ctx.bezierCurveTo(-33,-12,-23,-7,-15,0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(3,-4); ctx.bezierCurveTo(-3,-12+wf*19,-19,-24+wf*25,-35,-18+wf*16); ctx.bezierCurveTo(-25,-6+wf*7,-12,-1,3,-4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(3,4); ctx.bezierCurveTo(-3,12-wf*13,-19,20-wf*17,-35,14-wf*12); ctx.bezierCurveTo(-25,5-wf*5,-12,1,3,4); ctx.fill();
      ctx.restore();
    }

    function drawTrack() {
      if (!pts.length) return;
      const gY = GF * H; ctx.save();
      ctx.lineWidth = 1.5;
      for (let i = 0; i < pts.length; i += 20) {
        const p = pts[i]; if (p.y >= gY - 6) continue;
        const normH = (p.y - minY) / (maxY - minY);
        const al = 0.04 + normH * 0.08;
        ctx.strokeStyle = `rgba(6,200,217,${al})`;
        ctx.beginPath(); ctx.moveTo(p.x, p.y+6); ctx.lineTo(p.x, gY); ctx.stroke();
        const d = gY - p.y;
        if (d > H*0.10) {
          ctx.strokeStyle = `rgba(6,200,217,${al*0.50})`;
          [0.38, 0.68].forEach(f => { ctx.beginPath(); ctx.moveTo(p.x-10, p.y+d*f); ctx.lineTo(p.x+10, p.y+d*f); ctx.stroke(); });
        }
      }
      for (let i = liftStart; i < liftEnd && i < pts.length; i += 6) {
        const p = pts[i], frac = (i - liftStart) / Math.max(1, liftEnd - liftStart);
        ctx.strokeStyle = `rgba(6,200,217,${0.16 + frac*0.18})`; ctx.lineWidth = 1.0;
        ctx.beginPath(); ctx.moveTo(p.x+p.nx*3, p.y+p.ny*3); ctx.lineTo(p.x-p.nx*3, p.y-p.ny*3); ctx.stroke();
      }
      ctx.lineWidth = 2.0;
      for (let i = 0; i < pts.length; i += 8) {
        const p = pts[i]; ctx.strokeStyle = "rgba(6,200,217,0.19)";
        ctx.beginPath(); ctx.moveTo(p.x+p.nx*(RAIL_OFF+3), p.y+p.ny*(RAIL_OFF+3)); ctx.lineTo(p.x-p.nx*(RAIL_OFF+3), p.y-p.ny*(RAIL_OFF+3)); ctx.stroke();
      }
      ctx.lineWidth = 2.8; ctx.shadowColor = "rgba(6,200,217,0.65)"; ctx.shadowBlur = 11; ctx.strokeStyle = "rgba(6,200,217,0.55)";
      [+1, -1].forEach(side => {
        ctx.beginPath();
        pts.forEach((p, i) => { const rx = p.x + p.nx*RAIL_OFF*side, ry = p.y + p.ny*RAIL_OFF*side; i===0 ? ctx.moveTo(rx,ry) : ctx.lineTo(rx,ry); });
        ctx.stroke();
      });
      ctx.shadowBlur = 3; ctx.lineWidth = 1.0; ctx.strokeStyle = "rgba(180,248,255,0.09)";
      ctx.beginPath(); pts.forEach((p,i)=>{ i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y); }); ctx.stroke();
      ctx.restore();
    }

    function drawTrail(arcPos) {
      const trailArc = 140, tailStart = arcPos - NUM_CARS * ARC_SEP - trailArc;
      ctx.save(); const STEPS = 80;
      for (let i = STEPS; i > 1; i--) {
        const sa = tailStart + (i-1)/STEPS*trailArc, sb = tailStart + i/STEPS*trailArc;
        const ia = idxAtLen(sa), ib = idxAtLen(sb), f = i/STEPS;
        ctx.beginPath(); ctx.moveTo(pts[ia].x,pts[ia].y); ctx.lineTo(pts[ib].x,pts[ib].y);
        ctx.strokeStyle=`rgba(90,235,255,${f*f*0.65})`; ctx.lineWidth=f*4+0.5;
        ctx.shadowColor="rgba(6,200,217,0.8)"; ctx.shadowBlur=f*12; ctx.stroke();
      }
      ctx.restore();
    }

    function drawTrain(arcPos) {
      const CW=46, CH=16, CHASSIS_H=8, WHEEL_R=5.5, LIFT=CH/2+CHASSIS_H+WHEEL_R;
      for (let c = NUM_CARS-1; c >= 0; c--) {
        const carArc=arcPos-c*ARC_SEP, idx=idxAtLen(carArc), p=pts[idx];
        const ang=Math.atan2(p.ty,p.tx), isLead=(c===0);
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(ang); ctx.translate(0,-LIFT);
        ctx.shadowColor="rgba(6,200,217,0.5)"; ctx.shadowBlur=8; ctx.fillStyle="rgba(8,40,55,0.97)";
        rrect(ctx,-CW/2-2,CH/2,CW+4,CHASSIS_H,2); ctx.fill();
        ctx.fillStyle="rgba(6,200,217,0.38)"; ctx.fillRect(-CW/2,CH/2+1,CW,2); ctx.fillRect(-CW/2,CH/2+CHASSIS_H-3,CW,2);
        ctx.shadowBlur=10;
        [-CW/2+10,CW/2-10].forEach(bx => {
          const wY=CH/2+CHASSIS_H;
          ctx.fillStyle="rgba(4,28,42,0.98)"; ctx.fillRect(bx-9,CH/2+1,18,CHASSIS_H-1);
          ctx.strokeStyle="rgba(6,200,217,0.45)"; ctx.lineWidth=1; ctx.strokeRect(bx-9,CH/2+1,18,CHASSIS_H-1);
          [-5,5].forEach(wo => {
            const wg=ctx.createRadialGradient(bx+wo,wY,0,bx+wo,wY,WHEEL_R);
            wg.addColorStop(0,"rgba(100,220,240,0.95)"); wg.addColorStop(0.4,"rgba(6,200,217,0.85)");
            wg.addColorStop(0.8,"rgba(2,80,100,0.90)"); wg.addColorStop(1,"rgba(1,30,45,0.95)");
            ctx.shadowColor="rgba(6,200,217,0.7)"; ctx.shadowBlur=8;
            ctx.beginPath(); ctx.arc(bx+wo,wY,WHEEL_R,0,Math.PI*2); ctx.fillStyle=wg; ctx.fill();
            ctx.strokeStyle="rgba(6,200,217,0.55)"; ctx.lineWidth=1.2;
            ctx.beginPath(); ctx.arc(bx+wo,wY,WHEEL_R-1,0,Math.PI*2); ctx.stroke();
            ctx.shadowBlur=4; ctx.fillStyle="rgba(200,248,255,0.9)";
            ctx.beginPath(); ctx.arc(bx+wo,wY,1.4,0,Math.PI*2); ctx.fill();
          });
          ctx.shadowBlur=0; ctx.strokeStyle="rgba(6,200,217,0.30)"; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.moveTo(bx-10,wY); ctx.lineTo(bx+10,wY); ctx.stroke();
        });
        ctx.shadowColor=isLead?"rgba(6,200,217,0.95)":"rgba(6,200,217,0.70)"; ctx.shadowBlur=isLead?22:14;
        if (isLead) {
          ctx.beginPath(); ctx.moveTo(CW/2+10,0);
          ctx.bezierCurveTo(CW/2+7,-CH/2+2,CW/2-3,-CH/2,CW/2-9,-CH/2);
          ctx.lineTo(-CW/2+3,-CH/2); ctx.quadraticCurveTo(-CW/2,-CH/2,-CW/2,-CH/2+3);
          ctx.lineTo(-CW/2,CH/2-3); ctx.quadraticCurveTo(-CW/2,CH/2,-CW/2+3,CH/2);
          ctx.lineTo(CW/2-9,CH/2); ctx.bezierCurveTo(CW/2-3,CH/2,CW/2+7,CH/2-2,CW/2+10,0); ctx.closePath();
        } else { rrect(ctx,-CW/2,-CH/2,CW,CH,3); }
        const bodyG=ctx.createLinearGradient(0,-CH/2,0,CH/2);
        bodyG.addColorStop(0,"rgba(60,200,230,0.98)"); bodyG.addColorStop(0.15,"rgba(14,110,140,0.98)");
        bodyG.addColorStop(0.75,"rgba(6,75,100,0.97)"); bodyG.addColorStop(1,"rgba(4,40,58,0.98)");
        ctx.fillStyle=bodyG; ctx.fill();
        ctx.shadowBlur=0; ctx.fillStyle="rgba(100,240,255,0.18)";
        isLead ? ctx.fillRect(-CW/2,-CH/2,CW+10,3) : ctx.fillRect(-CW/2,-CH/2,CW,3);
        ctx.strokeStyle="rgba(6,200,217,0.18)"; ctx.lineWidth=0.7;
        ctx.beginPath(); ctx.moveTo(-CW/2+3,0); ctx.lineTo(CW/2-3,0); ctx.stroke();
        [-CW/6,CW/6].forEach(rx=>{ ctx.beginPath(); ctx.moveTo(rx,-CH/2+2); ctx.lineTo(rx,CH/2-2); ctx.stroke(); });
        ctx.fillStyle="rgba(180,240,255,0.16)";
        const winX=-CW/2+7, winW=CW-14, winH=CH*0.44;
        rrect(ctx,winX,-CH/2+2,winW,winH,2); ctx.fill();
        ctx.strokeStyle="rgba(6,200,217,0.30)"; ctx.lineWidth=0.8; ctx.stroke();
        ctx.shadowBlur=0;
        [winX+winW*0.25,winX+winW*0.72].forEach(hx=>{
          ctx.fillStyle="rgba(2,45,62,0.88)"; ctx.beginPath(); ctx.ellipse(hx,-CH/2-4,4.2,4.8,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle="rgba(2,35,50,0.70)"; ctx.fillRect(hx-5,-CH/2-1,10,3);
        });
        ctx.strokeStyle="rgba(6,200,217,0.45)"; ctx.lineWidth=1.8; ctx.shadowColor="rgba(6,200,217,0.4)"; ctx.shadowBlur=4;
        [winX+winW*0.25,winX+winW*0.72].forEach(hx=>{
          ctx.beginPath(); ctx.moveTo(hx-5,-CH/2+2); ctx.lineTo(hx-5,-CH/2-2);
          ctx.arc(hx,-CH/2-2,5,Math.PI,0); ctx.lineTo(hx+5,-CH/2+2); ctx.stroke();
        });
        if (isLead) {
          ctx.shadowColor="rgba(255,255,255,0.95)"; ctx.shadowBlur=26; ctx.fillStyle="rgba(255,252,220,0.98)";
          ctx.beginPath(); ctx.ellipse(CW/2+7,-2,2.5,4.5,0,0,Math.PI*2); ctx.fill();
          ctx.shadowColor="rgba(255,60,60,0.8)"; ctx.shadowBlur=12; ctx.fillStyle="rgba(255,80,80,0.95)";
          ctx.beginPath(); ctx.ellipse(CW/2+7,4,1.8,2.5,0,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
          const lbg=ctx.createLinearGradient(CW/2+8,0,CW/2+58,0);
          lbg.addColorStop(0,"rgba(255,252,200,0.18)"); lbg.addColorStop(1,"rgba(255,252,200,0)");
          ctx.fillStyle=lbg; ctx.beginPath(); ctx.moveTo(CW/2+7,-5); ctx.lineTo(CW/2+58,-22); ctx.lineTo(CW/2+58,22); ctx.lineTo(CW/2+7,5); ctx.closePath(); ctx.fill();
        }
        ctx.shadowBlur=0; ctx.fillStyle="rgba(6,200,217,0.55)";
        ctx.beginPath(); ctx.moveTo(-CW/2,CH/2); ctx.lineTo(-CW/2-5,CH/2+4); ctx.lineTo(-CW/2,CH/2+8); ctx.lineTo(-CW/2,CH/2); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.save();
      for (let c=0; c<NUM_CARS-1; c++) {
        const a=pts[idxAtLen(arcPos-c*ARC_SEP)], b=pts[idxAtLen(arcPos-(c+1)*ARC_SEP)];
        const offA=CH/2+4;
        const ax=a.x-a.nx*offA-a.tx*CW/2, ay=a.y-a.ny*offA-a.ty*CW/2;
        const bx=b.x-b.nx*offA+b.tx*CW/2, by=b.y-b.ny*offA+b.ty*CW/2;
        ctx.strokeStyle="rgba(6,200,217,0.40)"; ctx.shadowColor="rgba(6,200,217,0.35)"; ctx.shadowBlur=4; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      }
      ctx.restore();
    }

    const resize = () => { buildTrack(); makeStars(); makeSparkles(); };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement || document.body);
    buildTrack();

    function draw(ts) {
      if (lastTS === null) lastTS = ts;
      const dt = Math.min((ts - lastTS) / 16.667, 1.4);
      lastTS = ts;
      ctx.clearRect(0, 0, W, H);
      drawSky(ts);
      drawSparkles(ts);
      drawSilhouette();
      drawPtero();
      drawTrack();
      if (pts.length > 0 && totalLen > 0) {
        drawTrail(trainIdx);
        drawTrain(trainIdx);
        const idx = idxAtLen(trainIdx);
        const onLift = (idx >= liftStart && idx <= liftEnd) && pts[idx].ty < -0.18;
        const normH = (pts[idx].y - minY) / (maxY - minY + 1);
        const targetSpeed = onLift ? 1.2 : (3.5 + normH * 7.0);
        smoothSpeed = smoothSpeed * 0.88 + targetSpeed * 0.12;
        trainIdx = trainIdx + smoothSpeed * dt;
        if (trainIdx >= totalLen) trainIdx -= totalLen;
      }
      animId = requestAnimationFrame(draw);
    }
    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior:"smooth", block:"start" });

  // Stable contact sparkle positions (deterministic via index math)
  const contactSparkles = Array.from({ length: 30 }, (_, i) => ({
    left:  `${((i * 37 + 11) % 97) + 1.5}%`,
    top:   `${((i * 53 + 7)  % 88) + 4}%`,
    delay: `${((i * 0.37) % 4.8).toFixed(2)}s`,
    dur:   `${(2.2 + (i * 0.29) % 2.4).toFixed(2)}s`,
    size:  `${(4 + (i * 0.8) % 7).toFixed(1)}px`,
    warm:  i % 3 !== 0,
  }));

  const projects = [
    { num:"01", name:"Lingua", link:"https://linguaclassroom.com", role:"AI Language Learning Platform · Jan 2025 – Present",
      desc:"Students get one hour of language class a day — nowhere near enough for real-world fluency. Lingua changes that. An AI-powered platform where high schoolers practice authentic conversations with distinct AI characters and receive real-time feedback, while teachers get a holistic view of what their entire class is struggling with. Built in active collaboration with a high school Spanish teacher.",
      tags:["React","Next.js","Supabase","Gemini Flash","PostgreSQL","RBAC"]},
    { num:"02", name:"AI Career Coach", link:"https://ai-career-coach-kailash.vercel.app/", role:"Full-Stack AI App · Nov – Dec 2025",
      desc:"Gemini-powered ATS-compliant resume generation, mock interview engine with performance tracking, and automated weekly industry trend updates via Inngest workflows.",
      tags:["Next.js","NeonDB","Prisma","Inngest","Gemini Flash"] },
    { num:"03", name:"Home Price Estimator", role:"Data Structures + Full-Stack · Oct – Nov 2025",
      desc:"98% accuracy housing price estimation querying 100,000+ records in O(log n) time using Red-Black Tree and B-Tree. C++ backend connected to a React/Next.js frontend via REST.",
      tags:["React","Next.js","C++","Red-Black Tree","httplib"] },
  ];
  const experience = [
    { date:"May – Jun 2025", org:"EDU Africa", loc:"Cape Town, South Africa",
      role:"Software Engineering Intern",
      desc:"Built an interactive mapping platform connecting residents of underserved Cape Town neighborhoods to emergency services and local government — giving families facing evictions, power outages, and water shortages a direct channel to document issues and hold authorities accountable. Every pin on that map represents a family that now has a voice.",
      tags:["MERN Stack","React","Leaflet","Node.js","REST API"] },
    { date:"Aug 2025 – Present", org:"UF Computational Linguistics Lab", loc:"Gainesville, FL",
      role:"Research Assistant · Dr. Zoey Liu",
      desc:"Investigating how data partitioning strategies impact LLM generalization across the world's linguistic diversity — focused on low-resource languages systematically excluded from modern AI. Running large-scale benchmarks of OLMo-2 across 2,000+ languages on UF's HiPerGator supercomputer.",
      tags:["OLMo-2","HiPerGator HPC","Cross-Lingual NLP","Python"] },
    { date:"Sep 2025 – Present", org:"UF GatorAI Club", loc:"Gainesville, FL",
      role:"Machine Learning Engineer",
      desc:"Built an AI Teaching Assistant deploying course-specific chatbot instances for 50+ students. Engineered a RAG pipeline with ChromaDB achieving sub-500ms semantic retrieval across 1,000+ academic documents, with Gemini 2.0 orchestration and custom guardrails maintaining academic integrity.",
      tags:["FastAPI","Gemini 2.0","RAG","ChromaDB","Next.js"] },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@400;700;900&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,600&family=Lato:ital,wght@0,300;0,400;0,700;1,300&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        :root{
          --bg:#030610;--cyan:#06c8d9;--cyan2:#38e8f5;
          --violet:#7c4ddb;--violet2:#b08af0;
          --cream:#eef2ff;--warm:#9aa4c4;--dim:#4a5278;
          --line:rgba(6,200,217,0.13);--line2:rgba(6,200,217,0.26);
        }
        body{background:var(--bg);color:var(--cream);font-family:'Lato',sans-serif;overflow-x:hidden}
        ::-webkit-scrollbar{width:2px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--cyan)}
        body::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:9999;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          opacity:0.022}

        nav{position:fixed;inset:0 0 auto;z-index:200;display:flex;align-items:center;justify-content:space-between;padding:26px 64px;transition:all 0.4s ease}
        nav.stuck{background:rgba(3,6,16,0.94);backdrop-filter:blur(24px) saturate(1.5);border-bottom:1px solid var(--line);padding:16px 64px}
        .logo{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:1rem;letter-spacing:0.04em;color:var(--cyan);display:flex;align-items:center;gap:10px}
        .logo-orb{width:8px;height:8px;border-radius:50%;background:var(--cyan);box-shadow:0 0 0 2px rgba(6,200,217,0.25);animation:orb-pulse 2.6s ease infinite}
        @keyframes orb-pulse{0%,100%{box-shadow:0 0 0 2px rgba(6,200,217,0.25)}50%{box-shadow:0 0 0 7px rgba(6,200,217,0),0 0 18px rgba(6,200,217,0.6)}}
        .nav-mid{display:flex;gap:36px}
        .nav-mid button{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:0.95rem;color:var(--dim);background:none;border:none;cursor:pointer;transition:color 0.18s;padding:0}
        .nav-mid button:hover{color:var(--cream)}
        .nav-dl{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:1.05rem;letter-spacing:0.06em;color:var(--bg);background:var(--cyan);padding:9px 24px;text-decoration:none;transition:background 0.18s}
        .nav-dl:hover{background:var(--cyan2)}

        .hero-wrap{position:relative;min-height:100svh;display:flex;align-items:flex-end;overflow:hidden}
        .hero-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:0}
        .hero{position:relative;z-index:1;max-width:1320px;margin:0 auto;width:100%;padding:0 64px 88px;display:flex;flex-direction:column}
        .hero-tag{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:1.05rem;letter-spacing:0.14em;text-transform:uppercase;color:#ffffff;margin-bottom:28px;display:flex;align-items:center;gap:18px;animation:rise 0.7s ease 0.1s both;text-shadow:0 0 18px rgba(6,200,217,0.45),0 1px 3px rgba(0,0,0,0.7)}
        .hero-tag::before{content:'';width:30px;height:1px;background:#ffffff}
        .hero-name{font-family:'Cinzel Decorative',serif;font-size:clamp(5rem,13vw,14.5rem);font-weight:700;line-height:0.87;letter-spacing:-0.01em;margin-bottom:8px;animation:rise 0.8s ease 0.22s both}
        .hero-name .l1{display:block;color:var(--cream)}
        .hero-name .l2{display:block;background:linear-gradient(115deg,var(--cyan) 0%,var(--violet2) 50%,var(--cyan2) 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:grad-flow 7s ease infinite;filter:drop-shadow(0 0 55px rgba(6,200,217,0.32))}
        @keyframes grad-flow{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        .hero-row{display:flex;align-items:flex-end;justify-content:space-between;gap:48px;margin-top:36px;animation:rise 0.8s ease 0.42s both}
        .hero-sub{font-family:'Lato',sans-serif;font-weight:300;font-size:clamp(0.95rem,1.5vw,1.14rem);line-height:1.82;color:var(--warm);max-width:500px}
        .hero-sub strong{color:var(--cream);font-weight:700}
        .hero-btns{display:flex;gap:12px;flex-shrink:0}
        .btn-p{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:1.15rem;padding:13px 34px;background:var(--cyan);color:var(--bg);border:none;cursor:pointer;transition:all 0.2s}
        .btn-p:hover{background:var(--cyan2);transform:translateY(-2px)}
        .btn-g{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:1.15rem;padding:13px 34px;background:none;border:1px solid var(--line2);color:var(--warm);cursor:pointer;transition:all 0.2s}
        .btn-g:hover{border-color:var(--cyan);color:var(--cyan)}
        @keyframes rise{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}

        .tape{background:var(--bg);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:11px 0;overflow:hidden;position:relative;z-index:1}
        .tape-inner{display:flex;animation:tape-scroll 26s linear infinite;white-space:nowrap}
        @keyframes tape-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .tape-item{font-family:'Cinzel',serif;font-size:1.05rem;color:var(--dim);margin-right:52px}
        .tape-dot{color:var(--cyan);margin-right:52px}

        .sec{background:var(--bg);position:relative;z-index:1;padding:110px 0}
        .sec-inner{max-width:1100px;margin:0 auto;padding:0 64px}
        .sec-label{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:1.5rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--cyan);margin-bottom:64px;display:flex;align-items:center;gap:18px}
        .sec-label::after{content:'';flex:1;height:1px;background:var(--line)}

        em{font-style:italic;font-weight:700}

        .why-lede{font-family:'Cormorant Garamond',serif;font-size:clamp(2rem,3.2vw,2.55rem);font-weight:500;line-height:1.38;color:var(--cream);margin-bottom:52px}
        .why-lede em{font-style:italic;font-weight:700;background:linear-gradient(110deg,var(--cyan),var(--violet2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .why-cols{display:grid;grid-template-columns:1fr 1fr;gap:56px}
        .why-col p{font-family:'Lato',sans-serif;font-weight:300;font-size:1.06rem;line-height:1.88;color:var(--warm);margin-bottom:40px}
        .why-col p:last-child{margin-bottom:0}
        .why-col strong{color:var(--cream);font-weight:700}
        .why-col em{color:var(--cyan2);font-style:italic;font-weight:700}
        .role-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
        .role-chip{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:0.82rem;padding:10px 20px;border:1px solid var(--line2);color:var(--cyan);background:rgba(6,200,217,0.06)}

        .proj-list{display:flex;flex-direction:column}
        .proj-row{border-top:1px solid var(--line);padding:52px 0;display:grid;grid-template-columns:260px 1fr;gap:56px;transition:background 0.22s}
        .proj-row:last-child{border-bottom:1px solid var(--line)}
        .proj-row:hover{background:rgba(6,200,217,0.025)}
        .pnum{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:0.72rem;color:rgba(6,200,217,0.3);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.14em}
        .pname{font-family:'Cinzel Decorative',serif;font-size:clamp(2rem,3.5vw,3.2rem);font-weight:400;line-height:1;color:var(--cream);margin-bottom:8px}
        .pname.star{background:linear-gradient(110deg,var(--cyan),var(--violet2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .prole{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:0.82rem;color:var(--cyan);margin-bottom:4px}
        .pdate{font-weight:300;font-size:0.75rem;color:var(--dim)}
        .pname-link { text-decoration: none; color: inherit;}
        .pname-link:hover { text-decoration: underline; }
        .pdesc{font-weight:300;font-size:1.02rem;line-height:1.82;color:var(--warm);margin-bottom:26px}
        .tags{display:flex;flex-wrap:wrap;gap:8px}
        .tag{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:0.78rem;padding:4px 13px;border:1px solid var(--line);color:var(--dim);transition:all 0.18s}
        .tag:hover{border-color:var(--cyan);color:var(--cyan)}

        .exp-list{display:flex;flex-direction:column}
        .exp-row{border-top:1px solid var(--line);padding:46px 0;display:grid;grid-template-columns:200px 1fr;gap:52px}
        .exp-row:last-child{border-bottom:1px solid var(--line)}
        .edate{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:0.75rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--cyan);margin-bottom:8px}
        .eorg{font-family:'Cinzel',serif;font-size:1.3rem;font-weight:400;color:var(--cream);margin-bottom:4px}
        .eloc{font-weight:300;font-size:0.8rem;color:var(--dim)}
        .erole{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:0.82rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--violet2);margin-bottom:14px}
        .edesc{font-weight:300;font-size:1.02rem;line-height:1.8;color:var(--warm);margin-bottom:20px}

        .skill-table{display:flex;flex-direction:column}
        .skill-row{display:flex;align-items:baseline;gap:32px;padding:22px 0;border-bottom:1px solid var(--line)}
        .skill-row:first-child{border-top:1px solid var(--line)}
        .scat{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:0.78rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--cyan);min-width:110px}
        .sitems{display:flex;flex-wrap:wrap;gap:10px}
        .sitem{font-weight:300;font-size:0.92rem;color:var(--warm);padding:5px 16px;border:1px solid var(--line);transition:all 0.18s;cursor:default}
        .sitem:hover{border-color:var(--cyan);color:var(--cream);background:rgba(6,200,217,0.05)}

        /* ── CONTACT */
        .contact-outer{background:var(--bg);position:relative;z-index:1;padding:120px 0 80px;text-align:center;overflow:hidden}
        .contact-glow{position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);width:900px;height:500px;border-radius:50%;background:radial-gradient(ellipse,rgba(6,200,217,0.07) 0%,rgba(124,77,219,0.05) 50%,transparent 70%);filter:blur(60px);pointer-events:none}

        /* ── CSS STAR SPARKLES for contact section
           Each .css-sparkle is a 4-point cross star made from two pill-shaped bars */
        .css-sparkle{
          position:absolute;
          pointer-events:none;
          transform:translate(-50%,-50%);
        }
        .css-sparkle::before,
        .css-sparkle::after{
          content:'';
          position:absolute;
          top:50%; left:50%;
          transform:translate(-50%,-50%);
          border-radius:999px;
        }
        /* Vertical arm */
        .css-sparkle::before{
          width:var(--sw);
          height:var(--sh);
          background:linear-gradient(to bottom,
            transparent 0%,
            var(--sc) 30%,
            rgba(255,255,255,0.98) 50%,
            var(--sc) 70%,
            transparent 100%);
        }
        /* Horizontal arm */
        .css-sparkle::after{
          width:var(--sh);
          height:var(--sw);
          background:linear-gradient(to right,
            transparent 0%,
            var(--sc) 30%,
            rgba(255,255,255,0.98) 50%,
            var(--sc) 70%,
            transparent 100%);
        }

        /* Twinkle: fade in bright, pulse, fade out — like a real star winking */
        @keyframes star-twinkle{
          0%   {opacity:0;   transform:translate(-50%,-50%) scale(0.3) rotate(0deg)}
          12%  {opacity:0.95;transform:translate(-50%,-50%) scale(1.15) rotate(8deg)}
          30%  {opacity:0.55;transform:translate(-50%,-50%) scale(0.80) rotate(0deg)}
          50%  {opacity:0.90;transform:translate(-50%,-50%) scale(1.05) rotate(-6deg)}
          70%  {opacity:0.45;transform:translate(-50%,-50%) scale(0.75) rotate(3deg)}
          88%  {opacity:0.80;transform:translate(-50%,-50%) scale(0.95) rotate(0deg)}
          100% {opacity:0;   transform:translate(-50%,-50%) scale(0.3) rotate(0deg)}
        }

        .contact-box{position:relative;z-index:2;max-width:760px;margin:0 auto;padding:0 64px}
        .contact-over{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:0.85rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--cyan);display:block;margin-bottom:24px}
        .contact-h{font-family:'Cinzel Decorative',serif;font-size:clamp(3.5rem,9vw,9rem);font-weight:400;line-height:0.9;color:var(--cream);margin-bottom:12px}
        .contact-h em{display:block;font-style:italic;font-weight:700;background:linear-gradient(110deg,var(--cyan),var(--violet2),var(--cyan2));background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:grad-flow 6s ease infinite}
        .contact-p{font-weight:300;font-size:1.06rem;line-height:1.78;color:var(--warm);margin:28px auto 44px}
        .contact-links{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
        .cl{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:0.95rem;padding:13px 28px;text-decoration:none;transition:all 0.18s;border:none;cursor:pointer}
        .cl.p{background:var(--cyan);color:var(--bg)}.cl.p:hover{background:var(--cyan2)}
        .cl.g{border:1px solid var(--line2);color:var(--warm)}.cl.g:hover{border-color:var(--cyan);color:var(--cyan)}
        .contact-foot{font-weight:300;font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim);margin-top:64px}

        .r{opacity:0;transform:translateY(28px);transition:opacity 0.72s ease,transform 0.72s ease}
        .r.vis{opacity:1;transform:none}
        .d1{transition-delay:0.1s}.d2{transition-delay:0.2s}.d3{transition-delay:0.3s}

        /* ── SHIMMER MUSIC BUTTON */
        .music-btn-wrap{
          position:absolute;top:8%;left:0;right:0;margin:0 auto;width:fit-content;
          z-index:10;pointer-events:auto;
          animation:rise 0.9s ease 0.6s both;
        }
        .music-btn{
          font-family:'Cinzel',serif;font-weight:700;font-size:0.72rem;
          letter-spacing:0.18em;text-transform:uppercase;
          padding:14px 28px;border:none;cursor:pointer;
          position:relative;overflow:hidden;
          border-radius:2px;
          background:linear-gradient(110deg,#b08020,#f7d96a,#fff0a0,#f0c040,#c8902a,#f7d96a,#b08020);
          background-size:300% 100%;
          color:#1a0e00;
          box-shadow:0 0 18px rgba(240,190,40,0.55),0 0 40px rgba(200,140,10,0.25),inset 0 1px 0 rgba(255,255,255,0.4);
          animation:gold-shimmer 2.8s linear infinite;
          transition:transform 0.15s,box-shadow 0.15s;
          white-space:nowrap;
        }
        .music-btn:hover{transform:scale(1.04);box-shadow:0 0 28px rgba(240,190,40,0.80),0 0 60px rgba(200,140,10,0.40)}
        .music-btn:active{transform:scale(0.97)}
        /* Silver flash overlay — sweeps left to right */
        .music-btn::after{
          content:'';position:absolute;inset:0;
          background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,0.55) 50%,transparent 70%);
          background-size:200% 100%;
          animation:silver-sweep 2.2s ease-in-out infinite;
        }
        @keyframes gold-shimmer{
          0%{background-position:0% 50%}
          100%{background-position:300% 50%}
        }
        @keyframes silver-sweep{
          0%{background-position:-100% 0}
          60%,100%{background-position:250% 0}
        }
        .music-btn-played{
          background:linear-gradient(110deg,#707080,#c8cce0,#ffffff,#d0d4e8,#909098,#c8cce0,#707080) !important;
          background-size:300% 100% !important;
          animation:silver-shimmer 2.8s linear infinite !important;
          box-shadow:0 0 18px rgba(180,200,240,0.45),0 0 40px rgba(140,160,200,0.2),inset 0 1px 0 rgba(255,255,255,0.5) !important;
          color:#0a0a14 !important;
        }
        @keyframes silver-shimmer{
          0%{background-position:0% 50%}
          100%{background-position:300% 50%}
        }

        @media(max-width:860px){
          nav{padding:16px 24px}nav.stuck{padding:12px 24px}.nav-mid{display:none}
          .hero{padding:0 24px 60px}.sec-inner,.contact-box{padding:0 24px}
          .why-cols{grid-template-columns:1fr}.proj-row{grid-template-columns:1fr;gap:20px}
          .exp-row{grid-template-columns:1fr;gap:14px}.hero-row{flex-direction:column;align-items:flex-start}
          .skill-row{flex-direction:column;gap:14px}
        }
      `}</style>

      <nav className={scrolled?"stuck":""}>
        <div className="logo"><div className="logo-orb"/>KS × Universal Creative</div>
        <div className="nav-mid">
          {[["why","Why UC"],["projects","Work"],["experience","Experience"],["contact","Contact"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>scrollTo(id)}>{lbl}</button>
          ))}
        </div>
        <a href="/Kailash_Shankar_Resume_Universal.pdf" className="nav-dl" download>Resume ↓</a>
      </nav>

      <div className="hero-wrap">
        <canvas ref={canvasRef} className="hero-canvas" />

        {/* ── Hidden audio element */}
        <audio ref={audioRef} preload="auto">
          <source src="/audio/universal_pictures.mp3" type="audio/mpeg"/>
        </audio>

        {/* ── Shimmer music button — centered upper hero */}
        <div className="music-btn-wrap">
          <button
            className="music-btn"
            onClick={e => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(()=>{});
              }
              e.currentTarget.classList.add("music-btn-played");
              e.currentTarget.textContent = "♪ Now Playing ♪";
            }}
          >
            Press this button to make something AWESOME happen
          </button>
        </div>

        <div className="hero">
          <div className="hero-tag">Applying · Fall 2026 · Universal Creative</div>
          <h1 className="hero-name">
            <span className="l1">Kailash</span>
            <span className="l2">Shankar.</span>
          </h1>
          <div className="hero-row">
            <p className="hero-sub">
              <strong>CS + Linguistics · University of Florida · 4.0 GPA</strong><br/>
              With everything I build, I have one goal: <em>deliver real impact on people&apos;s lives.</em>
              To ideate, design, and deploy software that empowers, inspires, and makes the world a better place.
              Now I want to help build <em>the future of the guest experience</em>.
            </p>
            <div className="hero-btns">
              <button className="btn-p" onClick={()=>scrollTo("why")}>Why Universal</button>
              <button className="btn-g" onClick={()=>scrollTo("projects")}>My Work</button>
            </div>
          </div>
        </div>
      </div>

      <div className="tape">
        <div className="tape-inner">
          {Array(2).fill(null).flatMap((_,i)=>
            ["Full-Stack Engineering","AI & Machine Learning","Computational Linguistics",
             "Interactive Software","Game Development","Immersive Experience Design"].map((t,j)=>(
              <span key={`${i}-${j}`} className="tape-item">{t}<span className="tape-dot"> ✦ </span></span>
            ))
          )}
        </div>
      </div>

      <section id="why" className="sec">
        <div className="sec-inner">
          <div className="sec-label r">Why Universal Creative</div>
          <div className="why-lede">
            My name is Kailash Shankar, and I am currently a junior majoring in Computer Science with a minor
            in Linguistics at the University of Florida. When I stepped foot into <em>Epic Universe</em> during
            previews last April, I couldn't help but be absolutely awestruck by the amount of cutting-edge technology
            used to create a truly immersive, interactive guest experience.
            <div className="why-col">
              <br />
              <p>From the power-up band challenges in Super Nintendo World to the magical wands in the Wizarding World
              to the facial recognition lockers at Hiccup's Wing Gliders I was dazzled by how all this incredible technology
              seamlessly integrated together to create a <em>truly exceptional guest experience.</em></p>
              <p>Using technology to augment user experience and make a real impact on people's lives is at the
              forefront of everything I build. Last summer I built a mapping platform for a non-profit in Cape Town,
              connecting underserved communities to emergency services — giving families facing evictions and power
              outages a direct channel to be heard and hold their government accountable.</p>
            </div>
            <div className="why-col">
              <p>This experience ignited in me a passion to build software aimed at truly improving the lives of everyday people,
              which has fueled my most recent project, <b><em>Lingua</em></b>, an AI-powered language learning platform simulating immersive,
              real-world conversations for high school students to practice to improve their fluency, while giving teachers meaningful
              insight into where their students are actually struggling. I&apos;ve been working closely with my former high school Spanish
              teacher to implement this learning platform into her classroom, and hopefully in the future, the classrooms of many other
              teachers across the nation.</p>
              <p>My love for creating <em>immersive, AI-driven experiences</em> that make an impact on the lives of ordinary
              people aligns directly with the mission of Universal Creative — to create immersive, state-of-the-art
              experiences that resonate with guests at a <em>truly emotional level</em>, to deliver an unparalleled experience
              for every single guest. I would love the opportunity to contribute to this team this Fall.</p>
            </div>
          </div>
          <div className="role-row r d3">
            <div className="role-chip">Software, Advanced Technology Interactives · #657607</div>
            <div className="role-chip">AI Strategy &amp; Solutions · #657609</div>
          </div>
        </div>
      </section>

      <section id="projects" className="sec">
        <div className="sec-inner">
          <div className="sec-label r">Projects</div>
          <div className="proj-list">
            {projects.map(p=>(
              <div key={p.num} className="proj-row r">
                <div>
                  <div className="pnum">{p.num}</div>
                 {p.link ? <a href={p.link} target="_blank" rel="noreferrer" className={`pname pname-link${p.featured?" star":""}`}>{p.name}</a> : <div className={`pname${p.featured?" star":""}`}>{p.name}</div>}
                  <div className="prole">{p.role.split(" · ")[0]}</div>
                  <div className="pdate">{p.role.split(" · ").slice(1).join(" · ")}</div>
                </div>
                <div>
                  <p className="pdesc">{p.desc}</p>
                  <div className="tags">{p.tags.map(t=><span key={t} className="tag">{t}</span>)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="experience" className="sec">
        <div className="sec-inner">
          <div className="sec-label r">Experience &amp; Research</div>
          <div className="exp-list">
            {experience.map((e,i)=>(
              <div key={i} className="exp-row r">
                <div>
                  <div className="edate">{e.date}</div>
                  <div className="eorg">{e.org}</div>
                  <div className="eloc">{e.loc}</div>
                </div>
                <div>
                  <div className="erole">{e.role}</div>
                  <p className="edesc">{e.desc}</p>
                  <div className="tags">{e.tags.map(t=><span key={t} className="tag">{t}</span>)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="skills" className="sec">
        <div className="sec-inner">
          <div className="sec-label r">Technical Skills</div>
          <div className="skill-table r">
            {[
              {cat:"Languages", items:["Python","C / C++","JavaScript","TypeScript","HTML / CSS"]},
              {cat:"Frameworks",items:["React","Next.js","Node.js","FastAPI","Tailwind CSS"]},
              {cat:"AI & ML",   items:["Gemini 2.0","RAG Pipelines","ChromaDB","OLMo-2","Hugging Face"]},
              {cat:"Databases", items:["PostgreSQL","MongoDB","Supabase","NeonDB","Prisma"]},
              {cat:"Tools",     items:["Unity","Unreal Engine","Docker","Git / GitHub","HiPerGator HPC"]},
            ].map(row=>(
              <div key={row.cat} className="skill-row">
                <div className="scat">{row.cat}</div>
                <div className="sitems">{row.items.map(s=><div key={s} className="sitem">{s}</div>)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT with CSS 4-point star sparkles */}
      <section id="contact" className="contact-outer">
        <div className="contact-glow"/>

        {/* ── CHRONOS — minimal outline silhouette */}
        <div style={{
          position:'absolute', inset:0, display:'flex',
          alignItems:'flex-end', justifyContent:'center',
          pointerEvents:'none', zIndex:0, overflow:'hidden',
        }}>
          <svg
            viewBox="0 0 520 820"
            style={{height:'100%', width:'auto', maxWidth:'680px', opacity:0.38}}
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Single stroke color — cyan tint matching site palette */}
            <g stroke="rgba(6,200,217,1)" fill="none" strokeLinecap="round" strokeLinejoin="round">

              {/* ══ GATE ══
                  Perfect top semicircle: center (260,820), radius 200
                  left x=60, right x=460, crown y=620 */}

              {/* Outer semicircle */}
              <path d="M 60 820 A 200 200 0 0 1 460 820" strokeWidth="3.5"/>
              {/* Inner semicircle — opening */}
              <path d="M 118 820 A 142 142 0 0 1 402 820" strokeWidth="2.5"/>

              {/* Frieze band near crown — thickened stroke as a band */}
              <path d="M 126 820 A 134 134 0 0 1 394 820" strokeWidth="9" strokeOpacity="0.22"/>
              <path d="M 126 820 A 134 134 0 0 1 394 820" strokeWidth="1.5"/>

              {/* Keystone at crown */}
              <path d="M 251 621 L 260 606 L 269 621" strokeWidth="2"/>

              {/* Fence verticals — left of opening */}
              {[-40,-28,-16,-4].map((dx,i)=>(
                <line key={i} x1={118+dx} y1="820" x2={118+dx} y2="720" strokeWidth="1.2" opacity="0.6"/>
              ))}
              {/* Fence verticals — right of opening */}
              {[4,16,28,40].map((dx,i)=>(
                <line key={i} x1={402+dx} y1="820" x2={402+dx} y2="720" strokeWidth="1.2" opacity="0.6"/>
              ))}

              {/* ══ CENTER TOWER SHAFT ══
                  Slim rectangular tower rising from arch apex */}

              {/* Tower body — sits on semicircle crown at y=620 */}
              <rect x="228" y="100" width="64" height="525" strokeWidth="2.5"/>

              {/* Tower base flare — where it meets the semicircle crown */}
              <path d="M 200 625 L 212 608 L 228 600 L 292 600 L 308 608 L 320 625" strokeWidth="2"/>

              {/* Tower horizontal bands */}
              <line x1="224" y1="380" x2="296" y2="380" strokeWidth="1.8"/>
              <line x1="222" y1="390" x2="298" y2="390" strokeWidth="1.2"/>
              <line x1="224" y1="480" x2="296" y2="480" strokeWidth="1.8"/>
              <line x1="224" y1="540" x2="296" y2="540" strokeWidth="1.2"/>

              {/* Side wings / buttresses */}
              <path d="M 228 300 L 200 310 L 195 380 L 228 380" strokeWidth="1.5" opacity="0.7"/>
              <path d="M 292 300 L 320 310 L 325 380 L 292 380" strokeWidth="1.5" opacity="0.7"/>

              {/* ══ ORRERY / ARMILLARY SPHERE ══
                  The top section: rings suggesting the astronomical clockwork */}

              {/* Outer decorative collar ring */}
              <circle cx="260" cy="78" r="72" strokeWidth="2.5"/>

              {/* Tilted orbital ellipses — 3 bands at different angles */}
              <ellipse cx="260" cy="78" rx="65" ry="20" strokeWidth="2"
                transform="rotate(-20, 260, 78)"/>
              <ellipse cx="260" cy="78" rx="55" ry="17" strokeWidth="1.5"
                transform="rotate(55, 260, 78)"/>
              <ellipse cx="260" cy="78" rx="42" ry="13" strokeWidth="1.5"
                transform="rotate(15, 260, 78)"/>

              {/* Equatorial ring (near-flat) */}
              <ellipse cx="260" cy="78" rx="68" ry="9" strokeWidth="1.8"/>

              {/* Polar ring (vertical) */}
              <ellipse cx="260" cy="78" rx="12" ry="72" strokeWidth="1.5"/>

              {/* Horizontal cross-arm extending beyond tower */}
              <line x1="168" y1="78" x2="352" y2="78" strokeWidth="2.5"/>
              {/* Vertical axis arm */}
              <line x1="260" y1="6"  x2="260" y2="155" strokeWidth="2"/>

              {/* Planet orbs — small circles on ring positions */}
              <circle cx="185" cy="65" r="7"  strokeWidth="2"/>
              <circle cx="330" cy="62" r="6"  strokeWidth="2"/>
              <circle cx="215" cy="42" r="5"  strokeWidth="1.8"/>
              <circle cx="294" cy="104" r="5" strokeWidth="1.8"/>
              {/* Saturn with ring */}
              <circle cx="300" cy="52" r="6" strokeWidth="1.8"/>
              <ellipse cx="300" cy="52" rx="5" ry="12" strokeWidth="1.2"
                transform="rotate(65, 300, 52)" opacity="0.7"/>

              {/* Central sun — concentric circles */}
              <circle cx="260" cy="78" r="14" strokeWidth="2.5"/>
              <circle cx="260" cy="78" r="7"  strokeWidth="2"/>

              {/* Collar nodes — 8 small diamonds at ring perimeter */}
              {Array.from({length:8},(_,i)=>{
                const a = (i/8)*Math.PI*2;
                const cx = 260 + Math.cos(a)*72;
                const cy = 78  + Math.sin(a)*72;
                return <circle key={i} cx={cx} cy={cy} r="4" strokeWidth="1.8"/>;
              })}

              {/* ══ SPIRE ══ */}
              <path d="M 242 100 L 248 60 L 260 44 L 272 60 L 278 100" strokeWidth="2"/>
              {/* Spire tip orb */}
              <circle cx="260" cy="40" r="6" strokeWidth="2"/>
              <circle cx="260" cy="40" r="3" strokeWidth="1.5" opacity="0.6"/>

              {/* Ground baseline */}
              <line x1="55" y1="818" x2="465" y2="818" strokeWidth="1.5" opacity="0.4"/>

            </g>
          </svg>
        </div>

        {contactSparkles.map((sp, i) => (
          <div
            key={i}
            className="css-sparkle"
            style={{
              left: sp.left,
              top:  sp.top,
              '--sh': sp.size,                                         // long arm
              '--sw': `calc(${sp.size} * 0.11)`,                      // thin arm width
              '--sc': sp.warm ? 'rgba(255, 215, 80, 0.92)' : 'rgba(175, 220, 255, 0.88)',
              animation: `star-twinkle ${sp.dur} ease-in-out ${sp.delay} infinite`,
              filter: sp.warm
                ? `drop-shadow(0 0 ${sp.size} rgba(255,200,50,0.75)) drop-shadow(0 0 calc(${sp.size} * 1.8) rgba(255,170,0,0.35))`
                : `drop-shadow(0 0 ${sp.size} rgba(150,205,255,0.75)) drop-shadow(0 0 calc(${sp.size} * 1.8) rgba(90,160,255,0.35))`,
            }}
          />
        ))}

        <div className="contact-box">
          <span className="contact-over r">Let's build something unforgettable</span>
          <h2 className="contact-h r d1">Ready to<em>Create.</em></h2>
          <p className="contact-p r d2">
            Universal is amid a period of <em>rapid expansion</em> - rolling out brand-new destinations and experiences all across the world, 
            and integrating advanced, cutting-edge tech into the guest experience is a pivotal aspect to this unprecedented growth 
            of the Universal brand. I'm thrilled about the opportunity to contribute to Universal Creative this Fall, to continue 
            to <em>bring imagination to reality</em> like never before.
          </p>
          <div className="contact-links r d3">
            <a href="mailto:kailashshankar@ufl.edu" className="cl p">kailashshankar@ufl.edu</a>
            <a href="https://linkedin.com/in/kailash-shankar" target="_blank" rel="noreferrer" className="cl g">LinkedIn ↗</a>
            <a href="https://github.com/Kailash-Shankar" target="_blank" rel="noreferrer" className="cl g">GitHub ↗</a>
            <a href="/Kailash_Shankar_Resume_Universal.pdf" className="cl g" download>Resume ↓</a>
          </div>
          <div className="contact-foot r d3">© 2026 Kailash Shankar · Gainesville, FL · Built for Universal Creative</div>
        </div>
      </section>
    </>
  );
}
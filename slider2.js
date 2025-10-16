//----------------------------------------------------------------------
// GLOBALS (normalized rendering)
//----------------------------------------------------------------------

// Original design size (used only to convert your old absolute coords)
const ABS_W = 2098;
const ABS_H = 1170;

// --- Normalized helpers: pass fractions (0..1)
function pxn(xf) { return xf * width; }                             // % of viewport width
function pyn(yf) { return yf * height; }                            // % of viewport height
function psn(vf) { return vf * Math.min(width, height); }           // % of the shorter side

// Keep a base scale factor so impulses match prior feel
function su() { return Math.min(width / ABS_W, height / ABS_H); }

function drawImageFit(img, cx, cy, maxDimPx) {
  if (!img) return;
  const iw = img.width, ih = img.height;
  if (!iw || !ih) return;
  const scale = maxDimPx / Math.max(iw, ih);
  const w = iw * scale, h = ih * scale;
  imageMode(CENTER);
  image(img, cx, cy, w, h);
}

let lastW, lastH;

// Squares (small, medium)
let numSmall = 14;
let smallSize = 49; // <-- keep as your original base px; we normalize when drawing
let smallBaseN = [];   // normalized base positions (0..1), vectors
let smallNoiseX = [], smallNoiseY = [], smallPos = [], smallVel = [], smallAcc = [], smallImgs = [];

let connections = [
  [0, 1],[1, 2],[1, 3],[2, 11],[11, 10],[10, 12],[13, 5],[5, 6],[6, 9],[9, 7],
  [8, 5],[8, 6],[10, 7],[10, 1],[4, 5]
];
let dottedConnections = [2];

// Medium ↔ Small cross-connections: [medIndex, smallIndex]
let medSmallConnections = [
  [0, 2],  // Medium #1  → Small #3
  [2, 3]   // Medium #3  → Small #4 (dotted)
];

let addSmallConnections = [
  [1, 3]  // Add_on2 → Small #3
];

let numMed = 3, medSize = 170, medBaseN = [], medNoiseX = [], medNoiseY = [], medPos = [], medVel = [], medAcc = [], medImgs = [];

// --- Add-ons (3 independent images with no connections) ---
const addCount = 3;
const addOnFiles = [
  "Add_ons/Add_on1.png",
  "Add_ons/Add_on2.png",
  "Add_ons/Add_on3.png"
];

let addBaseN = []; // normalized base positions
let addSizes = [80, 280, 220]; // base px; normalized when drawing
let addImgs = [];
let addNoiseX = [], addNoiseY = [];
let addPos = [], addVel = [], addAcc = [];

// ---------------- Sliders / Toggles ----------------
let smallNoiseStep = 0.002;
let smallRadiusMax = 50;  // base px (converted each frame)
let medNoiseStep   = 0.005;
let medRadiusMax   = 20;  // base px
let springK        = 0.02;
let damping        = 0.95;
let impulseStrength = 0.5;
let impactRadiusFactor = 20;

// UI elements
let sliderSmallNoiseStep, spanSmallNoiseStep;
let sliderSmallRadiusMax, spanSmallRadiusMax;
let sliderMedNoiseStep, spanMedNoiseStep;
let sliderMedRadiusMax, spanMedRadiusMax;
let sliderSpringK, spanSpringK;
let sliderDamping, spanDamping;
let sliderImpulse, spanImpulse;
let sliderImpactRadius, spanImpactRadius;
let controlsWrapper;

let gridColor;

// --- Hazard wedges (indices unchanged) --------------------------------
const hazardAreas = [
  {
    vertices: [
      { kind: 'small', i: 5 },
      { kind: 'small', i: 6 },
      { kind: 'small', i: 8 },
    ]
  },
  {
    vertices: [
      { kind: 'small', i: 0 },
      { kind: 'small', i: 1 },
      { kind: 'small', i: 12 },
      { kind: 'addon', i: 1 },
    ]
  },
];

//----------------------------------------------------------------------
// Assets
//----------------------------------------------------------------------
function preload() {
  for (let i = 1; i <= numSmall; i++) {
    const path = `Small/Small_${i}.png`;
    smallImgs[i - 1] = loadImage(path, null, () => console.error('Missing:', path));
  }
  for (let i = 1; i <= numMed; i++) {
    const path = `Medium/Medium_${i}.png`;
    medImgs[i - 1] = loadImage(path, null, () => console.error('Missing:', path));
  }
  for (let i = 0; i < addCount; i++) {
    const path = addOnFiles[i];
    addImgs[i] = loadImage(path, null, () => console.error('Missing:', path));
  }
}

// ---- Make the canvas fill the screen with no scrollbars ----
function enableFullscreenCanvas() {
  const style = document.createElement('style');
  style.innerHTML = `
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
    * { box-sizing: border-box; }
    canvas { display: block; }
  `;
  document.head.appendChild(style);
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
}

//----------------------------------------------------------------------
// setup()
//----------------------------------------------------------------------
function setup() {
  enableFullscreenCanvas();

  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.style('position', 'fixed');
  cnv.style('inset', '0');
  cnv.style('display', 'block');

  lastW = width;
  lastH = height;
  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  gridColor = color(200, 200, 200, 150);

  // --- Convert your absolute bases to normalized once ---
  const smallBaseAbs = [
    {x:650, y:300},{x:300, y:800},{x:850, y:320},{x:1020,y:320},{x:1200,y:200},
    {x:1500,y:380},{x:1670,y:400},{x:1550,y:600},{x:1770,y:680},{x:1950,y:600},
    {x:1250,y:870},{x:1150,y:750},{x:1000,y:755},{x:800, y:900}
  ];
  smallBaseN = smallBaseAbs.map(p => createVector(p.x/ABS_W, p.y/ABS_H));

  const medBaseAbs = [{x:390,y:390},{x:1360,y:200},{x:1500,y:900}];
  medBaseN = medBaseAbs.map(p => createVector(p.x/ABS_W, p.y/ABS_H));

  const addBaseAbs = [{x:895,y:350},{x:510,y:900},{x:470,y:360}];
  addBaseN = addBaseAbs.map(p => createVector(p.x/ABS_W, p.y/ABS_H));

  // --- Initialize state at normalized positions ---
  for (let i = 0; i < numSmall; i++) {
    smallNoiseX[i] = random(10);
    smallNoiseY[i] = random(10);
    smallPos[i] = createVector(pxn(smallBaseN[i].x), pyn(smallBaseN[i].y));
    smallVel[i] = createVector(0,0);
    smallAcc[i] = createVector(0,0);
  }

  for (let i = 0; i < numMed; i++) {
    medNoiseX[i] = random(10);
    medNoiseY[i] = random(10);
    medPos[i] = createVector(pxn(medBaseN[i].x), pyn(medBaseN[i].y));
    medVel[i] = createVector(0,0);
    medAcc[i] = createVector(0,0);
  }

  for (let i = 0; i < addCount; i++) {
    addNoiseX[i] = random(10);
    addNoiseY[i] = random(10);
    addPos[i] = createVector(pxn(addBaseN[i].x), pyn(addBaseN[i].y));
    addVel[i] = createVector(0,0);
    addAcc[i] = createVector(0,0);
  }

  // ---------------- Sliders UI ----------------
  controlsWrapper = createDiv('').style('position','fixed')
                                 .style('left','10px')
                                 .style('top','10px')
                                 .style('padding','8px 10px')
                                 .style('background','rgba(255,255,255,0.8)')
                                 .style('backdrop-filter','blur(4px)')
                                 .style('border','1px solid #ddd')
                                 .style('border-radius','8px')
                                 .style('font','12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial')
                                 .style('max-height','calc(100vh - 20px)')
                                 .style('overflow','auto')
                                 .style('max-width','min(320px, 35vw)')
                                 .style('overflow-x','hidden');

  function addSliderRow(label, min, max, val, step) {
    const row = createDiv('').parent(controlsWrapper).style('margin','4px 0');
    createSpan(label).parent(row).style('display','inline-block').style('width','145px');
    const s = createSlider(min, max, val, step).parent(row).style('width','160px').style('vertical-align','middle');
    const sp = createSpan(val).parent(row).style('display','inline-block').style('width','60px').style('text-align','right').style('margin-left','8px');
    return [s, sp];
  }

  [sliderSmallNoiseStep, spanSmallNoiseStep] = addSliderRow('smallNoiseStep', 0.0005, 0.01, 0.002, 0.0001);
  [sliderSmallRadiusMax, spanSmallRadiusMax] = addSliderRow('smallRadiusMax', 0, 200, 50, 1);
  [sliderMedNoiseStep,   spanMedNoiseStep]   = addSliderRow('medNoiseStep',   0.0005, 0.01, 0.005, 0.0001);
  [sliderMedRadiusMax,   spanMedRadiusMax]   = addSliderRow('medRadiusMax',   0, 200, 20, 1);
  [sliderSpringK,        spanSpringK]        = addSliderRow('springK',        0, 0.2, 0.02, 0.005);
  [sliderDamping,        spanDamping]        = addSliderRow('damping',        0, 1, 0.95, 0.01);
  [sliderImpulse,        spanImpulse]        = addSliderRow('impulseStrength',0, 2, 0.5, 0.01);
  [sliderImpactRadius,   spanImpactRadius]   = addSliderRow('impactRadius',   1, 20, 20, 1);
}

//----------------------------------------------------------------------
// Responsive resize
//----------------------------------------------------------------------
function windowResized() {
  const scaleX = windowWidth / lastW, scaleY = windowHeight / lastH;
  resizeCanvas(windowWidth, windowHeight);
  for (let i = 0; i < numSmall; i++) { smallPos[i].x*=scaleX; smallPos[i].y*=scaleY; }
  for (let i = 0; i < numMed; i++)   { medPos[i].x*=scaleX;   medPos[i].y*=scaleY; }
  for (let i = 0; i < addCount; i++) { addPos[i].x*=scaleX;   addPos[i].y*=scaleY; }
  lastW = width; lastH = height;
}

// --- helpers (same resolve + sorting you already use)
function resolveVertex(v) {
  if (v.kind === 'small') return smallPos[v.i];
  if (v.kind === 'med')   return medPos[v.i];
  if (v.kind === 'addon') return addPos[v.i];
  return null;
}

function sortClockwise(points) {
  const cx = points.reduce((s,p)=>s+p.x,0)/points.length;
  const cy = points.reduce((s,p)=>s+p.y,0)/points.length;
  return points
    .map(p => ({p, a: Math.atan2(p.y - cy, p.x - cx)}))
    .sort((u,v) => u.a - v.a)
    .map(o => o.p);
}

// --- draw hatch-only interior + outline (NO FILL) ---
function drawHazardLines(vertices) {
  let pts = vertices.map(resolveVertex).filter(Boolean);
  if (pts.length < 3) return;
  pts = sortClockwise(pts);

  // bounds
  let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }

  const ctx = drawingContext;
  const poly = new Path2D();
  poly.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) poly.lineTo(pts[i].x, pts[i].y);
  poly.closePath();

  // HATCH
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clip(poly);

  ctx.lineWidth   = psn(1/ABS_H);
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(137, 90, 255, 0.4)';

  const step = psn(7/ABS_H), pad = psn(200/ABS_H);
  for (let x = minX - (maxY - minY) - pad; x < maxX + (maxY - minY) + pad; x += step) {
    ctx.beginPath();
    ctx.moveTo(x,           maxY + pad);
    ctx.lineTo(x + (maxY - minY) + pad, minY - pad);
    ctx.stroke();
  }
  ctx.restore();

  // OUTLINE in connection grey
  push();
  noFill();
  stroke(210);
  strokeWeight(psn(1/ABS_H));
  drawingContext.setLineDash([]);
  beginShape();
  for (const p of pts) vertex(p.x, p.y);
  endShape(CLOSE);
  pop();
}

function drawHazardAreas() {
  for (const area of hazardAreas) drawHazardLines(area.vertices);
}

//----------------------------------------------------------------------
// draw()
//----------------------------------------------------------------------
function draw() {
  // ---- sliders → params ----
  smallNoiseStep     = sliderSmallNoiseStep.value(); spanSmallNoiseStep.html(nf(smallNoiseStep,1,4));
  smallRadiusMax     = sliderSmallRadiusMax.value(); spanSmallRadiusMax.html(smallRadiusMax);
  medNoiseStep       = sliderMedNoiseStep.value();   spanMedNoiseStep.html(nf(medNoiseStep,1,4));
  medRadiusMax       = sliderMedRadiusMax.value();   spanMedRadiusMax.html(medRadiusMax);
  springK            = sliderSpringK.value();        spanSpringK.html(nf(springK,1,3));
  damping            = sliderDamping.value();        spanDamping.html(nf(damping,1,3));
  impulseStrength    = sliderImpulse.value();        spanImpulse.html(nf(impulseStrength,1,2));
  impactRadiusFactor = sliderImpactRadius.value();   spanImpactRadius.html(impactRadiusFactor);

  // Normalize radii/sizes from base px → fractions
  const smallR = psn(smallRadiusMax/ABS_H);
  const medR   = psn(medRadiusMax/ABS_H);

  background(240);
  drawBackgroundCircles();

  // --- small
  let smallDefault = [];
  for (let i=0;i<numSmall;i++){
    smallNoiseX[i]+=smallNoiseStep; smallNoiseY[i]+=smallNoiseStep;
    let dx=map(noise(smallNoiseX[i]),0,1,-smallR,smallR);
    let dy=map(noise(smallNoiseY[i]),0,1,-smallR,smallR);
    let bx=pxn(smallBaseN[i].x),by=pyn(smallBaseN[i].y);
    smallDefault[i]=createVector(bx+dx,by+dy);
  }
  let cursorSquareSize=psn(smallSize/ABS_H)*impactRadiusFactor;
  for(let i=0;i<numSmall;i++){
    smallAcc[i].set(0,0);
    let spring=p5.Vector.sub(smallDefault[i],smallPos[i]).mult(springK);
    smallAcc[i].add(spring);
    let p=smallPos[i];
    if(abs(mouseX-p.x)<cursorSquareSize/2&&abs(mouseY-p.y)<cursorSquareSize/2){
      let away=p5.Vector.sub(p,createVector(mouseX,mouseY));
      away.normalize().mult(impulseStrength * su());
      smallAcc[i].add(away);
    }
    smallVel[i].add(smallAcc[i]); smallVel[i].mult(damping); smallPos[i].add(smallVel[i]);
  }
  for(let i=0;i<connections.length;i++){
    let[a,b]=connections[i]; let A=smallPos[a],B=smallPos[b];
    if(dottedConnections.includes(i)){stroke(120);strokeWeight(psn(1.4/ABS_H));drawingContext.setLineDash([psn(1/ABS_H),psn(13/ABS_H)]);}
    else{stroke(210);strokeWeight(psn(1/ABS_H));drawingContext.setLineDash([]);}
    line(A.x,A.y,B.x,B.y);
  }
  drawingContext.setLineDash([]);

  // --- medium
  let medDefault=[];
  for(let i=0;i<numMed;i++){
    medNoiseX[i]+=medNoiseStep; medNoiseY[i]+=medNoiseStep;
    let dx=map(noise(medNoiseX[i]),0,1,-medR,medR);
    let dy=map(noise(medNoiseY[i]),0,1,-medR,medR);
    let bx=pxn(medBaseN[i].x),by=pyn(medBaseN[i].y);
    medDefault[i]=createVector(bx+dx,by+dy);
  }
  cursorSquareSize=psn(medSize/ABS_H)*impactRadiusFactor;
  for(let i=0;i<numMed;i++){
    medAcc[i].set(0,0);
    let spring=p5.Vector.sub(medDefault[i],medPos[i]).mult(springK); medAcc[i].add(spring);
    let p=medPos[i];
    if(abs(mouseX-p.x)<cursorSquareSize/2&&abs(mouseY-p.y)<cursorSquareSize/2){
      let away=p5.Vector.sub(p,createVector(mouseX,mouseY));
      away.normalize().mult(impulseStrength * su()); medAcc[i].add(away);
    }
    medVel[i].add(medAcc[i]); medVel[i].mult(damping); medPos[i].add(medVel[i]);
  }

  // medium ↔ small connections
  for (let i = 0; i < medSmallConnections.length; i++) {
    const [mi, si] = medSmallConnections[i];
    if (medPos[mi] && smallPos[si]) {
      if (i === 1) {
        stroke(120);
        strokeWeight(psn(1.4/ABS_H));
        drawingContext.setLineDash([psn(1/ABS_H), psn(13/ABS_H)]);
      } else {
        stroke(220);
        strokeWeight(psn(1.8/ABS_H));
        drawingContext.setLineDash([]);
      }
      line(medPos[mi].x, medPos[mi].y, smallPos[si].x, smallPos[si].y);
    }
  }
  drawingContext.setLineDash([]);

  // add-on ↔ small
  for (let i = 0; i < addSmallConnections.length; i++) {
    const [ai, si] = addSmallConnections[i];
    if (addPos[ai] && smallPos[si]) {
      stroke(220);
      strokeWeight(psn(1.8/ABS_H));
      drawingContext.setLineDash([]);
      line(addPos[ai].x, addPos[ai].y, smallPos[si].x, smallPos[si].y);
    }
  }
  drawingContext.setLineDash([]);

  drawHazardAreas();

  // draw images
  noStroke();
  const smallSizePx = psn(smallSize/ABS_H);
  for(let i=0;i<numSmall;i++){
    const p=smallPos[i];
    drawImageFit(smallImgs[i], p.x, p.y, smallSizePx);
  }

  noStroke();
  const medSizePx   = psn(medSize/ABS_H);
  for(let i=0;i<numMed;i++){
    const q=medPos[i];
    drawImageFit(medImgs[i], q.x, q.y, medSizePx);
  }

  // add-ons (motion & draw)
  const addR = smallR;
  for (let i = 0; i < addCount; i++) {
    addNoiseX[i] += smallNoiseStep;
    addNoiseY[i] += smallNoiseStep;
    const dx = map(noise(addNoiseX[i]), 0, 1, -addR, addR);
    const dy = map(noise(addNoiseY[i]), 0, 1, -addR, addR);
    const bx = pxn(addBaseN[i].x), by = pyn(addBaseN[i].y);
    const target = createVector(bx + dx, by + dy);

    addAcc[i].set(0, 0);
    const spring = p5.Vector.sub(target, addPos[i]).mult(springK);
    addAcc[i].add(spring);

    const cursorSquareSizeAdd = psn(addSizes[i]/ABS_H) * impactRadiusFactor;
    const rp = addPos[i];
    if (abs(mouseX - rp.x) < cursorSquareSizeAdd / 2 && abs(mouseY - rp.y) < cursorSquareSizeAdd / 2) {
      const away = p5.Vector.sub(rp, createVector(mouseX, mouseY));
      away.normalize().mult(impulseStrength * su());
      addAcc[i].add(away);
    }

    addVel[i].add(addAcc[i]);
    addVel[i].mult(damping);
    addPos[i].add(addVel[i]);
  }

  noStroke();
  for (let i = 0; i < addCount; i++) {
    const r = addPos[i];
    const s = psn(addSizes[i]/ABS_H);
    drawImageFit(addImgs[i], r.x, r.y, s);
  }

  // --- overlay text (brand grey gradient left→right)
  push();
  const ctx = drawingContext;
  const fs = psn(200/ABS_H);
  const lh = fs * 0.9;
  const cx = width / 2;
  const cy = height / 2;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fs}px Helvetica, Arial, sans-serif`;

  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, '#636472');
  grad.addColorStop(1, '#C4C4CB');
  ctx.fillStyle = grad;

  ctx.fillText('Powering',     cx, cy - lh/2);
  ctx.fillText('Global Trade', cx, cy + lh/2);

  ctx.restore();
  pop();
}

//----------------------------------------------------------------------
// Background Circles (normalized)
//----------------------------------------------------------------------
function drawBackgroundCircles(){
  push(); stroke(200); strokeWeight(psn(2/ABS_H)); noFill();
  drawingContext.setLineDash([psn(1/ABS_H), psn(10/ABS_H)]);
  ellipse(pxn(510/ABS_W), pyn(585/ABS_H), psn(1000/ABS_H), psn(1000/ABS_H));
  drawingContext.setLineDash([]); pop();

  push(); stroke(200); strokeWeight(psn(1/ABS_H)); noFill();
  ellipse(width/2, height/2, psn(550/ABS_H), psn(550/ABS_H)); pop();

  push(); stroke(200); strokeWeight(psn(1/ABS_H)); noFill();
  ellipse(pxn(1700/ABS_W), pyn(400/ABS_H), psn(500/ABS_H), psn(500/ABS_H)); pop();
}

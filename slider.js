//----------------------------------------------------------------------
// GLOBAL VARIABLES
//----------------------------------------------------------------------

// --- Responsive scaling helpers ---
const BASE_W = 2098;
const BASE_H = 1170;
function sx() { return width / BASE_W; }
function sy() { return height / BASE_H; }
function su() { return Math.min(sx(), sy()); }

function px(x) { return x * sx(); }
function py(y) { return y * sy(); }
function ps(v) { return v * su(); }

// Fit an image to a max dimension (keeps natural aspect ratio)
function drawImageFit(img, cx, cy, maxDimPx) {
  if (!img) return;
  const iw = img.width, ih = img.height;
  if (!iw || !ih) return;
  const scale = maxDimPx / Math.max(iw, ih);
  const w = iw * scale, h = ih * scale;
  imageMode(CENTER);
  image(img, cx, cy, w, h);
}

let lastW = BASE_W, lastH = BASE_H;

// Squares (small, medium)
let numSmall = 14;
let smallSize = 49; // this is now a "max dimension" not a fixed square
let smallBase = [];
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

let numMed = 3, medSize = 170, medBase = [], medNoiseX = [], medNoiseY = [], medPos = [], medVel = [], medAcc = [], medImgs = [];

// --- Add-ons (3 independent images with no connections) ---
const addCount = 3;
const addOnFiles = [
  "Add_ons/Add_on1.png",
  "Add_ons/Add_on2.png",
  "Add_ons/Add_on3.png"
];

let addBase = []; // p5.Vector after setup()
let addSizes = [80, 280, 220]; // each is a "max dimension"
let addImgs = [];
let addNoiseX = [], addNoiseY = [];
let addPos = [], addVel = [], addAcc = [];

// ---------------- Sliders / Toggles ----------------
let smallNoiseStep = 0.002;
let smallRadiusMax = 50;
let medNoiseStep   = 0.005;
let medRadiusMax   = 20;
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

// --- Purple hazard wedges ---------------------------------------------
const hazardAreas = [
  // HAZARD #1: triangle using SMALL 5, 6, 8 (0-based indices 4, 5, 7)
  {
    vertices: [
      { kind: 'small', i: 5 },
      { kind: 'small', i: 6 },
      { kind: 'small', i: 8 },
    ]
  },

  // HAZARD #2: triangle connecting SMALL 1, 2, and 13 (+ addon 2)
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
// preload(): load images
//----------------------------------------------------------------------
function preload() {
  // small
  for (let i = 1; i <= numSmall; i++) {
    const path = `Small/Small_${i}.png`;
    smallImgs[i - 1] = loadImage(path, null, () => console.error('Missing:', path));
  }
  // medium
  for (let i = 1; i <= numMed; i++) {
    const path = `Medium/Medium_${i}.png`;
    medImgs[i - 1] = loadImage(path, null, () => console.error('Missing:', path));
  }
  // add-ons
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
    canvas { display: block; } /* removes inline-canvas extra line-height gap */
  `;
  document.head.appendChild(style);
}


//----------------------------------------------------------------------
// setup()
//----------------------------------------------------------------------
function setup() {
    enableFullscreenCanvas();  
  createCanvas(windowWidth, windowHeight);
  lastW = width;
  lastH = height;
  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  gridColor = color(200, 200, 200, 150);

  // --- small setup
  smallBase = [
    createVector(650,300),createVector(300,800),createVector(850,320),createVector(1020,320),createVector(1200,200),
    createVector(1500,380),createVector(1670,400),createVector(1550,600),createVector(1770,680),createVector(1950,600),
    createVector(1250,870),createVector(1150,750),createVector(1000,755),createVector(800,900)
  ];
  for (let i = 0; i < numSmall; i++) {
    smallNoiseX[i] = random(10);
    smallNoiseY[i] = random(10);
    smallPos[i] = createVector(px(smallBase[i].x), py(smallBase[i].y));
    smallVel[i] = createVector(0,0);
    smallAcc[i] = createVector(0,0);
  }

  // --- medium setup
  medBase = [createVector(390,390),createVector(1360,200),createVector(1500,900)];
  for (let i = 0; i < numMed; i++) {
    medNoiseX[i] = random(10);
    medNoiseY[i] = random(10);
    medPos[i] = createVector(px(medBase[i].x), py(medBase[i].y));
    medVel[i] = createVector(0,0);
    medAcc[i] = createVector(0,0);
  }

  // --- add-ons setup (convert raw coords to vectors; init physics)
  addBase = [
    createVector(895, 350),
    createVector(510, 900),
    createVector(470, 360)
  ];
  for (let i = 0; i < addCount; i++) {
    const base = addBase[i];
    addNoiseX[i] = random(10);
    addNoiseY[i] = random(10);
    addPos[i] = createVector(px(base.x), py(base.y));
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
                                 .style('font','12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial');

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

// --- draw hatch-only interior + outline (NO FILL, no “sheet”) ---
function drawHazardLines(vertices) {
  // Resolve vertices to live positions
  let pts = vertices.map(resolveVertex).filter(Boolean);
  if (pts.length < 3) return;

  // Sort clockwise for a clean polygon
  pts = sortClockwise(pts);

  // Compute bounds for hatching
  let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }

  const ctx = drawingContext;

  // Build a polygon path once
  const poly = new Path2D();
  poly.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) poly.lineTo(pts[i].x, pts[i].y);
  poly.closePath();

  // ==== HATCH STROKES ONLY (inside polygon) ====
  ctx.save();
  ctx.globalAlpha = 1;                           // ensure no inherited alpha
  ctx.globalCompositeOperation = 'source-over';  // normal blend
  ctx.clip(poly);                                // clip to polygon

  ctx.lineWidth   = ps(1);
  ctx.setLineDash([]);                           // solid hatch
  ctx.strokeStyle = 'rgba(137, 90, 255, 0.4)';   // purple hatch line

  const step = ps(7), pad = ps(200);
  for (let x = minX - (maxY - minY) - pad; x < maxX + (maxY - minY) + pad; x += step) {
    ctx.beginPath();
    ctx.moveTo(x,           maxY + pad);
    ctx.lineTo(x + (maxY - minY) + pad, minY - pad);
    ctx.stroke();
  }
  ctx.restore(); // ← removes clip & any state changes

  // ==== PURPLE OUTLINE (stroke only) ====
  // ==== OUTLINE (match connection grey, not purple) ====
push();
noFill();
// Use the same grey as your solid connections (210). 
// If you prefer the slightly lighter 220 you use elsewhere, swap 210 → 220.
stroke(210);
strokeWeight(ps(1));           // match small↔small line weight
drawingContext.setLineDash([]); // solid outline (not dotted)
beginShape();
for (const p of pts) vertex(p.x, p.y);
endShape(CLOSE);
pop();

}


// draw all hazards
function drawHazardAreas() {
  for (const area of hazardAreas) drawHazardLines(area.vertices);
}

//----------------------------------------------------------------------
// draw()
//----------------------------------------------------------------------
function draw() {
  // ---- Read slider values & update labels ----
  smallNoiseStep     = sliderSmallNoiseStep.value(); spanSmallNoiseStep.html(nf(smallNoiseStep,1,4));
  smallRadiusMax     = sliderSmallRadiusMax.value(); spanSmallRadiusMax.html(smallRadiusMax);
  medNoiseStep       = sliderMedNoiseStep.value();   spanMedNoiseStep.html(nf(medNoiseStep,1,4));
  medRadiusMax       = sliderMedRadiusMax.value();   spanMedRadiusMax.html(medRadiusMax);
  springK            = sliderSpringK.value();        spanSpringK.html(nf(springK,1,3));
  damping            = sliderDamping.value();        spanDamping.html(nf(damping,1,3));
  impulseStrength    = sliderImpulse.value();        spanImpulse.html(nf(impulseStrength,1,2));
  impactRadiusFactor = sliderImpactRadius.value();   spanImpactRadius.html(impactRadiusFactor);

  // Convert base radii into responsive pixels
  const smallR = ps(smallRadiusMax);
  const medR   = ps(medRadiusMax);

  background(240);
  drawBackgroundCircles();

  // --- small (compute physics and draw small↔small lines)
  let smallDefault = [];
  for (let i=0;i<numSmall;i++){
    smallNoiseX[i]+=smallNoiseStep; smallNoiseY[i]+=smallNoiseStep;
    let dx=map(noise(smallNoiseX[i]),0,1,-smallR,smallR);
    let dy=map(noise(smallNoiseY[i]),0,1,-smallR,smallR);
    let bx=px(smallBase[i].x),by=py(smallBase[i].y);
    smallDefault[i]=createVector(bx+dx,by+dy);
  }
  let cursorSquareSize=ps(smallSize)*impactRadiusFactor;
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
  // draw small ↔ small connections first (behind everything)
  for(let i=0;i<connections.length;i++){
    let[a,b]=connections[i]; let A=smallPos[a],B=smallPos[b];
    if(dottedConnections.includes(i)){stroke(120);strokeWeight(ps(1.4));drawingContext.setLineDash([ps(1),ps(13)]);}
    else{stroke(210);strokeWeight(ps(1));drawingContext.setLineDash([]);}
    line(A.x,A.y,B.x,B.y);
  }
  drawingContext.setLineDash([]);

  // --- medium (compute physics)
  let medDefault=[];
  for(let i=0;i<numMed;i++){
    medNoiseX[i]+=medNoiseStep; medNoiseY[i]+=medNoiseStep;
    let dx=map(noise(medNoiseX[i]),0,1,-medR,medR);
    let dy=map(noise(medNoiseY[i]),0,1,-medR,medR);
    let bx=px(medBase[i].x),by=py(medBase[i].y);
    medDefault[i]=createVector(bx+dx,by+dy);
  }
  cursorSquareSize=ps(medSize)*impactRadiusFactor;
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

  // --- medium ↔ small connections next (still behind small squares)
  for (let i = 0; i < medSmallConnections.length; i++) {
    const [mi, si] = medSmallConnections[i];
    if (medPos[mi] && smallPos[si]) {
      if (i === 1) {
        stroke(120); // dotted color
        strokeWeight(ps(1.4));
        drawingContext.setLineDash([ps(1), ps(13)]);
      } else {
        stroke(220); // solid color
        strokeWeight(ps(1.8));
        drawingContext.setLineDash([]);
      }
      line(medPos[mi].x, medPos[mi].y, smallPos[si].x, smallPos[si].y);
    }
  }
  drawingContext.setLineDash([]);

  // --- add-on ↔ small solid connections
  for (let i = 0; i < addSmallConnections.length; i++) {
    const [ai, si] = addSmallConnections[i];
    if (addPos[ai] && smallPos[si]) {
      stroke(220);
      strokeWeight(ps(1.8));
      drawingContext.setLineDash([]);
      line(addPos[ai].x, addPos[ai].y, smallPos[si].x, smallPos[si].y);
    }
  }
  drawingContext.setLineDash([]);

  // wedges behind avatars but above lines
  drawHazardAreas();

  // --- draw the small squares on top (aspect preserved)
  noStroke();
  const smallSizePx = ps(smallSize);
  for(let i=0;i<numSmall;i++){
    const p=smallPos[i];
    drawImageFit(smallImgs[i], p.x, p.y, smallSizePx);
  }

  // --- draw the medium squares (aspect preserved)
  noStroke();
  const medSizePx   = ps(medSize);
  for(let i=0;i<numMed;i++){
    const q=medPos[i];
    drawImageFit(medImgs[i], q.x, q.y, medSizePx);
  }

  // --- add-ons (same physics as others, no connections)
  const addR = smallR; // reuse small radius range for motion
  for (let i = 0; i < addCount; i++) {
    addNoiseX[i] += smallNoiseStep;
    addNoiseY[i] += smallNoiseStep;
    const dx = map(noise(addNoiseX[i]), 0, 1, -addR, addR);
    const dy = map(noise(addNoiseY[i]), 0, 1, -addR, addR);
    const bx = px(addBase[i].x), by = py(addBase[i].y);
    const target = createVector(bx + dx, by + dy);

    addAcc[i].set(0, 0);
    const spring = p5.Vector.sub(target, addPos[i]).mult(springK);
    addAcc[i].add(spring);

    const cursorSquareSizeAdd = ps(addSizes[i]) * impactRadiusFactor;
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

  // Draw add-ons last (aspect preserved)
  noStroke(); 
  for (let i = 0; i < addCount; i++) {
    const r = addPos[i];
    const s = ps(addSizes[i]); // max dimension
    drawImageFit(addImgs[i], r.x, r.y, s);
  }

  // --- overlay text (brand grey gradient left→right)
  push();
  const ctx = drawingContext;                   // raw canvas context
  const fs = ps(200);                           // responsive font size
  const lh = fs * 0.9;                          // line height
  const cx = width / 2;
  const cy = height / 2;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fs}px Helvetica, Arial, sans-serif`;

  // --- gradient for large text ---
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, '#636472');   // dark grey on the left
  grad.addColorStop(1, '#C4C4CB');   // light grey on the right
  ctx.fillStyle = grad;

  // two lines centered
  ctx.fillText('Powering',     cx, cy - lh/2);
  ctx.fillText('Global Trade', cx, cy + lh/2);

  ctx.restore();
  pop();
}

//----------------------------------------------------------------------
// Background Circles
//----------------------------------------------------------------------
function drawBackgroundCircles(){
  push(); stroke(200); strokeWeight(ps(2)); noFill();
  drawingContext.setLineDash([ps(1),ps(10)]);
  ellipse(px(510),py(585),ps(1000),ps(1000));
  drawingContext.setLineDash([]); pop();

  push(); stroke(200); strokeWeight(ps(1)); noFill();
  ellipse(width/2,height/2,ps(550),ps(550)); pop();

  push(); stroke(200); strokeWeight(ps(1)); noFill();
  ellipse(px(1700),py(400),ps(500),ps(500)); pop();
}

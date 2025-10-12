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

// Squares (small, medium, large)
let numSmall = 14;
let smallSize = 49; // this is now a "max dimension" not a fixed square
let smallBase = [];
let smallNoiseX = [], smallNoiseY = [], smallPos = [], smallVel = [], smallAcc = [], smallImgs = [];
// (kept arrays smallMasked/medMasked from earlier version OUT to avoid confusion)

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
let numBig = 3, bigSize = 280, bigBase = [], bigNoiseX = [], bigNoiseY = [], bigPos = [], bigVel = [], bigAcc = [], bigVideos = [];

// --- Add-ons (3 independent images with no connections) ---
const addCount = 3;
const addOnFiles = [
  "Add_ons/Add_on1.png",
  "Add_ons/Add_on2.png",
  "Add_ons/Add_on3.png"
];
// RAW coords; converted to vectors in setup()

let addBase = []; // p5.Vector after setup()
let addSizes = [80, 280, 220]; // each is a "max dimension"
let addImgs = [];
let addNoiseX = [], addNoiseY = [];
let addPos = [], addVel = [], addAcc = [];

let gridColor;
let smallNoiseStep = 0.002, smallRadiusMax = 50;
let medNoiseStep = 0.005, medRadiusMax = 20;
let bigNoiseStep = 0.005, bigRadiusMax = 30;
let springK = 0.02, damping = 0.95;
let impulseStrength = 0.5, impactRadiusFactor = 20;

// --- Purple hazard wedges ---------------------------------------------
const hazardAreas = [
  // HAZARD #1: triangle using SMALL 5, 6, 8 (0-based indices 4, 5, 7)
  {
    vertices: [
      { kind: 'small', i: 4 },
      { kind: 'small', i: 5 },
      { kind: 'small', i: 7 },
    ]
  },

  // HAZARD #2: triangle connecting SMALL 1, 2, and 13
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
    const path = `Small/Small_${i}.jpg`;
    smallImgs[i - 1] = loadImage(path, null, () => console.error('Missing:', path));
  }
  // medium
  for (let i = 1; i <= numMed; i++) {
    const path = `Medium/Medium_${i}.jpg`;
    medImgs[i - 1] = loadImage(path, null, () => console.error('Missing:', path));
  }
  // add-ons
  for (let i = 0; i < addCount; i++) {
    const path = addOnFiles[i];
    addImgs[i] = loadImage(path, null, () => console.error('Missing:', path));
  }
}

//----------------------------------------------------------------------
// setup()
//----------------------------------------------------------------------

function setup() {
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

  // --- large setup
  bigBase = [createVector(450,450),createVector(1550,920),createVector(1300,250)];
  for (let i = 0; i < numBig; i++) {
    bigNoiseX[i] = random(10); bigNoiseY[i] = random(10);
    bigPos[i] = createVector(px(bigBase[i].x), py(bigBase[i].y));
    bigVel[i] = createVector(0,0); bigAcc[i] = createVector(0,0);
    let path = `Videos/Large_video${i+1}.mp4`;
    ((idx) => {
      let vid = createVideo(path, () => { vid.volume(0); vid.loop(); vid.hide(); bigVideos[idx] = vid; });
      vid.size(bigSize,bigSize);
    })(i);
  }

  addBase = [
    createVector(895, 350),
    createVector(510, 900),
    createVector(470, 360)
  ];

  // --- add-ons setup (convert raw coords to vectors; init physics)
  for (let i = 0; i < addCount; i++) {
  const base = addBase[i]; // now using your createVector list
  addNoiseX[i] = random(10);
  addNoiseY[i] = random(10);
  addPos[i] = createVector(px(base.x), py(base.y));
  addVel[i] = createVector(0,0);
  addAcc[i] = createVector(0,0);
}
}

//----------------------------------------------------------------------
// Responsive resize
//----------------------------------------------------------------------

function windowResized() {
  const scaleX = windowWidth / lastW, scaleY = windowHeight / lastH;
  resizeCanvas(windowWidth, windowHeight);
  for (let i = 0; i < numSmall; i++) { smallPos[i].x*=scaleX; smallPos[i].y*=scaleY; }
  for (let i = 0; i < numMed; i++)   { medPos[i].x*=scaleX;   medPos[i].y*=scaleY; }
  for (let i = 0; i < numBig; i++)   { bigPos[i].x*=scaleX;   bigPos[i].y*=scaleY; }
  for (let i = 0; i < addCount; i++) { addPos[i].x*=scaleX;   addPos[i].y*=scaleY; }
  lastW = width; lastH = height;
}

function getNodePos(node) {
  if (node.kind === 'small') return smallPos[node.i];
  if (node.kind === 'med')   return medPos[node.i];
  if (node.kind === 'addon') return addPos[node.i];
  return null;
}

// Robust segment intersection using cross products.
// Returns p = A + t*(B-A) if the segments intersect, else null.
function segIntersection(A, B, C, D) {
  const r = createVector(B.x - A.x, B.y - A.y);
  const s = createVector(D.x - C.x, D.y - C.y);
  const cross = (u, v) => u.x * v.y - u.y * v.x;

  const rxs = cross(r, s);
  const q_p = createVector(C.x - A.x, C.y - A.y);
  const qpxr = cross(q_p, r);

  // Parallel or collinear → treat as "no single intersection"
  if (Math.abs(rxs) < 1e-8) return null;

  const t = cross(q_p, s) / rxs;
  const u = qpxr / rxs;

  if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;

  return createVector(A.x + t * r.x, A.y + t * r.y);
}


function resolveVertex(v) {
  if (v.kind === 'mid') {
    const p1 = getNodePos(v.a), p2 = getNodePos(v.b);
    return createVector((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
  }
  if (v.kind === 'x') { // intersection of two connections (use infinite lines)
    const p1 = getNodePos(v.a1), p2 = getNodePos(v.a2);
    const p3 = getNodePos(v.b1), p4 = getNodePos(v.b2);
    if (!p1 || !p2 || !p3 || !p4) return null;
    return lineIntersection(p1, p2, p3, p4);  // ⟵ swapped to infinite-line intersection
  }  
  return getNodePos(v); // 'small' | 'med' | 'addon'
}

function sortClockwise(points) {
  const cx = points.reduce((s,p)=>s+p.x,0)/points.length;
  const cy = points.reduce((s,p)=>s+p.y,0)/points.length;
  return points
    .map(p => ({p, a: Math.atan2(p.y - cy, p.x - cx)}))
    .sort((u,v) => u.a - v.a)
    .map(o => o.p);
}


// Infinite-line intersection of AB and CD (ignores segment endpoints)
function lineIntersection(A, B, C, D) {
  const x1=A.x, y1=A.y, x2=B.x, y2=B.y;
  const x3=C.x, y3=C.y, x4=D.x, y4=D.y;
  const den = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4);
  if (Math.abs(den) < 1e-8) return null; // parallel/collinear
  const px = ((x1*y2 - y1*x2)*(x3 - x4) - (x1 - x2)*(x3*y4 - y3*x4)) / den;
  const py = ((x1*y2 - y1*x2)*(y3 - y4) - (y1 - y2)*(x3*y4 - y3*x4)) / den;
  return createVector(px, py);
}

// Sort points clockwise around their centroid
function sortClockwise(points) {
  const cx = points.reduce((s,p)=>s+p.x,0) / points.length;
  const cy = points.reduce((s,p)=>s+p.y,0) / points.length;
  return points
    .map(p => ({p, a: Math.atan2(p.y - cy, p.x - cx)}))
    .sort((u,v) => u.a - v.a)
    .map(o => o.p);
}

// Draw one purple hatched polygon (clockwise-ordered vertices)
function drawHazard(vertices) {
  let pts = vertices.map(resolveVertex).filter(Boolean);
  if (pts.length < 3) return;

  // Ensure a simple (non self-crossing) polygon
  pts = sortClockwise(pts);

  // Bounds for hatching
  let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }

  const ctx = drawingContext;
  ctx.save();

  // Build path
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
  ctx.closePath();

  // Fill + hatch
  ctx.fillStyle = 'rgba(137, 90, 255, 0.12)';
  ctx.fill();

  ctx.clip();
  ctx.lineWidth = ps(1);
  ctx.strokeStyle = 'rgba(137, 90, 255, 0.35)';
  const step = ps(10), pad = ps(200);
  for (let x = minX - (maxY - minY) - pad; x < maxX + (maxY - minY) + pad; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, maxY + pad);
    ctx.lineTo(x + (maxY - minY) + pad, minY - pad);
    ctx.stroke();
  }
  ctx.restore();
}



// draw all hazards
function drawHazardAreas() {
  for (const area of hazardAreas) drawHazard(area.vertices);
}



//----------------------------------------------------------------------
// draw()
//----------------------------------------------------------------------

function draw() {
  const smallSizePx = ps(smallSize);  // max dimension for small images
  const medSizePx   = ps(medSize);    // max dimension for medium images
  const bigSizePx   = ps(bigSize);    // (big still unused if videos off)
  const smallR = ps(smallRadiusMax), medR = ps(medRadiusMax), bigR = ps(bigRadiusMax);
  const impulsePx = impulseStrength * su();

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
  let cursorSquareSize=smallSizePx*impactRadiusFactor;
  for(let i=0;i<numSmall;i++){
    smallAcc[i].set(0,0);
    let spring=p5.Vector.sub(smallDefault[i],smallPos[i]).mult(springK);
    smallAcc[i].add(spring);
    let p=smallPos[i];
    if(abs(mouseX-p.x)<cursorSquareSize/2&&abs(mouseY-p.y)<cursorSquareSize/2){
      let away=p5.Vector.sub(p,createVector(mouseX,mouseY));
      away.normalize().mult(impulsePx); smallAcc[i].add(away);
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
  cursorSquareSize=medSizePx*impactRadiusFactor;
  for(let i=0;i<numMed;i++){
    medAcc[i].set(0,0);
    let spring=p5.Vector.sub(medDefault[i],medPos[i]).mult(springK); medAcc[i].add(spring);
    let p=medPos[i];
    if(abs(mouseX-p.x)<cursorSquareSize/2&&abs(mouseY-p.y)<cursorSquareSize/2){
      let away=p5.Vector.sub(p,createVector(mouseX,mouseY));
      away.normalize().mult(impulsePx); medAcc[i].add(away);
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
    stroke(220);                // same color as solid med-small lines
    strokeWeight(ps(1.8));      // same thickness
    drawingContext.setLineDash([]); // solid line
    line(addPos[ai].x, addPos[ai].y, smallPos[si].x, smallPos[si].y);
  }
}

drawingContext.setLineDash([]);

// <<< Add this line so wedges sit behind avatars but above lines
drawHazardAreas();

  // --- now draw the small squares on top (aspect preserved)
  noStroke();
  for(let i=0;i<numSmall;i++){
    const p=smallPos[i];
    drawImageFit(smallImgs[i], p.x, p.y, smallSizePx);
  }

  // --- draw the medium squares (aspect preserved)
  noStroke();
  for(let i=0;i<numMed;i++){
    const q=medPos[i];
    drawImageFit(medImgs[i], q.x, q.y, medSizePx);
  }

  // --- add-ons (same physics as others, no connections)
  const addR = ps(smallRadiusMax); // reuse small radius range for motion
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
      away.normalize().mult(impulsePx);
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

// --- overlay text (Powering Global Trade with left→right 130→220 ombre)
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

// left→right gradient across the whole canvas (exactly 130 → 220)
const grad = ctx.createLinearGradient(0, 0, width, 0);
grad.addColorStop(0, 'rgb(99, 98, 98)');   // dark left
grad.addColorStop(1, 'rgb(194, 194, 194)');   // light right
ctx.fillStyle = grad;

// optional: soften like the mock (uncomment if you want)
// ctx.globalAlpha = 0.9;

// two lines centered
ctx.fillText('Powering',    cx, cy - lh/2);
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

//----------------------------------------------------------------------
// GLOBAL VARIABLES
//----------------------------------------------------------------------

// Small squares (23 of them):
let numSmall = 23;
let smallSize = 49;            // display size of each small square
let smallBase = [];            // fixed “base” positions
let smallNoiseX = [];
let smallNoiseY = [];
let smallNoiseStep = 0.002;    // how fast their noise offsets advance
let smallRadiusMax = 50;       // max displacement from base

// Hold the loaded images and their masked versions:
let smallImgs = [];
let smallMasked = [];

const springK = 0.02;         // spring strength pulling toward default
const damping = 0.9;          // velocity damping (0 < damping < 1)
const impulseStrength = 0.5;  // how strong the mouse impulse is
const impactRadiusFactor = 8; // multiplier for detection range

// Connections between small squares (exactly as before):
let connections = [
  [0, 1],
  [0, 2],
  [1, 6],
  [6, 3],
  [1, 2],
  [3, 4],
  [1, 5],
  [1, 7],
  [8, 7],
  [8, 9],
  [6, 9],
  [7, 10],
  [8, 10],
  [11, 10],
  [11, 6],
  [10, 12],
  [14, 12],
  [14, 9],
  [14, 10],
  [15, 10],
  [15, 14],
  [11, 3],
  [9, 16],
  [17, 9],
  [17, 19],
  [17, 16],
  [18, 19],
  [19, 20],
  [20, 21],
  [20, 22],
  [21, 5],
  [21, 4],
  [20, 4],
  [19, 5],
  [17, 5],

  // dotted connections (indices 35–46):
  [17, 7],
  [18, 20],
  [21, 22],
  [12, 16],
  [12, 9],
  [5, 9],
  [4, 9],
  [19, 9],
  [11, 16],
  [2, 6],
  [2, 13],
  [13, 7]
];
let dottedConnections = [35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46];

// Medium squares (4 of them):
let numMed = 4;
let medSize = 105;             // display size of each medium square
let medBase = [];
let medNoiseX = [];
let medNoiseY = [];
let medNoiseStep = 0.005;
let medRadiusMax = 20;

let medImgs = [];
let medMasked = [];

// Large squares (3 of them):
let numBig = 3;
let bigSize = 280;             // display size of each large square
let bigBase = [];
let bigNoiseX = [];
let bigNoiseY = [];
let bigNoiseStep = 0.005;
let bigRadiusMax = 30;

let bigImgs = [];
let bigMasked = [];

let gridSpacing = 100;
let gridColor;

//----------------------------------------------------------------------
// preload(): load all images into smallImgs[], medImgs[], bigImgs[]
//----------------------------------------------------------------------

function preload() {
  // 1) Load small images: "Small/Small_1.jpg" → smallImgs[0], … up to Small_23.jpg
  for (let i = 1; i <= numSmall; i++) {
    smallImgs[i - 1] = loadImage(`Small/Small_${i}.jpg`);
  }
  // 2) Load medium images: "Medium/Medium_1.jpg" → medImgs[0] … Medium_4.jpg
  for (let i = 1; i <= numMed; i++) {
    medImgs[i - 1] = loadImage(`Medium/Medium_${i}.jpg`);
  }
  // 3) Load large images: "Large/Large_1.jpg" → bigImgs[0] … Large_3.jpg
  for (let i = 1; i <= numBig; i++) {
    bigImgs[i - 1] = loadImage(`Large/Large_${i}.jpg`);
  }
}

//----------------------------------------------------------------------
// setup(): initialize positions, noise offsets, and mask images
//----------------------------------------------------------------------

function setup() {
  createCanvas(2098, 1170);
  rectMode(CENTER);
  textAlign(CENTER, CENTER);

  // Light gray for grid lines (if you re‐enable drawGrid)
  gridColor = color(200, 200, 200, 150);

  // --- SMALL squares setup ---
  smallBase = [
    createVector(300,  800),  createVector(800, 300),  createVector(650, 625),
    createVector(1320, 850),  createVector(1550, 500), createVector(1790, 670),
    createVector(1180, 720),  createVector(1050, 425), createVector(1150, 500),
    createVector(1250, 550),  createVector(980, 770),  createVector(1050, 930),
    createVector(850, 600),   createVector(835, 470),  createVector(600, 740),
    createVector(800, 850),   createVector(1320, 720), createVector(1490, 300),
    createVector(1600, 220),  createVector(1650, 350), createVector(1800, 400),
    createVector(1790, 500),  createVector(1900, 600), createVector(1490, 300)
  ];
  for (let i = 0; i < numSmall; i++) {
    smallNoiseX[i] = random(10);
    smallNoiseY[i] = random(10);
  }
  // Create a rounded‐corner mask for each small image:
  for (let i = 0; i < numSmall; i++) {
    let img = smallImgs[i];
    img.resize(smallSize, smallSize);
    let maskG = createGraphics(smallSize, smallSize);
    maskG.noStroke();
    maskG.fill(255);
    maskG.rect(0, 0, smallSize, smallSize, 10);
    img.mask(maskG);
    smallMasked[i] = img;
  }

  // --- MEDIUM squares setup ---
  medBase = [
    createVector(1030, 300),
    createVector(790, 700),
    createVector(1600, 650),
    createVector(220, 1000)
  ];
  for (let i = 0; i < numMed; i++) {
    medNoiseX[i] = random(10);
    medNoiseY[i] = random(10);
  }
  // Create a rounded‐corner mask for each medium image:
  for (let i = 0; i < numMed; i++) {
    let img = medImgs[i];
    img.resize(medSize, medSize);
    let maskG = createGraphics(medSize, medSize);
    maskG.noStroke();
    maskG.fill(255);
    maskG.rect(0, 0, medSize, medSize, 20);
    img.mask(maskG);
    medMasked[i] = img;
  }

  // --- LARGE squares setup ---
  bigBase = [
    createVector(450, 450),
    createVector(1550, 920),
    createVector(1300, 250)
  ];
  for (let i = 0; i < numBig; i++) {
    bigNoiseX[i] = random(10);
    bigNoiseY[i] = random(10);
  }
  // Create a rounded‐corner mask for each large image:
  for (let i = 0; i < numBig; i++) {
    let img = bigImgs[i];
    img.resize(bigSize, bigSize);
    let maskG = createGraphics(bigSize, bigSize);
    maskG.noStroke();
    maskG.fill(255);
    maskG.rect(0, 0, bigSize, bigSize, 40);
    img.mask(maskG);
    bigMasked[i] = img;
  }
}

//----------------------------------------------------------------------
// draw(): update Perlin‐noise motion, draw everything
//----------------------------------------------------------------------

function draw() {
  // 1) Clear & draw background circles
  background(240);
  drawBackgroundCircles();

  // 2) Compute small squares’ noise‐based positions
  let smallCurrent = [];
  for (let i = 0; i < numSmall; i++) {
    smallNoiseX[i] += smallNoiseStep;
    smallNoiseY[i] += smallNoiseStep;
    let dx = map(noise(smallNoiseX[i]), 0, 1, -smallRadiusMax, smallRadiusMax);
    let dy = map(noise(smallNoiseY[i]), 0, 1, -smallRadiusMax, smallRadiusMax);
    let bx = smallBase[i].x;
    let by = smallBase[i].y;
    smallCurrent[i] = createVector(bx + dx, by + dy);
  }

  // 3) Draw connections between small squares
  for (let i = 0; i < connections.length; i++) {
    let [aIdx, bIdx] = connections[i];
    let aPos = smallCurrent[aIdx], bPos = smallCurrent[bIdx];
    if (dottedConnections.includes(i)) {
      stroke(50);
      strokeWeight(1.4);
      drawingContext.setLineDash([1, 13]);
    } else {
      stroke(90);
      strokeWeight(2);
      drawingContext.setLineDash([]);
    }
    line(aPos.x, aPos.y, bPos.x, bPos.y);
  }
  drawingContext.setLineDash([]); // reset dash

  // 4) Draw small squares’ masked images
  noStroke();
  for (let i = 0; i < numSmall; i++) {
    let p = smallCurrent[i];
    imageMode(CENTER);
    image(smallMasked[i], p.x, p.y, smallSize, smallSize);
  }

  // 5) Compute medium squares’ noise‐based positions
  let medCurrent = [];
  for (let i = 0; i < numMed; i++) {
    medNoiseX[i] += medNoiseStep;
    medNoiseY[i] += medNoiseStep;
    let dx = map(noise(medNoiseX[i]), 0, 1, -medRadiusMax, medRadiusMax);
    let dy = map(noise(medNoiseY[i]), 0, 1, -medRadiusMax, medRadiusMax);
    let bx = medBase[i].x;
    let by = medBase[i].y;
    medCurrent[i] = createVector(bx + dx, by + dy);
  }

  // 6) Draw medium squares’ masked images
  noStroke();
  for (let i = 0; i < numMed; i++) {
    let q = medCurrent[i];
    imageMode(CENTER);
    image(medMasked[i], q.x, q.y, medSize, medSize);
  }

  // 7) Compute large squares’ noise‐based positions
  let bigCurrent = [];
  for (let i = 0; i < numBig; i++) {
    bigNoiseX[i] += bigNoiseStep;
    bigNoiseY[i] += bigNoiseStep;
    let dx = map(noise(bigNoiseX[i]), 0, 1, -bigRadiusMax, bigRadiusMax);
    let dy = map(noise(bigNoiseY[i]), 0, 1, -bigRadiusMax, bigRadiusMax);
    let bx = bigBase[i].x;
    let by = bigBase[i].y;
    bigCurrent[i] = createVector(bx + dx, by + dy);
  }

  // 8) Draw large squares’ masked images on top
  noStroke();
  for (let i = 0; i < numBig; i++) {
    let r = bigCurrent[i];
    imageMode(CENTER);
    image(bigMasked[i], r.x, r.y, bigSize, bigSize);
  }
}

//----------------------------------------------------------------------
// drawBackgroundCircles(): unchanged from before
//----------------------------------------------------------------------

function drawBackgroundCircles() {
  // Circle #1: large dotted
  push();
  stroke(50);
  strokeWeight(2);
  noFill();
  drawingContext.setLineDash([1, 10]);
  ellipse(510, 585, 1000, 1000);
  drawingContext.setLineDash([]);
  pop();

  // Circle #2: medium solid (centered)
  push();
  stroke(50);
  strokeWeight(3);
  noFill();
  ellipse(width / 2, height / 2, 550, 550);
  pop();

  // Circle #3: smaller solid (right side)
  push();
  stroke(1);
  strokeWeight(1);
  noFill();
  ellipse(1700, 400, 500, 500);
  pop();
}

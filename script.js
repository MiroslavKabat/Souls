var w = c.width = window.innerWidth;
var h = c.height = window.innerHeight;

var sizeRatio = 1;

const ctx = c.getContext('2d');
const infoPanel = document.getElementById('infoPanel');
const settingsPanel = document.getElementById("settingsPanel");

const sparkCheckbox = document.getElementById('sparkCheckbox');
const blurCheckbox = document.getElementById('blurCheckbox');
const vectorsCheckbox = document.getElementById('vectorsCheckbox');
const visionRangeCheckbox = document.getElementById('visionRangeCheckbox')
const visualConnectionCheckbox = document.getElementById('visualConnectionCheckbox')

const separationCheckbox = document.getElementById('separationCheckbox');
const alignmentCheckbox = document.getElementById('alignmentCheckbox');
const cohesionCheckbox = document.getElementById('cohesionCheckbox');
const collisionCheckbox = document.getElementById('collisionCheckbox');
const dyingCheckbox = document.getElementById('dyingCheckbox');

const countInput = document.getElementById("targetSoulsInput");

const fullCircle = 2.0 * Math.PI;
const halfCircle = 1.0 * Math.PI;
const quarterCircle = 0.5 * Math.PI;

InitLinq();

var opts = {
  defaultLen: 30,
  len: 30,
  count: 250,
  baseTime: 30,
  addedTime: 10,
  typicalAge: 500,
  dieChance: .025,
  spawnChance: 1,
  sparkChance: .1,
  sparkDist: 10,
  sparkSize: 2,
  soulSize: 3,
  defaultVisionRange: 100,
  visionRange: 100,

  turnRadius: quarterCircle,

  color: 'hsl(hue,100%,light%)',
  baseLight: 50,
  addedLight: 10, // [50-10,50+10]
  shadowToTimePropMult: 6,
  baseLightInputMultiplier: .01,
  addedLightInputMultiplier: .02,

  cx: w / 2,
  cy: h / 2,
  repaintAlpha: .06,
  hueChange: .1
}

// init values
countInput.value = opts.count;

var turnOnBlur = false;
var turnOnSpark = true;
var turnOnVectors = false;
var turnOnVisionRange = false;
var turnOnVisualConnection = false;
var turnOnDying = false;
var turnOnPanel = true;
blurCheckbox.checked = turnOnBlur;
sparkCheckbox.checked = turnOnSpark;
vectorsCheckbox.checked = turnOnVectors;
visionRangeCheckbox.checked = turnOnVisionRange;
visualConnectionCheckbox.checked = turnOnVisualConnection;
dyingCheckbox.checked = turnOnDying;

var separation = true;
var alignment = true;
var cohesion = true;
var collision = true;
separationCheckbox.checked = separation;
alignmentCheckbox.checked = alignment;
cohesionCheckbox.checked = cohesion;
collisionCheckbox.checked = collision;

var tick = 0;
var souls = [];
var dieX = w / 2 / opts.len;
var dieY = h / 2 / opts.len;

var fpss = [];
var fps = 0;
var lastLoopTime = 0;

// init gameboard
ctx.fillStyle = 'black';
ctx.fillRect(0, 0, w, h);

function fitSizeRatio() {
  let smaller = w > h ? h : w;
  sizeRatio = smaller / (1440);

  opts.len = sizeRatio * opts.defaultLen;
  opts.visionRange = sizeRatio * opts.defaultVisionRange;

  dieX = w / 2 / opts.len;
  dieY = h / 2 / opts.len;
}

function loop() {
  window.requestAnimationFrame(loop);

  fitSizeRatio();
  
  tick++;

  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(0,0,0,alp)'.replace('alp', opts.repaintAlpha);
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';

  // create new souls
  if (souls.length < opts.count && Math.random() < opts.spawnChance)
    souls.push(new Soul());

  // calc steps
  souls.map(function (soul) { soul.step(); });

  // calc stats
  let idx = tick % 100;
  fpss[idx] = (1000 / (performance.now() - lastLoopTime));
  fps = fpss.reduce((a, b) => a + b) / fpss.length;
  lastLoopTime = performance.now();
  
  // show stats
  var infoPanelRows = "";
  infoPanelRows += `<p>souls: ${souls.length}</p>`;
  infoPanelRows += `<p>fps: ${fps.toFixed(3)}</p>`;
  infoPanelRows += `<p>average age: ${(souls.Sum(x => x.age) / souls.length).toFixed(1)}</p>`;
  infoPanelRows += `<p>max age: ${souls.MaxBy(x => x.age).age}</p>`;
  infoPanel.innerHTML = infoPanelRows;
}

class Soul {
  constructor() {
    this.age = 0;
    this.x = (Math.random() - 0.5) * 0.8 * w / opts.len;
    this.y = (Math.random() - 0.5) * 0.8 * h / opts.len;
    this.addedX = 0;
    this.addedY = 0;
    this.absoluteX = opts.cx + this.x * opts.len;
    this.absoluteY = opts.cy + this.y * opts.len;

    this.rad = Math.random() * fullCircle;
    this.lightInputMultiplier = opts.baseLightInputMultiplier + opts.addedLightInputMultiplier * Math.random();

    this.color = opts.color.replace('hue', tick * opts.hueChange);
    this.cumulativeTime = 0;

    this.beginPhase();
  }

  die() {
    souls.Remove(this);
  }

  step() {
    this.time++;
    this.cumulativeTime++;

    if (this.time >= this.targetTime)
      this.beginPhase();

    this.prop = this.time / this.targetTime;
    let wave = Math.sin(this.prop * quarterCircle);
    let x = this.addedX * wave;
    let y = this.addedY * wave;

    this.absoluteX = opts.cx + (this.x + x) * opts.len;
    this.absoluteY = opts.cy + (this.y + y) * opts.len;

    this.visualizeStep(x, y)
  }

  beginPhase() {
    this.x += this.addedX;
    this.y += this.addedY;

    this.time = 0;
    this.targetTime = (opts.baseTime + opts.addedTime * Math.random()) | 0;

    // set closest souls
    this.closest = souls.Where(s => Math.hypot(s.absoluteX - this.absoluteX, s.absoluteY - this.absoluteY) < opts.visionRange);
    this.closest.Remove(this);

    let ran = Math.random();
    let finalXdir = Math.cos(this.rad + (ran - 0.5) * opts.turnRadius);
    let finalYdir = Math.sin(this.rad + (ran - 0.5) * opts.turnRadius);

    if (this.closest.length > 0 && (separation || alignment || cohesion)) {
      if (separation) {
        // separation direction
        let crowdXdir = this.closest.Sum(s => 1 / Math.hypot(s.absoluteX - this.absoluteX, s.absoluteY - this.absoluteY) * (s.absoluteX - this.absoluteX));
        let crowdYdir = this.closest.Sum(s => 1 / Math.hypot(s.absoluteX - this.absoluteX, s.absoluteY - this.absoluteY) * (s.absoluteY - this.absoluteY));
        let crowdDist = Math.hypot(crowdXdir, crowdYdir);
        // norm
        crowdXdir /= crowdDist;
        crowdYdir /= crowdDist;

        let multiplier = (this.closest.length / 50);
        multiplier = multiplier < 1 ? 1 : multiplier;

        this.separationXdir = multiplier * -1 * crowdXdir;
        this.separationYdir = multiplier * -1 * crowdYdir;
        let separationRad = Math.atan2(this.separationYdir, this.separationXdir);

        finalXdir += 1.2 * this.separationXdir;
        finalYdir += 1.2 * this.separationYdir;

        this.visualizeVector(this.separationXdir, this.separationYdir);
      }

      if (alignment) {
        // crowd direction (normalized)
        let crowdXdir = this.closest.Sum(s => Math.cos(s.rad));
        let crowdYdir = this.closest.Sum(s => Math.sin(s.rad));
        let crowdDist = Math.hypot(crowdXdir, crowdYdir);
        // norm
        crowdXdir /= crowdDist;
        crowdYdir /= crowdDist;

        this.alignmentXdir = crowdXdir;
        this.alignmentYdir = crowdYdir;
        let alignmentRad = Math.atan2(this.alignmentYdir, this.alignmentXdir);

        finalXdir += this.alignmentXdir;
        finalYdir += this.alignmentYdir;

        this.visualizeVector(this.alignmentXdir, this.alignmentYdir);
      }

      if (cohesion) {
        // cohesion direction
        // crowd center
        let crowdX = this.closest.Sum(s => s.absoluteX) / this.closest.length;
        let crowdY = this.closest.Sum(s => s.absoluteY) / this.closest.length;

        let crowdXdir = crowdX - this.absoluteX;
        let crowdYdir = crowdY - this.absoluteY;
        let crowdDist = Math.hypot(crowdXdir, crowdYdir);

        // norm
        crowdXdir /= crowdDist;
        crowdYdir /= crowdDist;

        this.cohesionXdir = crowdDist / opts.visionRange * 4 * crowdXdir;
        this.cohesionYdir = crowdDist / opts.visionRange * 4 * crowdYdir;
        let cohesionRad = Math.atan2(this.cohesionYdir, this.cohesionXdir);

        finalXdir += this.cohesionXdir;
        finalYdir += this.cohesionYdir;

        this.visualizeVector(this.cohesionXdir, this.cohesionYdir);
      }
    }

    if (collision) {
      let ratio = 0.2;
      let dangerousDistance = Math.min(w * ratio, h * ratio);

      // positive means you are close to border!
      let pX = Math.max((this.absoluteX - (w - dangerousDistance))/dangerousDistance, 0);
      let nX = Math.max(-(this.absoluteX - dangerousDistance)/dangerousDistance, 0);
      let pY = Math.max((this.absoluteY - (h - dangerousDistance))/dangerousDistance, 0);
      let nY = Math.max(-(this.absoluteY - dangerousDistance)/dangerousDistance, 0);

      let vecX = nX - pX;
      let vecY = nY - pY;

      let vecDist = Math.hypot(vecX, vecY);
      
      if (vecDist != 0) {
        // norm
        vecX /= vecDist;
        vecY /= vecDist;

        this.collisionXdir = 1.2 * vecX;
        this.collisionYdir = 1.2 * vecY;

        finalXdir += this.collisionXdir;
        finalYdir += this.collisionYdir;

        this.visualizeVector(this.collisionXdir, this.collisionYdir);
      }
    }

    // set direction
    let finalRad = Math.atan2(finalYdir, finalXdir);

    // let dot = finalXdir * Math.cos(this.rad) + finalYdir * Math.sin(this.rad);
    // let turnRad = Math.acos(dot / (Math.hypot(finalXdir, finalYdir) * 1));

    // if (turnRad > opts.turnRadius) {
    //   turnRad = opts.turnRadius;
    // }

    // if ((finalRad - this.rad) < 0) {
    //   turnRad *= -1;
    // }

    let turnRad = finalRad - this.rad;
    turnRad += (turnRad > halfCircle) ? -fullCircle : (turnRad < -halfCircle) ? fullCircle : 0

    var finalDeg = finalRad / fullCircle * 360;
    var turnDeg = turnRad / fullCircle * 360;
    var deg = this.rad / fullCircle * 360;

    this.rad += Math.random() * turnRad;
    this.rad %= fullCircle;

    this.addedX = Math.cos(this.rad);
    this.addedY = Math.sin(this.rad);

    if (turnOnDying) {
      if (Math.random() < opts.dieChance * this.age / opts.typicalAge) {
        this.die();
      }
    }

    // die outside of gameboard border
    if (this.x > dieX || this.x < -dieX || this.y > dieY || this.y < -dieY) {
      this.die();
    }

    this.visualizeBeginPhase();
    this.age++;
  }

  visualizeStep(x, y) {
    if (turnOnBlur) {
      ctx.shadowBlur = this.prop * opts.shadowToTimePropMult;
    }

    // show body
    ctx.fillStyle = ctx.shadowColor = this.color.replace('light', opts.baseLight + opts.addedLight * Math.sin(this.cumulativeTime * this.lightInputMultiplier));
    ctx.fillRect(this.absoluteX, this.absoluteY, opts.soulSize, opts.soulSize);

    if (turnOnSpark) {
      if (Math.random() < opts.sparkChance)
        ctx.fillRect(opts.cx + (this.x + x) * opts.len + Math.random() * opts.sparkDist * (Math.random() < .5 ? 1 : -1) - opts.sparkSize / 2, opts.cy + (this.y + y) * opts.len + Math.random() * opts.sparkDist * (Math.random() < .5 ? 1 : -1) - opts.sparkSize / 2, opts.sparkSize, opts.sparkSize)
    }
  }

  visualizeBeginPhase() {
    if (turnOnVisionRange) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.color.replace('light', 50);
      ctx.beginPath();
      ctx.arc(this.absoluteX, this.absoluteY, opts.visionRange, 0, fullCircle);
      ctx.stroke();
    }

    if (turnOnVisualConnection) {
      this.closest.ForEach(s => {
        ctx.lineWidth = 1;
        ctx.strokeStyle = this.color.replace('light', 50);
        ctx.beginPath();
        ctx.moveTo(this.absoluteX, this.absoluteY);
        ctx.lineTo(s.absoluteX, s.absoluteY);
        ctx.stroke();
      });
    }
  }

  visualizeVector(vx, vy) {
    if (!turnOnVectors)
      return;

    ctx.lineWidth = 1;
    ctx.strokeStyle = this.color.replace('light', 50);
    ctx.beginPath();
    ctx.moveTo(this.absoluteX, this.absoluteY);
    ctx.lineTo(this.absoluteX + opts.len * vx, this.absoluteY + opts.len * vy);
    ctx.stroke();
  }
}

function setBluring() {
  turnOnBlur = !turnOnBlur;
  blurCheckbox.checked = turnOnBlur;
  console.log(`blur => ${turnOnBlur}`);
}

function setSparking() {
  turnOnSpark = !turnOnSpark;
  sparkCheckbox.checked = turnOnSpark;
  console.log(`spark => ${turnOnSpark}`);
}

function setVectors() {
  turnOnVectors = !turnOnVectors;
  vectorsCheckbox.checked = turnOnVectors;
  console.log(`vectors => ${turnOnVectors}`);
}

function setShowVisionRange() {
  turnOnVisionRange = !turnOnVisionRange;
  visionRangeCheckbox.checked = turnOnVisionRange;
  console.log(`vision range => ${turnOnVisionRange}`);
}

function setVisualConnection() {
  turnOnVisualConnection = !turnOnVisualConnection;
  visualConnectionCheckbox.checked = turnOnVisualConnection;
  console.log(`visual connection => ${turnOnVisualConnection}`);
}

function setDying() {
  turnOnDying = !turnOnDying;
  dyingCheckbox.checked = turnOnDying;
  console.log(`dying => ${turnOnDying}`);
}

function setTargetSouls() {
  opts.count = parseInt(countInput.value);
  console.log(`target souls => ${opts.count}`);
}

function setSeparation() {
  separation = !separation;
  separationCheckbox.checked = separation;
  console.log(`separation => ${separation}`);
}

function setAlignment() {
  alignment = !alignment;
  alignmentCheckbox.checked = alignment;
  console.log(`alignment => ${alignment}`);
}

function setCohesion() {
  cohesion = !cohesion;
  cohesionCheckbox.checked = cohesion;
  console.log(`cohesion => ${cohesion}`);
}

function setAvoidCollision() {
  collision = !collision;
  collisionCheckbox.checked = collision;
  console.log(`colisions => ${collision}`);
}

function onClickCanvas() {
  showPanel();
}

function showPanel() {
  turnOnPanel = !turnOnPanel;
  if (turnOnPanel) {
    settingsPanel.style.display = "";
    infoPanel.style.display = "";
  }
  else {
    settingsPanel.style.display = "none";
    infoPanel.style.display = "none";
  }
}

function InitLinq() {
  Array.prototype.Remove = function (obj) {
    let idx = this.indexOf(obj);
    if (idx >= 0) {
      this.splice(idx, 1);
    }
    return this;
  }

  Array.prototype.ForEach = function (lambda) {
    for (let item of this) {
      lambda(item);
    }
  }

  Array.prototype.Any = function (lambda = x => true) {
    for (let item of this) {
      if (lambda(item)) {
        return true;
      }
    }
    return false;
  }

  Array.prototype.Count = function (lambda = x => true) {
    let cnt = 0
    for (let item of this) {
      if (lambda(item)) {
        cnt++
      }
    }
    return cnt
  }

  Array.prototype.Where = function (lambda = x => x) {
    return this.filter((item) => lambda(item))
  }

  Array.prototype.Select = function (lambda = x => x) {
    let resArr = []
    for (let item of this) {
      resArr.push(lambda(item))
    }
    return resArr
  }

  Array.prototype.Sum = function (lambda = x => x) {
    return this.Select(lambda).reduce((a, b) => a + b, 0)
  }

  Array.prototype.MinBy = function (lambda = x => x) {
    if (!this.Any()) {
      return null
    }

    let resItem = this[0]
    for (let i = 1; i < this.length; i++) {
      if (lambda(this[i]) < lambda(resItem)) {
        resItem = this[i]
      }
    }
    return resItem
  }

  Array.prototype.MaxBy = function (lambda = x => x) {
    if (!this.Any()) {
      return null
    }

    let resItem = this[0]
    for (let i = 1; i < this.length; i++) {
      if (lambda(this[i]) > lambda(resItem)) {
        resItem = this[i]
      }
    }
    return resItem
  }

  Array.prototype.FirstOrDefault = function (lambda = x => true) {
    for (let item of this) {
      if (lambda(item)) {
        return item
      }
    }
    return null
  }

  Array.prototype.OrderBy = function (lambda = x => x) {
    return [...this].sort((a, b) => (lambda(a) > lambda(b)) ? 1 : -1)
  }

  Array.prototype.OrderByDescending = function (lambda = x => x) {
    return [...this].sort((a, b) => (lambda(a) < lambda(b)) ? 1 : -1)
  }

  // Objects
  Object.prototype.Select = function (lambda = x => x) {
    let resArr = []
    for (let item in this) {
      resArr.push(lambda(item))
    }
    return resArr
  }

  Object.prototype.Any = function (lambda = x => x) {
    for (let item in this) {
      if (lambda(item)) {
        return true
      }
    }
    return false;
  }
}

window.addEventListener('resize', function () {
  w = c.width = window.innerWidth;
  h = c.height = window.innerHeight;

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, w, h);

  opts.cx = w / 2;
  opts.cy = h / 2;

  dieX = w / 2 / opts.len;
  dieY = h / 2 / opts.len;

  fitSizeRatio();
});

loop();
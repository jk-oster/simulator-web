import Noise from './noise.js';

class Matter {
  constructor(mass, x, y, velocityX, velocityY) {
    this.mass = mass; // Mass in kg ~ area of the circle
    this.x = x;
    this.y = y;
    this.velocityX = velocityX || 0;
    this.velocityY = velocityY || 0;
  }

  get radius() {
    return this.mass / Math.PI / 2;
  }

  get position() {
    return { x: this.x, y: this.y };
  }

  get velocity() {
    return { x: this.velocityX, y: this.velocityY };
  }

  get momentum() {
    return { x: this.mass * this.velocityX, y: this.mass * this.velocityY };
  }

  get kineticEnergy() {
    return 0.5 * this.mass * (this.velocityX ** 2 + this.velocityY ** 2);
  }
}

class MatterGenerator {
  constructor(seed) {
    this.seed = seed;
    this.noise = new Noise(seed);
  }

  generateMatter(amount, areaWidth, areaHeight, minMass, maxMass, minVelocity, maxVelocity) {
    const matterObjects = [];

    for (let i = 0; i < amount; i++) {
      const x = this.noise.perlin2(i * 0.1, 0) * areaWidth;
      const y = this.noise.perlin2(0, i * 0.1) * areaHeight;

      const massNoise = this.noise.perlin2(i * 0.2, i * 0.2);
      const mass = (massNoise + 1) * 0.5 * (maxMass - minMass) + minMass;

      const velocityX = this.noise.perlin2(i * 0.2, 0) * (maxVelocity - minVelocity) + minVelocity;
      const velocityY = this.noise.perlin2(0, i * 0.2) * (maxVelocity - minVelocity) + minVelocity;

      const matterObj = new Matter(mass, x, y, velocityX, velocityY);
      matterObjects.push(matterObj);
    }

    return matterObjects;
  }
}

class GalacticGravitySimulation {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    this.isPaused = false;
    this.context = canvas.getContext('2d');
    this.matter = [];

    this.timeCycle = config.timeCycle || 1;
    this.zoomFactor = config.zoomFactor || 1.0;
    this.softeningFactor = config.softeningFactor || 10;
    this.dragFactor = config.dragFactor || 0.001;
    this.gravitationalConstant = config.gravitationalConstant || 6.67430e-11;
    this.mergeRatioThreshold = config.mergeRatioThreshold || 2;
    this.impactSpeedThreshold = config.impactSpeedThreshold || 0.5;

    this.matterGenerator = new MatterGenerator(config.seed || 123);
    this.matter = this.matterGenerator.generateMatter(
      config.initialMatterAmount || 10,
      canvas.width,
      canvas.height,
      config.minMass || 5,
      config.maxMass || 20,
      config.minVelocity || 1,
      config.maxVelocity || 5
    );
  }

  calculateGravity() {
    for (let i = 0; i < this.matter.length; i++) {
      for (let j = 0; j < this.matter.length; j++) {
        if (i !== j) {
          const dx = this.matter[j].x - this.matter[i].x;
          const dy = this.matter[j].y - this.matter[i].y;
          const distance = Math.sqrt(dx * dx + dy * dy) + this.softeningFactor;

          const gravitationalForce = (this.gravitationalConstant * this.matter[i].mass * this.matter[j].mass) / (distance * distance);
          const forceX = gravitationalForce * (dx / distance);
          const forceY = gravitationalForce * (dy / distance);

          const dragForceX = -this.dragFactor * this.matter[i].velocityX;
          const dragForceY = -this.dragFactor * this.matter[i].velocityY;

          this.matter[i].velocityX += (forceX + dragForceX) / this.matter[i].mass;
          this.matter[i].velocityY += (forceY + dragForceY) / this.matter[i].mass;
        }
      }
    }

    this.matter.forEach(obj => {
      obj.x += obj.velocityX * this.timeCycle;
      obj.y += obj.velocityY * this.timeCycle;
    });
  }

  checkCollision(i, j) {
    const dx = this.matter[j].x - this.matter[i].x;
    const dy = this.matter[j].y - this.matter[i].y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return { isColliding: distance < this.matter[i].radius + this.matter[j].radius, distance, dx, dy };
  }

  detectCollisions() {
    for (let i = 0; i < this.matter.length; i++) {
      for (let j = 0; j < this.matter.length; j++) {
        if (this.matter[i] && this.matter[j] && i !== j) {
          const { isColliding, distance, dx, dy } = this.checkCollision(i, j);

          if (isColliding) {
            // Calculate collision normal
            const collisionNormalX = dx / Math.max(distance, 0.000000000001);
            const collisionNormalY = dy / Math.max(distance, 0.000000000001);

            // Handle the collision
            this.handleCollision(i, j, collisionNormalX, collisionNormalY);
          }
        }
      }
    }
  }

  handleCollision(i, j, collisionNormalX, collisionNormalY) {
    const big = this.matter[i].mass > this.matter[j].mass ? i : j;
    const small = big === i ? j : i;
    const massRatio = this.matter[big].mass / this.matter[small].mass;
    const impactSpeed = (this.matter[j].velocityX - this.matter[i].velocityX) * collisionNormalX + (this.matter[j].velocityY - this.matter[i].velocityY) * collisionNormalY;
    console.log('collision', this.matter[i], this.matter[j], impactSpeed, massRatio);

    if (massRatio > this.mergeRatioThreshold) {
      this.mergeBodies(big, small);
      return;
    }
    if (impactSpeed > this.impactSpeedThreshold) {
      this.breakApartBodies(i, j, 0.8, 3); // Adjust parameters as needed
      return;
    }
    this.bounceBodies(i, j, collisionNormalX, collisionNormalY);

    // If the bodies are still colliding after the bounce, merge them
    // if (this.checkCollision(i, j).isColliding) {
    //   this.mergeBodies(big, small);
    // }
  }

  mergeBodies(big, small) {
    // Merge bodies
    this.matter[big].mass += this.matter[small].mass;
    // Set the velocity of the merged body and apply conservation of momentum
    this.matter[big].velocityX = (this.matter[big].momentum.x + this.matter[small].momentum.x) / this.matter[big].mass;
    this.matter[big].velocityY = (this.matter[big].momentum.y + this.matter[small].momentum.y) / this.matter[big].mass;

    this.matter.splice(small, 1);
  }

  bounceBodies(i, j, collisionNormalX, collisionNormalY) {
    // Elastic collision response
    const relativeVelocityX = this.matter[j].velocityX - this.matter[i].velocityX;
    const relativeVelocityY = this.matter[j].velocityY - this.matter[i].velocityY;
    const velocityAlongNormal = (relativeVelocityX * collisionNormalX) + (relativeVelocityY * collisionNormalY);

    // If objects are moving towards each other
    if (velocityAlongNormal < 0) {
      const impulse = (2 * velocityAlongNormal) / (this.matter[i].mass + this.matter[j].mass);
      this.matter[i].velocityX += impulse * this.matter[j].mass * collisionNormalX;
      this.matter[i].velocityY += impulse * this.matter[j].mass * collisionNormalY;
      this.matter[j].velocityX -= impulse * this.matter[i].mass * collisionNormalX;
      this.matter[j].velocityY -= impulse * this.matter[i].mass * collisionNormalY;
    }
  }

  breakApartBodies(i, j, remainingMassRatio, numFragments) {
    // Calculate remaining mass after breaking apart
    const remainingMass1 = this.matter[i].mass * remainingMassRatio;
    const remainingMass2 = this.matter[j].mass * remainingMassRatio;

    // Calculate the masses for the new fragments
    const fragmentMass1 = this.matter[i].mass - remainingMass1;
    const fragmentMass2 = this.matter[j].mass - remainingMass2;

    // Calculate relative velocities of the fragments
    const relativeVelocityX = this.matter[j].velocityX - this.matter[i].velocityX;
    const relativeVelocityY = this.matter[j].velocityY - this.matter[i].velocityY;

    // Calculate the angle between the relative velocity vector and the collision normal
    const angle = Math.atan2(relativeVelocityY, relativeVelocityX);

    // Calculate velocities for the new fragments
    const velocities = Array.from({ length: numFragments }, (_, index) => {
      const angleOffset = ((index % 2 === 0 ? 1 : -1) * (index + 1) * Math.PI) / numFragments;
      const newAngle = angle + angleOffset;

      const speed = Math.sqrt(relativeVelocityX ** 2 + relativeVelocityY ** 2);
      const velocityX = speed * Math.cos(newAngle);
      const velocityY = speed * Math.sin(newAngle);

      return { x: velocityX, y: velocityY };
    });

    // Create new fragments
    const fragments = velocities.map((velocities, index) => {
      const fragment = new Matter(
        index % 2 === 0 ? fragmentMass1 / numFragments : fragmentMass2 / numFragments,
        index % 2 === 0 ? this.matter[i].x : this.matter[j].x,
        index % 2 === 0 ? this.matter[i].y : this.matter[j].y,
        velocities.x,
        velocities.y
      );
      return fragment;
    });

    // Update the masses of the main bodies
    this.matter[i].mass = remainingMass1;
    this.matter[j].mass = remainingMass2;

    // Add new fragments to the simulation
    this.matter.push(...fragments);
  }

  calculateCenterOfMass() {
    const totalMass = this.matter.reduce((totalMass, matterObj) => totalMass + matterObj.mass, 0);
    const centerOfMass = this.matter.reduce((centerOfMass, matterObj) => {
      centerOfMass.x += matterObj.x * matterObj.mass / totalMass;
      centerOfMass.y += matterObj.y * matterObj.mass / totalMass;
      return centerOfMass;
    }, { x: 0, y: 0 });

    return centerOfMass;
  }

  calculateMaxDistance() {
    const centerOfMass = this.calculateCenterOfMass();
    const maxDistance = this.matter.reduce((maxDistance, matterObj) => {
      const distance = Math.sqrt((matterObj.x - centerOfMass.x) ** 2 + (matterObj.y - centerOfMass.y) ** 2);
      return distance > maxDistance ? distance : maxDistance;
    }
      , 0);

    return maxDistance;
  }

  calculateTotalMass() {
    return this.matter.reduce((totalMass, matterObj) => totalMass + matterObj.mass, 0);
  }

  calculateTotalKineticEnergy() {
    return this.matter.reduce((totalKineticEnergy, matterObj) => totalKineticEnergy + matterObj.kineticEnergy, 0);
  }

  // calculate color based on matter velocity
  calculateColorByVelocity(matterObj) {
    const velocity = Math.sqrt(matterObj.velocityX ** 2 + matterObj.velocityY ** 2);
    const maxVelocity = Math.sqrt(this.config.maxVelocity ** 2 + this.config.maxVelocity ** 2);
    const velocityRatio = velocity / maxVelocity;
    const color = Math.floor(255 * velocityRatio);
    return `rgb(0, 0, ${color})`;
  }

  // calculate color based on matter kinetic energy
  calculateColorByMass(matterObj, maxMass = this.config.maxMass) {
    const mass = matterObj.mass;
    const massRatio = mass / maxMass;
    const color = Math.floor(255 * (1 - massRatio));
    return `rgb(0, ${color}, 0)`;
  }

  drawMatterObjects() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.save();

    const centerOfMass = this.calculateCenterOfMass();
    const maxDistance = this.calculateMaxDistance();
    const autoZoomFactor = Math.min(10, (this.canvas.height / maxDistance) * this.zoomFactor);
    const totalMass = this.calculateTotalMass();

    this.context.translate(
      this.canvas.width / 2,
      this.canvas.height / 2
    );

    for (const matterObj of this.matter) {
      this.context.beginPath();
      // calculate x & y relative to center of mass
      this.context.arc(
        (matterObj.x - centerOfMass.x) * autoZoomFactor,
        (matterObj.y - centerOfMass.y) * autoZoomFactor,
        Math.max(0.5, Math.ceil(matterObj.radius * autoZoomFactor)), 0, 2 * Math.PI);
      this.context.fillStyle = this.calculateColorByMass(matterObj, totalMass);
      this.context.fill();
    }

    // draw center of mass & info
    this.context.beginPath();
    this.context.arc(0, 0, 1, 0, 2 * Math.PI);
    this.context.fillStyle = 'red';
    this.context.fill();
    this.context.font = "10px Arial";
    this.context.fillText("n:" + this.matter.length, 10, 15);
    this.context.fillText("z:" + autoZoomFactor.toFixed(2), 10, 30);
    this.context.fillText("m:" + totalMass.toFixed(1), 10, 45);

    this.context.restore();
  }

  pauseSimulation() {
    this.isPaused = true;
  }

  resumeSimulation() {
    this.isPaused = false;
  }

  toggleSimulation() {
    this.isPaused = !this.isPaused;
  }

  resetSimulation() {
    this.matter = this.matterGenerator.generateMatter(
      this.config.initialMatterAmount || 10,
      this.canvas.width,
      this.canvas.height,
      this.config.minMass || 5,
      this.config.maxMass || 20,
      this.config.minVelocity || 1,
      this.config.maxVelocity || 5
    );

    this.isPaused = false;
    this.drawMatterObjects();
  }

  simulateFrame() {
    if (!this.isPaused) {
      this.calculateGravity();
      this.detectCollisions();
      this.drawMatterObjects();
      requestAnimationFrame(() => this.simulateFrame());
    } else {
      // If paused, still redraw the matter objects -> apply zoom
      this.drawMatterObjects();
      requestAnimationFrame(() => this.simulateFrame());
    }
  }
}

const simulatorConfig = {
  timeCycle: 1,
  seed: 1,
  initialMatterAmount: 30,
  minMass: 2,
  maxMass: 10,
  minVelocity: 0,
  maxVelocity: 10,
  zoomFactor: 1,
  softeningFactor: 5,
  dragFactor: 0,
  // dragFactor: 0.001,
  gravitationalConstant: 1,
  // gravitationalConstant: 6.67430e-11,
  mergeRatioThreshold: 3,
  impactSpeedThreshold: 0.3,
};

const canvas = document.getElementById('canvas');

let simulator = new GalacticGravitySimulation(canvas, simulatorConfig);

function startSimulation() {
  simulator.simulateFrame();
}

function toggleSimulation() {
  simulator.toggleSimulation();
}

function resetSimulation() {
  simulator.resetSimulation();
}

function setZoomFactor(event) {
  simulator.zoomFactor = Number(event.target.value);
}

function setCycleTime(event) {
  simulator.timeCycle = Number(event.target.value);
}

function setInitialMatterAmount(event) {
  simulator.config.initialMatterAmount = Number(event.target.value);
  simulator.resetSimulation();
}

function setMinMass(event) {
  simulator.config.minMass = Number(event.target.value);
}

function setMaxMass(event) {
  simulator.config.maxMass = Number(event.target.value);
}

function setMinVelocity(event) {
  simulator.config.minVelocity = Number(event.target.value);
}

function setMaxVelocity(event) {
  simulator.config.maxVelocity = Number(event.target.value);
}

function setSofteningFactor(event) {
  simulator.softeningFactor = (event.target.value);
}

function setDragFactor(event) {
  simulator.dragFactor = Number(event.target.value);
}

function setGravitationalConstant(event) {
  simulator.gravitationalConstant = Number(event.target.value);
}

function setMergeRatioThreshold(event) {
  simulator.mergeRatioThreshold = Number(event.target.value);
}

function setImpactSpeedThreshold(event) {
  simulator.impactSpeedThreshold = Number(event.target.value);
}

const elementFunctionMapping = {
  'start': startSimulation,
  'pause': toggleSimulation,
  'reset': resetSimulation,
  'cycle-time': setCycleTime,
  'initial-matter-amount': setInitialMatterAmount,
  'min-mass': setMinMass,
  'max-mass': setMaxMass,
  'min-velocity': setMinVelocity,
  'max-velocity': setMaxVelocity,
  'softening-factor': setSofteningFactor,
  'drag-factor': setDragFactor,
  'gravitational-constant': setGravitationalConstant,
  'zoom-factor': setZoomFactor,
  'merge-ratio-threshold': setMergeRatioThreshold,
  'impact-speed-threshold': setImpactSpeedThreshold,
};

for (const elementId in elementFunctionMapping) {
  const element = document.getElementById(elementId);
  if (element && element.tagName === 'INPUT') {
    element.addEventListener('change', elementFunctionMapping[elementId]);
  } else if (element && element.tagName === 'BUTTON') {
    element.addEventListener('click', elementFunctionMapping[elementId]);
  }
}



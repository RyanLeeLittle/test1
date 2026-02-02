const canvas = document.querySelector("#stack-canvas");
const totalCountEl = document.querySelector("#total-count");
const maxHeightEl = document.querySelector("#max-height");
const layerBreakdownEl = document.querySelector("#layer-breakdown");
const gridSizeInput = document.querySelector("#grid-size");
const gridSizeValue = document.querySelector("#grid-size-value");
const layerCountInput = document.querySelector("#layer-count");
const layerCountValue = document.querySelector("#layer-count-value");

const addLayerBtn = document.querySelector("#add-layer");
const removeLayerBtn = document.querySelector("#remove-layer");
const clearBtn = document.querySelector("#clear-blocks");

const ctx = canvas.getContext("2d");

const colors = {
  top: "#7f9bff",
  left: "#5a6fe0",
  right: "#4b5cc5",
  stroke: "#2a365c",
  grid: "#ccd4f6",
};

const state = {
  gridSize: Number(gridSizeInput.value),
  maxLayers: Number(layerCountInput.value),
  blocks: [],
  tileWidth: 70,
  tileHeight: 36,
  blockHeight: 34,
  offsetX: 0,
  offsetY: 0,
};

function initBlocks() {
  state.blocks = Array.from({ length: state.gridSize }, () =>
    Array.from({ length: state.gridSize }, () => 0)
  );
}

function resizeCanvas() {
  const { clientWidth, clientHeight } = canvas;
  canvas.width = Math.max(1, clientWidth * window.devicePixelRatio);
  canvas.height = Math.max(1, clientHeight * window.devicePixelRatio);
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  state.offsetX = clientWidth / 2;
  state.offsetY = clientHeight * 0.65;
}

function isoProject(x, z, y) {
  const screenX = (x - z) * (state.tileWidth / 2) + state.offsetX;
  const screenY = (x + z) * (state.tileHeight / 2) + state.offsetY - y;
  return { x: screenX, y: screenY };
}

function drawGrid() {
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.grid;
  for (let x = 0; x <= state.gridSize; x += 1) {
    const start = isoProject(x, 0, 0);
    const end = isoProject(x, state.gridSize, 0);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
  for (let z = 0; z <= state.gridSize; z += 1) {
    const start = isoProject(0, z, 0);
    const end = isoProject(state.gridSize, z, 0);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
}

function drawBlock(x, z, height) {
  const baseY = height * state.blockHeight;
  const top = isoProject(x, z, baseY + state.blockHeight);
  const right = isoProject(x + 1, z, baseY + state.blockHeight);
  const front = isoProject(x + 1, z + 1, baseY + state.blockHeight);
  const left = isoProject(x, z + 1, baseY + state.blockHeight);

  const topFace = [top, right, front, left];
  const rightFace = [right, isoProject(x + 1, z, baseY), isoProject(x + 1, z + 1, baseY), front];
  const leftFace = [left, front, isoProject(x, z + 1, baseY), isoProject(x, z, baseY)];

  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.stroke;

  ctx.fillStyle = colors.right;
  fillPolygon(rightFace);

  ctx.fillStyle = colors.left;
  fillPolygon(leftFace);

  ctx.fillStyle = colors.top;
  fillPolygon(topFace);
}

function fillPolygon(points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  const blocksToDraw = [];
  for (let x = 0; x < state.gridSize; x += 1) {
    for (let z = 0; z < state.gridSize; z += 1) {
      const height = state.blocks[x][z];
      for (let y = 0; y < height; y += 1) {
        blocksToDraw.push({ x, z, y });
      }
    }
  }

  blocksToDraw.sort((a, b) => (a.x + a.z + a.y) - (b.x + b.z + b.y));
  blocksToDraw.forEach((block) => drawBlock(block.x, block.z, block.y));
}

function updateSummary() {
  let total = 0;
  let maxHeight = 0;
  const layerCounts = Array.from({ length: state.maxLayers }, () => 0);

  for (let x = 0; x < state.gridSize; x += 1) {
    for (let z = 0; z < state.gridSize; z += 1) {
      const height = state.blocks[x][z];
      total += height;
      maxHeight = Math.max(maxHeight, height);
      for (let y = 0; y < height; y += 1) {
        if (layerCounts[y] !== undefined) {
          layerCounts[y] += 1;
        }
      }
    }
  }

  totalCountEl.textContent = total.toString();
  maxHeightEl.textContent = maxHeight.toString();
  layerBreakdownEl.textContent = layerCounts.length
    ? layerCounts.map((count, index) => `${index + 1}층: ${count}`).join(" · ")
    : "-";
}

function clampHeight(x, z) {
  state.blocks[x][z] = Math.min(state.blocks[x][z], state.maxLayers);
}

function handleCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const pointerX = event.clientX - rect.left - state.offsetX;
  const pointerY = event.clientY - rect.top - state.offsetY;

  const isoX = (pointerX / (state.tileWidth / 2) + pointerY / (state.tileHeight / 2)) / 2;
  const isoZ = (pointerY / (state.tileHeight / 2) - pointerX / (state.tileWidth / 2)) / 2;

  const gridX = Math.floor(isoX);
  const gridZ = Math.floor(isoZ);

  if (gridX < 0 || gridZ < 0 || gridX >= state.gridSize || gridZ >= state.gridSize) {
    return;
  }

  if (event.shiftKey) {
    state.blocks[gridX][gridZ] = Math.max(0, state.blocks[gridX][gridZ] - 1);
  } else {
    state.blocks[gridX][gridZ] = Math.min(state.maxLayers, state.blocks[gridX][gridZ] + 1);
  }

  updateSummary();
  drawScene();
}

function addLayer() {
  for (let x = 0; x < state.gridSize; x += 1) {
    for (let z = 0; z < state.gridSize; z += 1) {
      if (state.blocks[x][z] < state.maxLayers) {
        state.blocks[x][z] += 1;
      }
    }
  }
  updateSummary();
  drawScene();
}

function removeLayer() {
  let highest = 0;
  for (let x = 0; x < state.gridSize; x += 1) {
    for (let z = 0; z < state.gridSize; z += 1) {
      highest = Math.max(highest, state.blocks[x][z]);
    }
  }
  if (highest === 0) return;

  for (let x = 0; x < state.gridSize; x += 1) {
    for (let z = 0; z < state.gridSize; z += 1) {
      if (state.blocks[x][z] === highest) {
        state.blocks[x][z] -= 1;
      }
    }
  }

  updateSummary();
  drawScene();
}

function clearBlocks() {
  initBlocks();
  updateSummary();
  drawScene();
}

function handleGridChange() {
  state.gridSize = Number(gridSizeInput.value);
  gridSizeValue.textContent = `${state.gridSize} x ${state.gridSize}`;
  initBlocks();
  updateSummary();
  drawScene();
}

function handleLayerChange() {
  state.maxLayers = Number(layerCountInput.value);
  layerCountValue.textContent = `${state.maxLayers} 층`;
  for (let x = 0; x < state.gridSize; x += 1) {
    for (let z = 0; z < state.gridSize; z += 1) {
      clampHeight(x, z);
    }
  }
  updateSummary();
  drawScene();
}

function init() {
  resizeCanvas();
  initBlocks();
  updateSummary();
  drawScene();
}

canvas.addEventListener("click", handleCanvasClick);
window.addEventListener("resize", () => {
  resizeCanvas();
  drawScene();
});

addLayerBtn.addEventListener("click", addLayer);
removeLayerBtn.addEventListener("click", removeLayer);
clearBtn.addEventListener("click", clearBlocks);

gridSizeInput.addEventListener("input", handleGridChange);
layerCountInput.addEventListener("input", handleLayerChange);

init();

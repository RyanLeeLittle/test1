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

const scene = new THREE.Scene();
scene.background = new THREE.Color("#f7f9ff");

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 6;
controls.maxDistance = 30;

const ambient = new THREE.AmbientLight(0xffffff, 0.75);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xffffff, 0.7);
directional.position.set(6, 10, 4);
scene.add(directional);

const gridGroup = new THREE.Group();
scene.add(gridGroup);

const blockGroup = new THREE.Group();
scene.add(blockGroup);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const blockSize = 1;
let gridSize = Number(gridSizeInput.value);
let maxLayers = Number(layerCountInput.value);
let blocks = [];

const blockMaterial = new THREE.MeshStandardMaterial({
  color: "#4f6df5",
  roughness: 0.35,
  metalness: 0.1,
});

const highlightMaterial = new THREE.MeshStandardMaterial({
  color: "#f5b74f",
  roughness: 0.4,
  metalness: 0.05,
});

let hoverMesh = null;

function createGrid() {
  gridGroup.clear();
  const gridHelper = new THREE.GridHelper(
    gridSize * blockSize,
    gridSize,
    "#a9b7e8",
    "#d5dcf4"
  );
  gridHelper.position.y = 0;
  gridGroup.add(gridHelper);
}

function resetCamera() {
  const distance = gridSize * 1.4;
  camera.position.set(distance, distance * 0.9, distance);
  camera.lookAt(0, 0, 0);
  controls.update();
}

function resizeRenderer() {
  const { clientWidth, clientHeight } = canvas;
  const width = clientWidth;
  const height = clientHeight;
  if (width === 0 || height === 0) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function blockKey(x, y, z) {
  return `${x},${y},${z}`;
}

function rebuildBlocks() {
  blockGroup.clear();
  blocks.forEach((block) => {
    const mesh = createBlockMesh(block, blockMaterial);
    blockGroup.add(mesh);
  });
}

function createBlockMesh({ x, y, z }, material) {
  const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y + blockSize / 2, z);
  mesh.userData = { x, y, z };
  return mesh;
}

function getGridCoordinate(point) {
  const half = (gridSize * blockSize) / 2;
  const x = Math.floor((point.x + half) / blockSize) * blockSize + blockSize / 2 - half;
  const z = Math.floor((point.z + half) / blockSize) * blockSize + blockSize / 2 - half;
  return { x, z };
}

function getTopHeight(x, z) {
  let maxY = -blockSize;
  blocks.forEach((block) => {
    if (block.x === x && block.z === z) {
      maxY = Math.max(maxY, block.y);
    }
  });
  return maxY;
}

function addBlock(x, y, z) {
  if (y / blockSize >= maxLayers) return;
  const key = blockKey(x, y, z);
  if (blocks.some((block) => blockKey(block.x, block.y, block.z) === key)) {
    return;
  }
  blocks.push({ x, y, z });
  rebuildBlocks();
  updateSummary();
}

function removeBlock(x, y, z) {
  const key = blockKey(x, y, z);
  blocks = blocks.filter((block) => blockKey(block.x, block.y, block.z) !== key);
  rebuildBlocks();
  updateSummary();
}

function updateSummary() {
  totalCountEl.textContent = blocks.length.toString();
  const maxHeight = blocks.reduce((max, block) => Math.max(max, block.y / blockSize + 1), 0);
  maxHeightEl.textContent = maxHeight.toString();

  const layerCounts = Array.from({ length: maxLayers }, () => 0);
  blocks.forEach((block) => {
    const layerIndex = block.y / blockSize;
    if (layerCounts[layerIndex] !== undefined) {
      layerCounts[layerIndex] += 1;
    }
  });
  const breakdown = layerCounts
    .map((count, index) => `${index + 1}층: ${count}`)
    .join(" · ");
  layerBreakdownEl.textContent = breakdown || "-";
}

function addLayer() {
  const newBlocks = [];
  blocks.forEach((block) => {
    newBlocks.push(block);
    const nextY = block.y + blockSize;
    if (nextY / blockSize < maxLayers) {
      newBlocks.push({ x: block.x, y: nextY, z: block.z });
    }
  });
  blocks = newBlocks;
  rebuildBlocks();
  updateSummary();
}

function removeLayer() {
  const highest = blocks.reduce((max, block) => Math.max(max, block.y), -blockSize);
  if (highest < 0) return;
  blocks = blocks.filter((block) => block.y !== highest);
  rebuildBlocks();
  updateSummary();
}

function clearBlocks() {
  blocks = [];
  rebuildBlocks();
  updateSummary();
}

function updateHover(target) {
  if (hoverMesh) {
    scene.remove(hoverMesh);
    hoverMesh.geometry.dispose();
    hoverMesh = null;
  }
  if (!target) return;
  hoverMesh = createBlockMesh(target, highlightMaterial);
  hoverMesh.material.transparent = true;
  hoverMesh.material.opacity = 0.5;
  scene.add(hoverMesh);
}

function onPointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const intersects = raycaster.intersectObjects(blockGroup.children, true);
  if (intersects.length > 0) {
    const hit = intersects[0].object.userData;
    updateHover({ x: hit.x, y: hit.y + blockSize, z: hit.z });
    return;
  }

  const planeIntersect = raycaster.intersectObjects(gridGroup.children, true);
  if (planeIntersect.length > 0) {
    const point = planeIntersect[0].point;
    const { x, z } = getGridCoordinate(point);
    updateHover({ x, y: 0, z });
  }
}

function onPointerClick(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const intersects = raycaster.intersectObjects(blockGroup.children, true);
  if (intersects.length > 0) {
    const hit = intersects[0].object.userData;
    if (event.shiftKey) {
      removeBlock(hit.x, hit.y, hit.z);
      return;
    }
    addBlock(hit.x, hit.y + blockSize, hit.z);
    return;
  }

  const planeIntersect = raycaster.intersectObjects(gridGroup.children, true);
  if (planeIntersect.length > 0) {
    const point = planeIntersect[0].point;
    const { x, z } = getGridCoordinate(point);
    if (event.shiftKey) {
      const topHeight = getTopHeight(x, z);
      if (topHeight >= 0) {
        removeBlock(x, topHeight, z);
      }
      return;
    }
    addBlock(x, 0, z);
  }
}

function handleGridChange() {
  gridSize = Number(gridSizeInput.value);
  gridSizeValue.textContent = `${gridSize} x ${gridSize}`;
  createGrid();
  resetCamera();
}

function handleLayerChange() {
  maxLayers = Number(layerCountInput.value);
  layerCountValue.textContent = `${maxLayers} 층`;
  blocks = blocks.filter((block) => block.y / blockSize < maxLayers);
  rebuildBlocks();
  updateSummary();
}

function animate() {
  resizeRenderer();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

createGrid();
resetCamera();
updateSummary();

canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerleave", () => updateHover(null));
canvas.addEventListener("click", onPointerClick);

addLayerBtn.addEventListener("click", addLayer);
removeLayerBtn.addEventListener("click", removeLayer);
clearBtn.addEventListener("click", clearBlocks);

gridSizeInput.addEventListener("input", handleGridChange);
layerCountInput.addEventListener("input", handleLayerChange);

window.addEventListener("resize", resizeRenderer);

animate();

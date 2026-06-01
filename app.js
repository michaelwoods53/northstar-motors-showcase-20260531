import { featureOptions, sortOptions, vehicles } from "./data.js";

const DEFAULT_INTERIOR_PANORAMA = "./assets/panoramas/vehicle-interior-360.png";
const INTERIOR_VIEW = "interior360";
const MODEL_VIEW = "generated3d";
const INTERIOR_HFOV_MIN = 48;
const INTERIOR_HFOV_MAX = 110;

const INTERIOR_PRESETS = [
  {
    key: "dash",
    label: "Dashboard",
    detail: "Forward cabin view centered on the steering wheel, screen stack, and front-row layout.",
    yaw: 0,
    pitch: -2,
    hfov: 84
  },
  {
    key: "driver",
    label: "Driver",
    detail: "Turn toward the driver controls, wheel spokes, and left-side door trim.",
    yaw: -32,
    pitch: -5,
    hfov: 72
  },
  {
    key: "passenger",
    label: "Passenger",
    detail: "Inspect the dash width, front passenger space, and right-side trim details.",
    yaw: 34,
    pitch: -5,
    hfov: 72
  },
  {
    key: "rear",
    label: "Rear Seats",
    detail: "Rotate to the back row to judge rear seating width and cabin openness.",
    yaw: 180,
    pitch: -3,
    hfov: 88
  },
  {
    key: "roof",
    label: "Roofline",
    detail: "Tilt upward to inspect the headliner, overhead console, and upper glass area.",
    yaw: 0,
    pitch: 56,
    hfov: 96
  }
];

const MODEL_PRESETS = [
  {
    key: "frontThreeQuarter",
    label: "Front 3/4",
    detail: "Best overall showroom angle for the front fascia, wheel stance, and shoulder line.",
    orbit: "-28deg 74deg 108%"
  },
  {
    key: "side",
    label: "Side",
    detail: "Side profile view emphasizes wheelbase, roof arc, and body proportions.",
    orbit: "-90deg 78deg 114%"
  },
  {
    key: "rearThreeQuarter",
    label: "Rear 3/4",
    detail: "Rear three-quarter view shows taper, rear lamp treatment, and cargo-side volume.",
    orbit: "145deg 74deg 110%"
  },
  {
    key: "rear",
    label: "Rear",
    detail: "Straight rear framing makes tail design and liftgate geometry easier to evaluate.",
    orbit: "180deg 78deg 102%"
  },
  {
    key: "roof",
    label: "Roof",
    detail: "Higher orbit angle gives a cleaner read on the footprint and roofline.",
    orbit: "0deg 24deg 128%"
  }
];

let disposeActiveViewer = null;
let threeModulePromise = null;

const state = {
  query: "",
  condition: "All",
  bodyStyle: "All",
  fuel: "All",
  drivetrain: "All",
  maxPrice: 95000,
  maxPayment: 1500,
  activeFeatures: new Set(),
  sort: "featured",
  favorites: new Set(JSON.parse(localStorage.getItem("northstar-favorites") || "[]"))
};

const els = {
  featuredVehicleTitle: document.querySelector("#featuredVehicleTitle"),
  featuredVehicleMeta: document.querySelector("#featuredVehicleMeta"),
  featuredVehicleTags: document.querySelector("#featuredVehicleTags"),
  featuredVehicleArt: document.querySelector("#featuredVehicleArt"),
  inventoryGrid: document.querySelector("#inventoryGrid"),
  inventorySummary: document.querySelector("#inventorySummary"),
  searchInput: document.querySelector("#searchInput"),
  conditionFilter: document.querySelector("#conditionFilter"),
  bodyFilter: document.querySelector("#bodyFilter"),
  fuelFilter: document.querySelector("#fuelFilter"),
  drivetrainFilter: document.querySelector("#drivetrainFilter"),
  priceFilter: document.querySelector("#priceFilter"),
  priceOutput: document.querySelector("#priceOutput"),
  paymentFilter: document.querySelector("#paymentFilter"),
  paymentOutput: document.querySelector("#paymentOutput"),
  featureFilters: document.querySelector("#featureFilters"),
  resetFilters: document.querySelector("#resetFilters"),
  sortButton: document.querySelector("#sortButton"),
  favoritesCount: document.querySelector("[data-favorites-count]"),
  vehicleModal: document.querySelector("#vehicleModal"),
  modalContent: document.querySelector("#modalContent"),
  closeModalButton: document.querySelector("#closeModalButton"),
  heroTourButton: document.querySelector("#heroTourButton"),
  financeForm: document.querySelector("#financeForm"),
  financeOutput: document.querySelector("#financeOutput"),
  tradeForm: document.querySelector("#tradeForm"),
  tradeOutput: document.querySelector("#tradeOutput"),
  driveForm: document.querySelector("#driveForm"),
  driveVehicleSelect: document.querySelector("#driveVehicleSelect"),
  driveOutput: document.querySelector("#driveOutput")
};

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function compactNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function vehicleName(vehicle) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`;
}

function renderVehiclePhoto(vehicle, className = "vehicle-photo") {
  return `<img class="${className}" src="${vehicle.photo}" alt="${vehicleName(vehicle)} photo" loading="lazy">`;
}

function populateSelect(select, values) {
  select.innerHTML = ["All", ...values].map((value) => `<option value="${value}">${value}</option>`).join("");
}

function hasGeneratedModel(vehicle) {
  return Boolean(vehicle.generatedModel);
}

function renderFeatured() {
  const featured = vehicles.find((vehicle) => vehicle.featured) || vehicles[0];
  els.featuredVehicleTitle.textContent = vehicleName(featured);
  els.featuredVehicleMeta.textContent = `${currency(featured.price)} • ${featured.range} • ${featured.drivetrain} • Stock ${featured.stock}`;
  els.featuredVehicleTags.innerHTML = featured.badges.map((badge) => `<span>${badge}</span>`).join("");
  els.featuredVehicleArt.innerHTML = renderVehiclePhoto(featured, "vehicle-photo hero-vehicle-photo");
}

function getFilteredVehicles() {
  const query = state.query.trim().toLowerCase();
  const filtered = vehicles.filter((vehicle) => {
    const blob = [
      vehicleName(vehicle),
      vehicle.stock,
      vehicle.vin,
      vehicle.bodyStyle,
      vehicle.fuel,
      vehicle.drivetrain,
      vehicle.dealerNote,
      ...vehicle.features,
      ...vehicle.packages,
      ...vehicle.highlights
    ].join(" ").toLowerCase();

    const matchesQuery = !query || blob.includes(query);
    const matchesCondition = state.condition === "All" || vehicle.condition === state.condition;
    const matchesBody = state.bodyStyle === "All" || vehicle.bodyStyle === state.bodyStyle;
    const matchesFuel = state.fuel === "All" || vehicle.fuel === state.fuel;
    const matchesDrive = state.drivetrain === "All" || vehicle.drivetrain === state.drivetrain;
    const matchesPrice = vehicle.price <= state.maxPrice;
    const matchesPayment = vehicle.monthlyEstimate <= state.maxPayment;
    const matchesFeatures = [...state.activeFeatures].every((feature) => vehicle.features.includes(feature));

    return matchesQuery && matchesCondition && matchesBody && matchesFuel && matchesDrive && matchesPrice && matchesPayment && matchesFeatures;
  });

  filtered.sort((a, b) => {
    switch (state.sort) {
      case "priceAsc":
        return a.price - b.price;
      case "priceDesc":
        return b.price - a.price;
      case "milesAsc":
        return a.mileage - b.mileage;
      default:
        return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.price - b.price;
    }
  });

  return filtered;
}

function saveFavorites() {
  localStorage.setItem("northstar-favorites", JSON.stringify([...state.favorites]));
  els.favoritesCount.textContent = String(state.favorites.size);
}

function toggleFavorite(vehicleId) {
  if (state.favorites.has(vehicleId)) {
    state.favorites.delete(vehicleId);
  } else {
    state.favorites.add(vehicleId);
  }
  saveFavorites();
  renderInventory();
}

function renderInventory() {
  const filtered = getFilteredVehicles();
  els.inventorySummary.textContent = `${filtered.length} of ${vehicles.length} vehicles match your filters.`;

  if (!filtered.length) {
    els.inventoryGrid.innerHTML = `<div class="empty-state">No vehicles match the current search. Reset filters or expand your budget to see more inventory.</div>`;
    return;
  }

  els.inventoryGrid.innerHTML = filtered.map((vehicle) => `
    <article class="inventory-card">
      <div class="inventory-art">${renderVehiclePhoto(vehicle)}</div>
      <div class="inventory-badges">${vehicle.badges.map((badge) => `<span>${badge}</span>`).join("")}</div>
      <h3>${vehicleName(vehicle)}</h3>
      <p class="inventory-meta">${vehicle.dealerNote}</p>
      <div class="inventory-price">
        <strong>${currency(vehicle.price)}</strong>
        <span>${currency(vehicle.monthlyEstimate)}/mo est.</span>
      </div>
      <ul class="inventory-specs">
        <li>${vehicle.condition}</li>
        <li>${compactNumber(vehicle.mileage)} mi</li>
        <li>${vehicle.fuel}</li>
        <li>${vehicle.drivetrain}</li>
      </ul>
      <ul class="feature-list">
        ${vehicle.highlights.map((item) => `<li>${item}</li>`).join("")}
      </ul>
      <div class="card-actions">
        <button class="cta-primary" type="button" data-action="details" data-id="${vehicle.id}">View details</button>
        <button class="cta-secondary" type="button" data-action="favorite" data-id="${vehicle.id}">${state.favorites.has(vehicle.id) ? "Saved" : "Save"}</button>
      </div>
    </article>
  `).join("");
}

function rotateSort() {
  const currentIndex = sortOptions.findIndex((option) => option.value === state.sort);
  const next = sortOptions[(currentIndex + 1) % sortOptions.length];
  state.sort = next.value;
  els.sortButton.textContent = `Sort: ${next.label}`;
  renderInventory();
}

function paymentEstimate(price, down, apr, term) {
  const principal = Math.max(price - down, 0);
  const monthlyRate = apr / 100 / 12;
  if (monthlyRate === 0) {
    return principal / term;
  }
  return principal * (monthlyRate * (1 + monthlyRate) ** term) / ((1 + monthlyRate) ** term - 1);
}

function estimateTradeIn(miles, condition) {
  const base = 18250;
  const mileagePenalty = Math.max(miles - 12000, 0) * 0.08;
  const conditionMap = { Excellent: 1800, Good: 500, Fair: -1400 };
  return Math.max(base - mileagePenalty + (conditionMap[condition] || 0), 4500);
}

function renderViewerTabs(vehicle) {
  const tabs = [
    `<button class="viewer-tab is-active" type="button" role="tab" aria-selected="true" data-viewer-tab="${INTERIOR_VIEW}">Interior 360</button>`
  ];

  if (hasGeneratedModel(vehicle)) {
    tabs.push(`<button class="viewer-tab" type="button" role="tab" aria-selected="false" data-viewer-tab="${MODEL_VIEW}">Generated 3D</button>`);
  }

  return tabs.join("");
}

function renderInteriorViewer() {
  return `
    <section class="viewer-panel is-active" data-viewer-panel="${INTERIOR_VIEW}">
      <div class="viewer-stage">
        <div id="panoramaRoot" class="panorama-root">
          <div class="viewer-loading">Loading 360 interior...</div>
        </div>
      </div>
      <div class="viewer-controls">
        <div class="viewer-chip-row">
          ${INTERIOR_PRESETS.map((preset, index) => `
            <button type="button" class="tour-view-button${index === 0 ? " is-active" : ""}" data-interior-preset="${preset.key}">${preset.label}</button>
          `).join("")}
        </div>
        <div class="viewer-chip-row viewer-chip-row-secondary">
          <button type="button" class="viewer-action-button" id="interiorAutoplayButton">Auto orbit</button>
          <button type="button" class="viewer-action-button" id="interiorZoomInButton">Zoom in</button>
          <button type="button" class="viewer-action-button" id="interiorZoomOutButton">Zoom out</button>
          <button type="button" class="viewer-action-button" id="interiorResetButton">Reset</button>
        </div>
        <p id="tourStatus" class="viewer-status">${INTERIOR_PRESETS[0].detail}</p>
        <p class="viewer-hint">Swipe or drag to look around the cabin. Pinch, scroll, or use zoom controls for detail.</p>
      </div>
    </section>
  `;
}

function renderModelViewer(vehicle) {
  if (!hasGeneratedModel(vehicle)) {
    return "";
  }

  return `
    <section class="viewer-panel" data-viewer-panel="${MODEL_VIEW}" hidden>
      <div class="viewer-stage">
        <div class="model-viewer-shell">
          <model-viewer
            id="generatedModelViewer"
            class="generated-model-viewer"
            src="${vehicle.generatedModel}"
            alt="Generated 3D showcase for ${vehicleName(vehicle)}"
            camera-controls
            disable-pan
            interaction-prompt="none"
            loading="eager"
            reveal="auto"
            shadow-intensity="1.05"
            shadow-softness="0.9"
            exposure="1.05"
            min-camera-orbit="auto 22deg 78%"
            max-camera-orbit="auto 88deg 138%"
            rotation-per-second="18deg"
            touch-action="pan-y">
          </model-viewer>
          <div id="modelLoadingState" class="viewer-loading viewer-loading-overlay">Loading generated 3D...</div>
        </div>
      </div>
      <div class="viewer-controls">
        <div class="viewer-chip-row">
          ${MODEL_PRESETS.map((preset, index) => `
            <button type="button" class="tour-view-button${index === 0 ? " is-active" : ""}" data-model-preset="${preset.key}">${preset.label}</button>
          `).join("")}
        </div>
        <div class="viewer-chip-row viewer-chip-row-secondary">
          <button type="button" class="viewer-action-button" id="modelOrbitButton">Auto orbit</button>
          <button type="button" class="viewer-action-button" id="modelCinematicButton">Cinematic</button>
          <button type="button" class="viewer-action-button" id="modelResetButton">Reset</button>
        </div>
        <p id="modelStatus" class="viewer-status">${MODEL_PRESETS[0].detail}</p>
        <p class="viewer-hint">Rotate with one finger or mouse drag. Pinch or scroll to zoom. Autoplay gives a hands-free showroom pass.</p>
      </div>
    </section>
  `;
}

function renderTourSummary(vehicle) {
  if (hasGeneratedModel(vehicle)) {
    return vehicle.generatedModelSummary;
  }

  return "This listing includes the touch-first 360 interior sample. The generated exterior pipeline is demonstrated on the featured Atlas EV.";
}

function openVehicleModal(vehicleId) {
  const vehicle = vehicles.find((item) => item.id === vehicleId);
  if (!vehicle) {
    return;
  }

  disposeActiveViewer?.();
  disposeActiveViewer = null;

  els.modalContent.innerHTML = `
    <div class="modal-layout">
      <section class="modal-media">
        <div class="modal-photo-panel">
          ${renderVehiclePhoto(vehicle, "modal-photo")}
          <div class="photo-caption">Vehicle photo</div>
        </div>
        <div class="tour-shell">
          <div class="viewer-switcher" role="tablist" aria-label="Vehicle media modes">
            ${renderViewerTabs(vehicle)}
          </div>
          ${renderInteriorViewer()}
          ${renderModelViewer(vehicle)}
        </div>
      </section>
      <section class="modal-copy">
        <div class="modal-tags">${vehicle.badges.map((badge) => `<span>${badge}</span>`).join("")}</div>
        <div>
          <h2>${vehicleName(vehicle)}</h2>
          <p class="modal-meta">${vehicle.stock} • VIN ${vehicle.vin} • <span class="status-good">${vehicle.availability}</span></p>
        </div>
        <div class="modal-price">${currency(vehicle.price)}</div>
        <p>${vehicle.dealerNote}</p>
        <ul class="inventory-specs">
          <li>${vehicle.condition}</li>
          <li>${compactNumber(vehicle.mileage)} mi</li>
          <li>${vehicle.transmission}</li>
          <li>${vehicle.range}</li>
          <li>${vehicle.drivetrain}</li>
          <li>${vehicle.interiorColor}</li>
        </ul>
        <div>
          <strong>Packages</strong>
          <p class="modal-meta">${vehicle.packages.join(" • ")}</p>
        </div>
        <div>
          <strong>Top features</strong>
          <p class="modal-meta">${vehicle.features.join(" • ")}</p>
        </div>
        <div class="tour-panel">
          <strong>Virtual showroom</strong>
          <p class="modal-meta">${renderTourSummary(vehicle)}</p>
          <ul class="tour-bullets">
            <li>Interior mode supports swipe, drag, pinch, zoom, and autoplay.</li>
            <li>Generated exterior mode uses a static glTF built offline from multiple 2D source images.</li>
            <li>The website stays fully static and deployable on GitHub Pages.</li>
          </ul>
        </div>
        <button class="cta-primary" type="button" id="modalDriveButton">Reserve this vehicle</button>
      </section>
    </div>
  `;

  els.vehicleModal.showModal();

  setupVehicleExperience(vehicle).then((dispose) => {
    if (!els.vehicleModal.open) {
      dispose?.();
      return;
    }
    disposeActiveViewer = dispose;
  });

  document.querySelector("#modalDriveButton")?.addEventListener("click", () => {
    els.vehicleModal.close();
    els.driveVehicleSelect.value = vehicle.id;
    document.querySelector("#tools")?.scrollIntoView({ behavior: "smooth" });
  });
}

async function ensureThree() {
  if (!threeModulePromise) {
    threeModulePromise = import("./vendor/three/build/three.module.js");
  }

  return threeModulePromise;
}

async function ensureModelViewer(timeoutMs = 6000) {
  if (customElements.get("model-viewer")) {
    return;
  }

  const deadline = Date.now() + timeoutMs;
  while (!customElements.get("model-viewer") && Date.now() < deadline) {
    await Promise.race([
      customElements.whenDefined("model-viewer"),
      new Promise((resolve) => window.setTimeout(resolve, 50))
    ]);
  }

  if (!customElements.get("model-viewer")) {
    throw new Error("model-viewer did not finish registering.");
  }
}

async function setupPanoramaExperience(vehicle) {
  const mount = document.querySelector("#panoramaRoot");
  const statusEl = document.querySelector("#tourStatus");
  const presetButtons = [...document.querySelectorAll("[data-interior-preset]")];
  const autoplayButton = document.querySelector("#interiorAutoplayButton");
  const zoomInButton = document.querySelector("#interiorZoomInButton");
  const zoomOutButton = document.querySelector("#interiorZoomOutButton");
  const resetButton = document.querySelector("#interiorResetButton");

  if (!mount || !statusEl) {
    return null;
  }

  let viewer = null;
  let autoplay = false;
  let disposed = false;
  let frameId = 0;
  let lastFrameTime = 0;
  let width = mount.clientWidth || 640;
  let height = mount.clientHeight || 400;
  let currentYaw = INTERIOR_PRESETS[0].yaw;
  let currentPitch = INTERIOR_PRESETS[0].pitch;
  let targetYaw = currentYaw;
  let targetPitch = currentPitch;
  let targetFov = INTERIOR_PRESETS[0].hfov;
  let inertiaYaw = 0;
  let inertiaPitch = 0;
  let isPointerDragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let touchMode = "none";
  let pinchStartDistance = 0;
  let pinchStartFov = targetFov;
  let pinchStartCenterX = 0;
  let pinchStartCenterY = 0;

  try {
    const THREE = await ensureThree();
    mount.innerHTML = "";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(targetFov, width / height, 1, 1100);
    camera.position.set(0, 0, 0.1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(500, 80, 60);
    geometry.scale(-1, 1, 1);

    const texture = await new THREE.TextureLoader().loadAsync(vehicle.interiorPanorama || DEFAULT_INTERIOR_PANORAMA);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    viewer = {
      renderer,
      scene,
      camera,
      geometry,
      material,
      texture,
      THREE
    };
  } catch (error) {
    console.error("Failed to load the interior panorama.", error);
    mount.innerHTML = `<div class="viewer-loading viewer-loading-error">The 360 interior could not be loaded.</div>`;
    statusEl.textContent = "The 360 interior viewer could not be initialized in this browser session.";
    return null;
  }

  function setInteriorButtonState(activeKey) {
    presetButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.interiorPreset === activeKey);
    });
  }

  function setAutoplayState(nextState) {
    autoplay = nextState;
    autoplayButton?.classList.toggle("is-active", autoplay);
    if (autoplayButton) {
      autoplayButton.textContent = autoplay ? "Stop orbit" : "Auto orbit";
    }
  }

  function setPreset(presetKey, duration = 900) {
    const preset = INTERIOR_PRESETS.find((item) => item.key === presetKey) || INTERIOR_PRESETS[0];
    statusEl.textContent = preset.detail;
    setInteriorButtonState(preset.key);
    targetYaw = preset.yaw;
    targetPitch = preset.pitch;
    targetFov = clamp(preset.hfov, INTERIOR_HFOV_MIN, INTERIOR_HFOV_MAX);
    if (duration === 0 && viewer) {
      currentYaw = targetYaw;
      currentPitch = targetPitch;
      viewer.camera.fov = targetFov;
      viewer.camera.updateProjectionMatrix();
    }
  }

  function handleInteriorPresetClick(event) {
    setAutoplayState(false);
    setPreset(event.currentTarget.dataset.interiorPreset);
  }

  function handleZoom(delta) {
    if (!viewer) {
      return;
    }
    targetFov = clamp(targetFov + delta, INTERIOR_HFOV_MIN, INTERIOR_HFOV_MAX);
  }

  function handleReset() {
    setAutoplayState(false);
    setPreset(INTERIOR_PRESETS[0].key, 500);
  }

  function getLookVector(yawDeg, pitchDeg) {
    const phi = viewer.THREE.MathUtils.degToRad(90 - pitchDeg);
    const theta = viewer.THREE.MathUtils.degToRad(yawDeg);
    return {
      x: 500 * Math.sin(phi) * Math.cos(theta),
      y: 500 * Math.cos(phi),
      z: 500 * Math.sin(phi) * Math.sin(theta)
    };
  }

  function getTouchDistance(touches) {
    const [first, second] = touches;
    const dx = first.clientX - second.clientX;
    const dy = first.clientY - second.clientY;
    return Math.hypot(dx, dy);
  }

  function getTouchCenter(touches) {
    const [first, second] = touches;
    return {
      x: (first.clientX + second.clientX) / 2,
      y: (first.clientY + second.clientY) / 2
    };
  }

  function handlePointerDown(event) {
    if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") {
      return;
    }
    isPointerDragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    inertiaYaw = 0;
    inertiaPitch = 0;
    mount.classList.add("is-dragging");
  }

  function handlePointerMove(event) {
    if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") {
      return;
    }
    if (!isPointerDragging) {
      return;
    }

    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    targetYaw -= deltaX * 0.16;
    targetPitch = clamp(targetPitch - deltaY * 0.12, -76, 76);
    inertiaYaw = -deltaX * 0.38;
    inertiaPitch = -deltaY * 0.28;
  }

  function handlePointerUp() {
    isPointerDragging = false;
    mount.classList.remove("is-dragging");
  }

  function handleTouchStart(event) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchMode = "rotate";
      lastPointerX = touch.clientX;
      lastPointerY = touch.clientY;
      inertiaYaw = 0;
      inertiaPitch = 0;
    } else if (event.touches.length >= 2) {
      touchMode = "pinch";
      pinchStartDistance = getTouchDistance(event.touches);
      pinchStartFov = targetFov;
      const center = getTouchCenter(event.touches);
      pinchStartCenterX = center.x;
      pinchStartCenterY = center.y;
    }
  }

  function handleTouchMove(event) {
    if (touchMode === "rotate" && event.touches.length === 1) {
      event.preventDefault();
      const touch = event.touches[0];
      const deltaX = touch.clientX - lastPointerX;
      const deltaY = touch.clientY - lastPointerY;
      lastPointerX = touch.clientX;
      lastPointerY = touch.clientY;
      targetYaw -= deltaX * 0.18;
      targetPitch = clamp(targetPitch - deltaY * 0.13, -76, 76);
      inertiaYaw = -deltaX * 0.42;
      inertiaPitch = -deltaY * 0.3;
    }

    if (event.touches.length >= 2) {
      event.preventDefault();
      touchMode = "pinch";
      const distance = getTouchDistance(event.touches);
      const center = getTouchCenter(event.touches);
      const scale = pinchStartDistance / Math.max(distance, 1);
      targetFov = clamp(pinchStartFov * scale, INTERIOR_HFOV_MIN, INTERIOR_HFOV_MAX);
      targetYaw -= (center.x - pinchStartCenterX) * 0.08;
      targetPitch = clamp(targetPitch - (center.y - pinchStartCenterY) * 0.06, -76, 76);
      pinchStartCenterX = center.x;
      pinchStartCenterY = center.y;
      pinchStartDistance = distance;
      pinchStartFov = targetFov;
    }
  }

  function handleTouchEnd(event) {
    if (!event.touches.length) {
      touchMode = "none";
      return;
    }

    if (event.touches.length === 1) {
      touchMode = "rotate";
      lastPointerX = event.touches[0].clientX;
      lastPointerY = event.touches[0].clientY;
      return;
    }

    touchMode = "pinch";
    pinchStartDistance = getTouchDistance(event.touches);
    pinchStartFov = targetFov;
  }

  function handleWheel(event) {
    event.preventDefault();
    targetFov = clamp(targetFov + (event.deltaY > 0 ? 4 : -4), INTERIOR_HFOV_MIN, INTERIOR_HFOV_MAX);
  }

  function handleResize() {
    if (!viewer || !mount.isConnected) {
      return;
    }

    width = mount.clientWidth || width;
    height = mount.clientHeight || height;
    viewer.camera.aspect = width / height;
    viewer.camera.updateProjectionMatrix();
    viewer.renderer.setSize(width, height, false);
  }

  function animate(timestamp) {
    if (disposed || !viewer) {
      return;
    }

    const deltaSeconds = lastFrameTime ? (timestamp - lastFrameTime) / 1000 : 0.016;
    lastFrameTime = timestamp;

    if (autoplay && !isPointerDragging && touchMode === "none") {
      targetYaw += 10 * deltaSeconds;
    } else if (!isPointerDragging && touchMode === "none") {
      targetYaw += inertiaYaw * deltaSeconds * 60;
      targetPitch = clamp(targetPitch + (inertiaPitch * deltaSeconds * 60), -76, 76);
      inertiaYaw *= 0.92;
      inertiaPitch *= 0.9;
    }

    currentYaw += (targetYaw - currentYaw) * 0.12;
    currentPitch += (targetPitch - currentPitch) * 0.12;
    viewer.camera.fov += (targetFov - viewer.camera.fov) * 0.14;
    viewer.camera.updateProjectionMatrix();

    const lookVector = getLookVector(currentYaw, currentPitch);
    viewer.camera.lookAt(lookVector.x, lookVector.y, lookVector.z);
    viewer.renderer.render(viewer.scene, viewer.camera);
    frameId = window.requestAnimationFrame(animate);
  }

  presetButtons.forEach((button) => button.addEventListener("click", handleInteriorPresetClick));
  const handleAutoplayToggle = () => setAutoplayState(!autoplay);
  const handleZoomIn = () => handleZoom(-10);
  const handleZoomOut = () => handleZoom(10);

  mount.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  mount.addEventListener("touchstart", handleTouchStart, { passive: true });
  mount.addEventListener("touchmove", handleTouchMove, { passive: false });
  mount.addEventListener("touchend", handleTouchEnd);
  mount.addEventListener("touchcancel", handleTouchEnd);
  mount.addEventListener("wheel", handleWheel, { passive: false });
  window.addEventListener("resize", handleResize);

  autoplayButton?.addEventListener("click", handleAutoplayToggle);
  zoomInButton?.addEventListener("click", handleZoomIn);
  zoomOutButton?.addEventListener("click", handleZoomOut);
  resetButton?.addEventListener("click", handleReset);

  setPreset(INTERIOR_PRESETS[0].key, 0);
  frameId = window.requestAnimationFrame(animate);

  return () => {
    disposed = true;
    setAutoplayState(false);
    window.cancelAnimationFrame(frameId);
    presetButtons.forEach((button) => button.removeEventListener("click", handleInteriorPresetClick));
    autoplayButton?.removeEventListener("click", handleAutoplayToggle);
    zoomInButton?.removeEventListener("click", handleZoomIn);
    zoomOutButton?.removeEventListener("click", handleZoomOut);
    resetButton?.removeEventListener("click", handleReset);
    mount.removeEventListener("pointerdown", handlePointerDown);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    mount.removeEventListener("touchstart", handleTouchStart);
    mount.removeEventListener("touchmove", handleTouchMove);
    mount.removeEventListener("touchend", handleTouchEnd);
    mount.removeEventListener("touchcancel", handleTouchEnd);
    mount.removeEventListener("wheel", handleWheel);
    window.removeEventListener("resize", handleResize);

    viewer?.texture.dispose();
    viewer?.material.dispose();
    viewer?.geometry.dispose();
    viewer?.renderer.dispose();
    mount.innerHTML = "";
  };
}

async function setupModelViewerExperience(vehicle) {
  const modelViewer = document.querySelector("#generatedModelViewer");
  const loadingState = document.querySelector("#modelLoadingState");
  const statusEl = document.querySelector("#modelStatus");
  const presetButtons = [...document.querySelectorAll("[data-model-preset]")];
  const orbitButton = document.querySelector("#modelOrbitButton");
  const cinematicButton = document.querySelector("#modelCinematicButton");
  const resetButton = document.querySelector("#modelResetButton");

  if (!modelViewer || !statusEl) {
    return null;
  }

  try {
    await ensureModelViewer();
  } catch (error) {
    console.error("Failed to load the generated 3D viewer.", error);
    loadingState?.classList.add("viewer-loading-error");
    if (loadingState) {
      loadingState.textContent = "The generated 3D model could not be loaded.";
    }
    statusEl.textContent = "The generated exterior viewer could not be initialized in this browser session.";
    return null;
  }

  let cinematicFrame = 0;
  let cinematicActive = false;
  let orbitActive = false;

  function setModelButtonState(activeKey) {
    presetButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.modelPreset === activeKey);
    });
  }

  function setOrbitState(nextState) {
    orbitActive = nextState;
    modelViewer.toggleAttribute("auto-rotate", orbitActive);
    orbitButton?.classList.toggle("is-active", orbitActive);
    if (orbitButton) {
      orbitButton.textContent = orbitActive ? "Stop orbit" : "Auto orbit";
    }
  }

  function stopCinematic(preserveStatus = false) {
    cinematicActive = false;
    if (cinematicFrame) {
      window.cancelAnimationFrame(cinematicFrame);
      cinematicFrame = 0;
    }
    cinematicButton?.classList.remove("is-active");
    if (cinematicButton) {
      cinematicButton.textContent = "Cinematic";
    }
    if (!preserveStatus) {
      statusEl.textContent = MODEL_PRESETS[0].detail;
    }
  }

  function setPreset(presetKey) {
    const preset = MODEL_PRESETS.find((item) => item.key === presetKey) || MODEL_PRESETS[0];
    setModelButtonState(preset.key);
    statusEl.textContent = preset.detail;
    modelViewer.cameraOrbit = preset.orbit;
  }

  function handleModelPresetClick(event) {
    stopCinematic(true);
    setOrbitState(false);
    setPreset(event.currentTarget.dataset.modelPreset);
  }

  function resetModelView() {
    stopCinematic(true);
    setOrbitState(false);
    setPreset(MODEL_PRESETS[0].key);
    modelViewer.jumpCameraToGoal?.();
  }

  function runCinematic() {
    stopCinematic(true);
    setOrbitState(false);
    cinematicActive = true;
    cinematicButton?.classList.add("is-active");
    if (cinematicButton) {
      cinematicButton.textContent = "Stop cinematic";
    }
    statusEl.textContent = "Cinematic sweep is running. The camera is orbiting and easing like a product video.";

    const startTime = performance.now();
    const animate = (timestamp) => {
      if (!cinematicActive) {
        return;
      }

      const elapsed = (timestamp - startTime) / 1000;
      const azimuth = -28 + (elapsed * 18);
      const polar = 72 + Math.sin(elapsed * 0.7) * 8;
      const radius = 108 + Math.sin(elapsed * 0.45) * 10;
      modelViewer.cameraOrbit = `${azimuth.toFixed(1)}deg ${polar.toFixed(1)}deg ${radius.toFixed(1)}%`;
      cinematicFrame = window.requestAnimationFrame(animate);
    };

    cinematicFrame = window.requestAnimationFrame(animate);
  }

  function toggleCinematic() {
    if (cinematicActive) {
      stopCinematic(true);
      setPreset(MODEL_PRESETS[0].key);
      return;
    }

    runCinematic();
  }

  const onLoad = () => {
    loadingState?.classList.add("is-hidden");
    resetModelView();
  };

  const onError = () => {
    if (loadingState) {
      loadingState.classList.remove("is-hidden");
      loadingState.classList.add("viewer-loading-error");
      loadingState.textContent = "The generated 3D model failed to render.";
    }
    statusEl.textContent = "The generated exterior viewer failed to render.";
  };

  const handleOrbitToggle = () => {
    stopCinematic(true);
    setOrbitState(!orbitActive);
    if (orbitActive) {
      statusEl.textContent = "Hands-free orbit is running so the model reads like a rotating product reel.";
    } else {
      statusEl.textContent = MODEL_PRESETS[0].detail;
    }
  };

  modelViewer.addEventListener("load", onLoad);
  modelViewer.addEventListener("error", onError);
  presetButtons.forEach((button) => button.addEventListener("click", handleModelPresetClick));
  orbitButton?.addEventListener("click", handleOrbitToggle);
  cinematicButton?.addEventListener("click", toggleCinematic);
  resetButton?.addEventListener("click", resetModelView);

  setPreset(MODEL_PRESETS[0].key);

  return () => {
    stopCinematic(true);
    setOrbitState(false);
    presetButtons.forEach((button) => button.removeEventListener("click", handleModelPresetClick));
    modelViewer.removeEventListener("load", onLoad);
    modelViewer.removeEventListener("error", onError);
    orbitButton?.removeEventListener("click", handleOrbitToggle);
    cinematicButton?.removeEventListener("click", toggleCinematic);
    resetButton?.removeEventListener("click", resetModelView);
  };
}

async function setupVehicleExperience(vehicle) {
  const tabButtons = [...document.querySelectorAll("[data-viewer-tab]")];
  const panels = [...document.querySelectorAll("[data-viewer-panel]")];
  const cleanupHandlers = [];

  function activateViewer(viewKey) {
    tabButtons.forEach((button) => {
      const active = button.dataset.viewerTab === viewKey;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });

    panels.forEach((panel) => {
      const active = panel.dataset.viewerPanel === viewKey;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
  }

  function handleTabClick(event) {
    activateViewer(event.currentTarget.dataset.viewerTab);
  }

  tabButtons.forEach((button) => button.addEventListener("click", handleTabClick));
  cleanupHandlers.push(() => tabButtons.forEach((button) => button.removeEventListener("click", handleTabClick)));

  activateViewer(INTERIOR_VIEW);

  const panoramaCleanup = await setupPanoramaExperience(vehicle);
  if (panoramaCleanup) {
    cleanupHandlers.push(panoramaCleanup);
  }

  const modelCleanup = await setupModelViewerExperience(vehicle);
  if (modelCleanup) {
    cleanupHandlers.push(modelCleanup);
  }

  return () => {
    cleanupHandlers.reverse().forEach((cleanup) => cleanup?.());
  };
}

function initializeFilters() {
  populateSelect(els.conditionFilter, [...new Set(vehicles.map((vehicle) => vehicle.condition))]);
  populateSelect(els.bodyFilter, [...new Set(vehicles.map((vehicle) => vehicle.bodyStyle))]);
  populateSelect(els.fuelFilter, [...new Set(vehicles.map((vehicle) => vehicle.fuel))]);
  populateSelect(els.drivetrainFilter, [...new Set(vehicles.map((vehicle) => vehicle.drivetrain))]);
  els.featureFilters.innerHTML = featureOptions
    .map((feature) => `<button class="feature-chip" type="button" data-feature="${feature}">${feature}</button>`)
    .join("");
  els.driveVehicleSelect.innerHTML = vehicles
    .map((vehicle) => `<option value="${vehicle.id}">${vehicleName(vehicle)}</option>`)
    .join("");
}

function resetFilters() {
  state.query = "";
  state.condition = "All";
  state.bodyStyle = "All";
  state.fuel = "All";
  state.drivetrain = "All";
  state.maxPrice = 95000;
  state.maxPayment = 1500;
  state.activeFeatures.clear();
  state.sort = "featured";

  els.searchInput.value = "";
  els.conditionFilter.value = "All";
  els.bodyFilter.value = "All";
  els.fuelFilter.value = "All";
  els.drivetrainFilter.value = "All";
  els.priceFilter.value = String(state.maxPrice);
  els.paymentFilter.value = String(state.maxPayment);
  els.priceOutput.value = currency(state.maxPrice);
  els.paymentOutput.value = `${currency(state.maxPayment)}/mo`;
  els.sortButton.textContent = "Sort: Featured";
  document.querySelectorAll(".feature-chip").forEach((chip) => chip.classList.remove("active"));
  renderInventory();
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderInventory();
  });

  els.conditionFilter.addEventListener("change", (event) => {
    state.condition = event.target.value;
    renderInventory();
  });

  els.bodyFilter.addEventListener("change", (event) => {
    state.bodyStyle = event.target.value;
    renderInventory();
  });

  els.fuelFilter.addEventListener("change", (event) => {
    state.fuel = event.target.value;
    renderInventory();
  });

  els.drivetrainFilter.addEventListener("change", (event) => {
    state.drivetrain = event.target.value;
    renderInventory();
  });

  els.priceFilter.addEventListener("input", (event) => {
    state.maxPrice = Number(event.target.value);
    els.priceOutput.value = currency(state.maxPrice);
    renderInventory();
  });

  els.paymentFilter.addEventListener("input", (event) => {
    state.maxPayment = Number(event.target.value);
    els.paymentOutput.value = `${currency(state.maxPayment)}/mo`;
    renderInventory();
  });

  els.featureFilters.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-feature]");
    if (!chip) {
      return;
    }

    const { feature } = chip.dataset;
    if (state.activeFeatures.has(feature)) {
      state.activeFeatures.delete(feature);
      chip.classList.remove("active");
    } else {
      state.activeFeatures.add(feature);
      chip.classList.add("active");
    }
    renderInventory();
  });

  els.resetFilters.addEventListener("click", resetFilters);
  els.sortButton.addEventListener("click", rotateSort);
  els.heroTourButton.addEventListener("click", () => openVehicleModal("NSM-2401"));
  els.closeModalButton.addEventListener("click", () => els.vehicleModal.close());
  els.vehicleModal.addEventListener("click", (event) => {
    if (event.target === els.vehicleModal) {
      els.vehicleModal.close();
    }
  });
  els.vehicleModal.addEventListener("close", () => {
    disposeActiveViewer?.();
    disposeActiveViewer = null;
  });

  els.inventoryGrid.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    if (button.dataset.action === "details") {
      openVehicleModal(button.dataset.id);
    }

    if (button.dataset.action === "favorite") {
      toggleFavorite(button.dataset.id);
    }
  });

  els.financeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(els.financeForm);
    const monthly = paymentEstimate(
      Number(data.get("price")),
      Number(data.get("down")),
      Number(data.get("apr")),
      Number(data.get("term"))
    );
    els.financeOutput.textContent = `Estimated payment: ${currency(monthly)}/month before taxes and fees.`;
  });

  els.tradeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(els.tradeForm);
    const estimate = estimateTradeIn(Number(data.get("miles")), data.get("condition"));
    els.tradeOutput.textContent = `${data.get("vehicle")} estimated trade-in value: ${currency(estimate)}.`;
  });

  els.driveForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(els.driveForm);
    const vehicle = vehicles.find((item) => item.id === data.get("vehicle"));
    els.driveOutput.textContent = `${data.get("name")}, your test drive request for ${vehicleName(vehicle)} on ${data.get("date")} has been staged.`;
  });
}

initializeFilters();
renderFeatured();
saveFavorites();
resetFilters();
bindEvents();

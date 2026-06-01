import { featureOptions, sortOptions, vehicles } from "./data.js";

const INTERIOR_PANORAMA = "./assets/panoramas/vehicle-interior-360.png";
const INTERIOR_PRESETS = [
  { key: "dash", label: "Dashboard", detail: "Forward view from the front seats with the dash, steering wheel, and screens centered.", lon: 0, lat: -2 },
  { key: "driver", label: "Driver Seat", detail: "Look left toward the steering wheel and driver controls.", lon: -42, lat: -4 },
  { key: "passenger", label: "Passenger Side", detail: "Look right across the dash and front passenger door.", lon: 42, lat: -4 },
  { key: "rear", label: "Rear Seats", detail: "Turn around to inspect rear seating and cabin width.", lon: 180, lat: -2 },
  { key: "roof", label: "Roofline", detail: "Tilt upward to inspect the headliner and upper glass area.", lon: 0, lat: 58 }
];

let threeModulePromise = null;
let disposeActiveViewer = null;

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

function vehicleName(vehicle) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`;
}

function renderVehiclePhoto(vehicle, className = "vehicle-photo") {
  return `<img class="${className}" src="${vehicle.photo}" alt="${vehicleName(vehicle)} photo" loading="lazy">`;
}

function populateSelect(select, values) {
  select.innerHTML = ["All", ...values].map((value) => `<option value="${value}">${value}</option>`).join("");
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
          <div class="photo-caption">Inventory photo</div>
        </div>
        <div class="modal-viewer">
          <div id="threeRoot" class="panorama-root">
            <div class="viewer-loading">Loading interior 360...</div>
          </div>
          <div class="viewer-overlay">
            <div class="viewer-toolbar">
              ${INTERIOR_PRESETS.map((preset, index) => `
                <button type="button" class="tour-view-button${index === 0 ? " is-active" : ""}" data-preset="${preset.key}">${preset.label}</button>
              `).join("")}
            </div>
            <div class="viewer-toolbar">
              <button type="button" id="zoomInButton">Zoom in</button>
              <button type="button" id="zoomOutButton">Zoom out</button>
            </div>
          </div>
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
          <strong>360 interior tour</strong>
          <p id="tourStatus" class="modal-meta">${INTERIOR_PRESETS[0].detail}</p>
          <p class="modal-meta">Drag to look around the cabin. Use your mouse wheel or the zoom buttons to inspect details.</p>
        </div>
        <button class="cta-primary" type="button" id="modalDriveButton">Reserve this vehicle</button>
      </section>
    </div>
  `;

  els.vehicleModal.showModal();
  setupPanoramaViewer().then((dispose) => {
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
    threeModulePromise = import("https://unpkg.com/three@0.165.0/build/three.module.js");
  }
  return threeModulePromise;
}

async function setupPanoramaViewer() {
  const mount = document.querySelector("#threeRoot");
  const statusEl = document.querySelector("#tourStatus");
  const presetButtons = [...document.querySelectorAll("[data-preset]")];
  const zoomInButton = document.querySelector("#zoomInButton");
  const zoomOutButton = document.querySelector("#zoomOutButton");

  if (!mount || !statusEl) {
    return null;
  }

  try {
    const THREE = await ensureThree();
    mount.innerHTML = "";

    const width = mount.clientWidth || mount.parentElement.clientWidth || 640;
    const height = mount.clientHeight || mount.parentElement.clientHeight || 360;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 1, 1100);
    camera.position.set(0, 0, 0.1);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    const texture = await new THREE.TextureLoader().loadAsync(INTERIOR_PANORAMA);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    let lon = 0;
    let lat = -2;
    let targetLon = lon;
    let targetLat = lat;
    let isPointerDown = false;
    let pointerX = 0;
    let pointerY = 0;
    let startLon = 0;
    let startLat = 0;
    let frameId = 0;
    let disposed = false;

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function setPreset(presetKey) {
      const preset = INTERIOR_PRESETS.find((item) => item.key === presetKey) || INTERIOR_PRESETS[0];
      targetLon = preset.lon;
      targetLat = preset.lat;
      statusEl.textContent = preset.detail;
      presetButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.preset === preset.key);
      });
    }

    function adjustFov(delta) {
      camera.fov = clamp(camera.fov + delta, 35, 90);
      camera.updateProjectionMatrix();
    }

    function onPointerDown(event) {
      isPointerDown = true;
      mount.classList.add("is-dragging");
      pointerX = event.clientX;
      pointerY = event.clientY;
      startLon = targetLon;
      startLat = targetLat;
    }

    function onPointerMove(event) {
      if (!isPointerDown) {
        return;
      }
      targetLon = startLon + (pointerX - event.clientX) * 0.12;
      targetLat = clamp(startLat + (event.clientY - pointerY) * 0.12, -75, 75);
    }

    function onPointerUp() {
      isPointerDown = false;
      mount.classList.remove("is-dragging");
    }

    function onWheel(event) {
      event.preventDefault();
      adjustFov(event.deltaY > 0 ? 3 : -3);
    }

    function onResize() {
      if (!mount.isConnected) {
        return;
      }
      const nextWidth = mount.clientWidth || mount.parentElement.clientWidth || width;
      const nextHeight = mount.clientHeight || mount.parentElement.clientHeight || height;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    }

    function animate() {
      if (disposed) {
        return;
      }
      frameId = window.requestAnimationFrame(animate);
      lon += (targetLon - lon) * 0.1;
      lat += (targetLat - lat) * 0.1;

      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lon);
      const x = 500 * Math.sin(phi) * Math.cos(theta);
      const y = 500 * Math.cos(phi);
      const z = 500 * Math.sin(phi) * Math.sin(theta);

      camera.lookAt(x, y, z);
      renderer.render(scene, camera);
    }

    function handlePresetClick(event) {
      const button = event.currentTarget;
      setPreset(button.dataset.preset);
    }

    mount.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    mount.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", onResize);
    presetButtons.forEach((button) => button.addEventListener("click", handlePresetClick));
    zoomInButton?.addEventListener("click", () => adjustFov(-6));
    zoomOutButton?.addEventListener("click", () => adjustFov(6));

    setPreset(INTERIOR_PRESETS[0].key);
    animate();

    return () => {
      if (disposed) {
        return;
      }
      disposed = true;
      window.cancelAnimationFrame(frameId);
      mount.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      mount.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      presetButtons.forEach((button) => button.removeEventListener("click", handlePresetClick));
      texture.dispose();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
      mount.innerHTML = "";
    };
  } catch (error) {
    console.error("Failed to load the 360 viewer.", error);
    mount.innerHTML = `<div class="viewer-loading viewer-loading-error">The 360 viewer failed to load.</div>`;
    statusEl.textContent = "The interior panorama could not be loaded in this browser session.";
    return null;
  }
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

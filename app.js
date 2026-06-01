import { featureOptions, sortOptions, vehicles } from "./data.js";
import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js";

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
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function compactNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function vehicleName(vehicle) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`;
}

function createVehicleSVG(vehicle) {
  return `
    <svg class="vehicle-svg" viewBox="0 0 640 360" role="img" aria-label="${vehicleName(vehicle)}">
      <defs>
        <linearGradient id="body-${vehicle.id}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${vehicle.exteriorColor}"/>
          <stop offset="100%" stop-color="#1f2a2e"/>
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill="transparent"/>
      <ellipse cx="320" cy="300" rx="210" ry="28" fill="rgba(26,34,37,0.16)"/>
      <path d="M135 226 C160 182, 215 150, 305 142 L420 136 C470 134, 520 170, 550 214 L575 248 L120 248 Z" fill="url(#body-${vehicle.id})"/>
      <path d="M208 170 L310 156 L424 152 C455 152, 495 180, 515 212 L377 212 L330 175 L230 175 Z" fill="rgba(255,255,255,0.16)"/>
      <circle cx="210" cy="252" r="37" fill="#1f2a2e"/>
      <circle cx="490" cy="252" r="37" fill="#1f2a2e"/>
      <circle cx="210" cy="252" r="18" fill="#d7dadd"/>
      <circle cx="490" cy="252" r="18" fill="#d7dadd"/>
      <rect x="182" y="185" width="145" height="42" rx="12" fill="rgba(226,238,242,0.75)"/>
      <rect x="340" y="182" width="110" height="42" rx="12" fill="rgba(226,238,242,0.75)"/>
      <rect x="520" y="215" width="28" height="10" rx="4" fill="#ffe2a6"/>
      <rect x="135" y="219" width="24" height="11" rx="4" fill="#ffb39a"/>
      <text x="42" y="60" fill="#1f2a2e" font-size="22" font-family="Manrope, sans-serif" font-weight="800">${vehicle.make.toUpperCase()}</text>
      <text x="42" y="90" fill="#617074" font-size="18" font-family="Manrope, sans-serif">${vehicle.model} ${vehicle.trim}</text>
    </svg>
  `;
}

function populateSelect(select, values) {
  select.innerHTML = ["All", ...values].map((value) => `<option value="${value}">${value}</option>`).join("");
}

function renderFeatured() {
  const featured = vehicles.find((vehicle) => vehicle.featured) || vehicles[0];
  els.featuredVehicleTitle.textContent = vehicleName(featured);
  els.featuredVehicleMeta.textContent = `${currency(featured.price)} • ${featured.range} • ${featured.drivetrain} • Stock ${featured.stock}`;
  els.featuredVehicleTags.innerHTML = featured.badges.map((badge) => `<span>${badge}</span>`).join("");
  els.featuredVehicleArt.innerHTML = createVehicleSVG(featured);
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
      <div class="inventory-art">${createVehicleSVG(vehicle)}</div>
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

  els.modalContent.innerHTML = `
    <div class="modal-layout">
      <section>
        <div class="modal-viewer">
          <div id="threeRoot"></div>
          <div class="viewer-overlay">
            <button type="button" id="paintToggle">Change paint</button>
            <button type="button" id="spinToggle">Auto rotate</button>
            <span class="tag">Interactive 3D demo</span>
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
        <div>
          <strong>3D tour hotspots</strong>
          <ul class="hotspot-list">${vehicle.hotspots.map((item) => `<li class="tag">${item}</li>`).join("")}</ul>
        </div>
        <button class="cta-primary" type="button" id="modalDriveButton">Reserve this vehicle</button>
      </section>
    </div>
  `;

  els.vehicleModal.showModal();
  setupThreeViewer(vehicle);

  document.querySelector("#modalDriveButton")?.addEventListener("click", () => {
    els.vehicleModal.close();
    els.driveVehicleSelect.value = vehicle.id;
    document.querySelector("#tools")?.scrollIntoView({ behavior: "smooth" });
  });
}

function setupThreeViewer(vehicle) {
  const mount = document.querySelector("#threeRoot");
  if (!mount) {
    return;
  }

  mount.innerHTML = "";
  const width = mount.parentElement.clientWidth;
  const height = mount.parentElement.clientHeight;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe8ecec, 10, 24);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(5.6, 2.8, 6.6);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  mount.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 4;
  controls.maxDistance = 11;
  controls.target.set(0, 1.2, 0);

  const ambient = new THREE.HemisphereLight(0xffffff, 0x425257, 1.25);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(4, 8, 6);
  scene.add(key);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(8, 64),
    new THREE.MeshStandardMaterial({ color: 0xf4efe7, metalness: 0.1, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  scene.add(floor);

  const turntable = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 3.6, 0.18, 48),
    new THREE.MeshStandardMaterial({ color: 0xdad4ca, metalness: 0.2, roughness: 0.85 })
  );
  turntable.position.y = 0.04;
  scene.add(turntable);

  const car = buildProceduralVehicle(vehicle);
  car.position.y = 0.4;
  scene.add(car);

  let autoRotate = false;
  const paintToggle = document.querySelector("#paintToggle");
  const spinToggle = document.querySelector("#spinToggle");
  const alternatePaint = new THREE.Color("#114b5f");
  const originalPaint = new THREE.Color(vehicle.exteriorColor);
  let usingAlternate = false;

  paintToggle?.addEventListener("click", () => {
    usingAlternate = !usingAlternate;
    car.traverse((node) => {
      if (node.isMesh && node.userData.paintable) {
        node.material.color.copy(usingAlternate ? alternatePaint : originalPaint);
      }
    });
  });

  spinToggle?.addEventListener("click", () => {
    autoRotate = !autoRotate;
    spinToggle.textContent = autoRotate ? "Stop rotate" : "Auto rotate";
  });

  const onResize = () => {
    const nextWidth = mount.parentElement.clientWidth;
    const nextHeight = mount.parentElement.clientHeight;
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight);
  };

  const animate = () => {
    if (!els.vehicleModal.open) {
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      controls.dispose();
      return;
    }
    requestAnimationFrame(animate);
    if (autoRotate) {
      car.rotation.y += 0.01;
    }
    controls.update();
    renderer.render(scene, camera);
  };

  window.addEventListener("resize", onResize);
  animate();
}

function buildProceduralVehicle(vehicle) {
  const root = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: vehicle.exteriorColor, metalness: 0.35, roughness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xb9d3dd, transparent: true, opacity: 0.8, roughness: 0.2, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x232629, roughness: 0.7 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xd1d8dc, metalness: 0.75, roughness: 0.25 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.85, 2.05), paint);
  base.userData.paintable = true;
  base.position.y = 1;
  root.add(base);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.72, 1.72), paint);
  roof.userData.paintable = true;
  roof.position.set(0.1, 1.7, 0);
  root.add(roof);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.26, 1.82), paint);
  hood.userData.paintable = true;
  hood.position.set(1.72, 1.25, 0);
  hood.rotation.z = -0.14;
  root.add(hood);

  const rear = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.36, 1.82), paint);
  rear.userData.paintable = true;
  rear.position.set(-1.75, 1.22, 0);
  rear.rotation.z = 0.12;
  root.add(rear);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.46, 1.58), glass);
  windshield.position.set(0.86, 1.58, 0);
  windshield.rotation.z = -0.48;
  root.add(windshield);

  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 1.55), glass);
  rearWindow.position.set(-0.95, 1.55, 0);
  rearWindow.rotation.z = 0.52;
  root.add(rearWindow);

  const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.36, 0.04), glass);
  sideWindow.position.set(0.1, 1.62, 0.82);
  root.add(sideWindow);
  const sideWindow2 = sideWindow.clone();
  sideWindow2.position.z = -0.82;
  root.add(sideWindow2);

  const bumperFront = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 1.72), dark);
  bumperFront.position.set(2.38, 0.84, 0);
  root.add(bumperFront);

  const bumperRear = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 1.72), dark);
  bumperRear.position.set(-2.34, 0.84, 0);
  root.add(bumperRear);

  const grill = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.86), trim);
  grill.position.set(2.52, 1.06, 0);
  root.add(grill);

  [
    [1.6, 0.52, 1.02],
    [-1.6, 0.52, 1.02],
    [1.6, 0.52, -1.02],
    [-1.6, 0.52, -1.02]
  ].forEach(([x, y, z]) => {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.38, 28), dark);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(x, y, z);
    root.add(tire);

    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.4, 20), trim);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    root.add(wheel);
  });

  const roofPanel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.05), dark);
  roofPanel.position.set(0.05, 2.03, 0);
  root.add(roofPanel);

  return root;
}

function initializeFilters() {
  populateSelect(els.conditionFilter, [...new Set(vehicles.map((vehicle) => vehicle.condition))]);
  populateSelect(els.bodyFilter, [...new Set(vehicles.map((vehicle) => vehicle.bodyStyle))]);
  populateSelect(els.fuelFilter, [...new Set(vehicles.map((vehicle) => vehicle.fuel))]);
  populateSelect(els.drivetrainFilter, [...new Set(vehicles.map((vehicle) => vehicle.drivetrain))]);
  els.featureFilters.innerHTML = featureOptions.map((feature) => `<button class="feature-chip" type="button" data-feature="${feature}">${feature}</button>`).join("");
  els.driveVehicleSelect.innerHTML = vehicles.map((vehicle) => `<option value="${vehicle.id}">${vehicleName(vehicle)}</option>`).join("");
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
    const rect = els.vehicleModal.getBoundingClientRect();
    const inside = rect.top <= event.clientY && event.clientY <= rect.bottom && rect.left <= event.clientX && event.clientX <= rect.right;
    if (!inside) {
      els.vehicleModal.close();
    }
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

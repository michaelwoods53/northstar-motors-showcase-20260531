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

let disposeActiveViewer = null;

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
          <div class="photo-caption">Sample listing photo included with the project.</div>
        </div>
        <div class="modal-viewer">
          <div id="threeRoot"></div>
          <div class="viewer-overlay">
            <div class="viewer-toolbar">
              <button type="button" data-tour-view="exterior" class="tour-view-button is-active">Exterior</button>
              <button type="button" data-tour-view="cabin" class="tour-view-button">Cabin</button>
              <button type="button" data-tour-view="reset" class="tour-view-button">Reset</button>
            </div>
            <div class="viewer-toolbar">
              <button type="button" id="paintToggle">Change paint</button>
              <button type="button" id="spinToggle">Auto rotate</button>
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
          <strong>3D tour hotspots</strong>
          <div id="tourHotspots" class="tour-hotspots">
            ${vehicle.tourHotspots.map((hotspot) => `
              <button type="button" class="tour-hotspot-button" data-tour-view="${hotspot.view}">
                <span>${hotspot.label}</span>
                <small>${hotspot.detail}</small>
              </button>
            `).join("")}
          </div>
          <p id="tourStatus" class="modal-meta">${vehicle.tourHotspots[0].detail}</p>
        </div>
        <button class="cta-primary" type="button" id="modalDriveButton">Reserve this vehicle</button>
      </section>
    </div>
  `;

  els.vehicleModal.showModal();
  disposeActiveViewer = setupThreeViewer(vehicle);

  document.querySelector("#modalDriveButton")?.addEventListener("click", () => {
    els.vehicleModal.close();
    els.driveVehicleSelect.value = vehicle.id;
    document.querySelector("#tools")?.scrollIntoView({ behavior: "smooth" });
  });
}

function setupThreeViewer(vehicle) {
  const mount = document.querySelector("#threeRoot");
  const statusEl = document.querySelector("#tourStatus");
  const controlsButtons = [...document.querySelectorAll("[data-tour-view]")];
  if (!mount || !statusEl) {
    return null;
  }

  mount.innerHTML = "";
  const width = mount.parentElement.clientWidth;
  const height = mount.parentElement.clientHeight;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe8ecec, 8, 24);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(5.8, 2.7, 6.8);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  mount.appendChild(renderer.domElement);

  const orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.enablePan = false;
  orbitControls.minDistance = 2.5;
  orbitControls.maxDistance = 11;
  orbitControls.target.set(0, 1.2, 0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x425257, 1.3);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(4, 9, 6);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xc9e3f4, 0.45);
  rim.position.set(-6, 4, -4);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(8, 64),
    new THREE.MeshStandardMaterial({ color: 0xf4efe7, metalness: 0.08, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  scene.add(floor);

  const turntable = new THREE.Mesh(
    new THREE.CylinderGeometry(3.7, 3.7, 0.16, 56),
    new THREE.MeshStandardMaterial({ color: 0xd9d3ca, metalness: 0.15, roughness: 0.9 })
  );
  turntable.position.y = 0.04;
  scene.add(turntable);

  const showroom = buildProceduralVehicle(vehicle);
  showroom.root.position.y = 0.36;
  scene.add(showroom.root);

  const cameraGoal = new THREE.Vector3(5.8, 2.7, 6.8);
  const targetGoal = new THREE.Vector3(0, 1.2, 0);
  let autoRotate = false;
  let paintIndex = 0;

  const views = {
    exterior: {
      position: new THREE.Vector3(5.8, 2.7, 6.8),
      target: new THREE.Vector3(0, 1.2, 0),
      detail: "Exterior orbit mode is active. Drag to inspect the vehicle from any angle."
    },
    reset: {
      position: new THREE.Vector3(5.8, 2.7, 6.8),
      target: new THREE.Vector3(0, 1.2, 0),
      detail: "Camera reset to the standard showroom angle."
    },
    cabin: {
      position: new THREE.Vector3(1.8, 1.75, 0.1),
      target: new THREE.Vector3(-0.5, 1.45, 0),
      detail: "Cabin mode fades the body shell so interior seating and dash geometry are visible."
    },
    front: {
      position: new THREE.Vector3(4.7, 1.8, 3.1),
      target: new THREE.Vector3(1.9, 1.05, 0),
      detail: vehicle.tourHotspots.find((hotspot) => hotspot.view === "front")?.detail || "Front quarter inspection."
    },
    rear: {
      position: new THREE.Vector3(-4.8, 1.8, 3.1),
      target: new THREE.Vector3(-1.9, 1.08, 0),
      detail: vehicle.tourHotspots.find((hotspot) => hotspot.view === "rear")?.detail || "Rear quarter inspection."
    },
    roof: {
      position: new THREE.Vector3(0.15, 5.5, 0.2),
      target: new THREE.Vector3(0, 1.75, 0),
      detail: vehicle.tourHotspots.find((hotspot) => hotspot.view === "roof")?.detail || "Top-down inspection."
    },
    cargo: {
      position: new THREE.Vector3(-4.8, 2.1, 0),
      target: new THREE.Vector3(-2.2, 1.1, 0),
      detail: vehicle.tourHotspots.find((hotspot) => hotspot.view === "cargo")?.detail || "Rear cargo inspection."
    },
    wheel: {
      position: new THREE.Vector3(2.9, 1.15, 3.3),
      target: new THREE.Vector3(1.65, 0.62, 1.05),
      detail: vehicle.tourHotspots.find((hotspot) => hotspot.view === "wheel")?.detail || "Wheel-and-brake inspection."
    }
  };

  function setShellOpacity(interiorMode) {
    showroom.paintMaterial.transparent = interiorMode;
    showroom.paintMaterial.opacity = interiorMode ? 0.22 : 1;
    showroom.glassMaterial.opacity = interiorMode ? 0.08 : 0.78;
    showroom.glassMaterial.transparent = true;
    showroom.trimMaterial.opacity = interiorMode ? 0.45 : 1;
    showroom.trimMaterial.transparent = interiorMode;
  }

  function markButtons(activeView) {
    controlsButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tourView === activeView);
    });
  }

  function setView(viewKey) {
    const view = views[viewKey] || views.exterior;
    cameraGoal.copy(view.position);
    targetGoal.copy(view.target);
    setShellOpacity(viewKey === "cabin");
    statusEl.textContent = view.detail;
    markButtons(viewKey === "reset" ? "exterior" : viewKey);
  }

  function handleViewClick(event) {
    const button = event.target.closest("[data-tour-view]");
    if (!button) {
      return;
    }
    setView(button.dataset.tourView);
  }

  document.querySelector("#paintToggle")?.addEventListener("click", () => {
    paintIndex = (paintIndex + 1) % vehicle.tourPaintOptions.length;
    showroom.paintMaterial.color.set(vehicle.tourPaintOptions[paintIndex]);
  });

  document.querySelector("#spinToggle")?.addEventListener("click", (event) => {
    autoRotate = !autoRotate;
    event.currentTarget.textContent = autoRotate ? "Stop rotate" : "Auto rotate";
  });

  controlsButtons.forEach((button) => button.addEventListener("click", handleViewClick));
  setView("exterior");

  const onResize = () => {
    const nextWidth = mount.parentElement.clientWidth;
    const nextHeight = mount.parentElement.clientHeight;
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight);
  };

  let disposed = false;
  const animate = () => {
    if (disposed || !els.vehicleModal.open) {
      return;
    }
    requestAnimationFrame(animate);
    if (autoRotate) {
      showroom.root.rotation.y += 0.01;
    }
    camera.position.lerp(cameraGoal, 0.08);
    orbitControls.target.lerp(targetGoal, 0.08);
    orbitControls.update();
    renderer.render(scene, camera);
  };

  window.addEventListener("resize", onResize);
  animate();

  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    window.removeEventListener("resize", onResize);
    controlsButtons.forEach((button) => button.removeEventListener("click", handleViewClick));
    orbitControls.dispose();
    renderer.dispose();
    scene.traverse((node) => {
      if (node.isMesh) {
        node.geometry?.dispose();
      }
    });
    mount.innerHTML = "";
  };
}

function buildProceduralVehicle(vehicle) {
  const profileMap = {
    SUV: { length: 4.8, height: 0.92, width: 2.05, roofLength: 2.3, roofHeight: 1.78, wheelBase: 1.68, hoodTilt: -0.14, rearTilt: 0.12 },
    Truck: { length: 5.3, height: 0.94, width: 2.12, roofLength: 1.95, roofHeight: 1.84, wheelBase: 1.9, hoodTilt: -0.08, rearTilt: 0.05 },
    Sedan: { length: 4.9, height: 0.78, width: 1.94, roofLength: 2.45, roofHeight: 1.63, wheelBase: 1.76, hoodTilt: -0.18, rearTilt: 0.2 },
    Coupe: { length: 4.7, height: 0.72, width: 1.9, roofLength: 2.05, roofHeight: 1.54, wheelBase: 1.7, hoodTilt: -0.2, rearTilt: 0.26 },
    Crossover: { length: 4.55, height: 0.84, width: 1.98, roofLength: 2.18, roofHeight: 1.72, wheelBase: 1.63, hoodTilt: -0.15, rearTilt: 0.13 },
    Minivan: { length: 5.05, height: 0.9, width: 2.08, roofLength: 2.8, roofHeight: 1.88, wheelBase: 1.82, hoodTilt: -0.09, rearTilt: 0.04 }
  };

  const profile = profileMap[vehicle.bodyStyle] || profileMap.SUV;
  const root = new THREE.Group();

  const paintMaterial = new THREE.MeshStandardMaterial({
    color: vehicle.exteriorColor,
    metalness: 0.34,
    roughness: 0.4
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8d0da,
    metalness: 0.1,
    roughness: 0.2,
    transparent: true,
    opacity: 0.78
  });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x232629, roughness: 0.72 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xd4dade, metalness: 0.78, roughness: 0.25 });
  const seatMaterial = new THREE.MeshStandardMaterial({ color: 0xb8a89a, roughness: 0.85 });
  const dashMaterial = new THREE.MeshStandardMaterial({ color: 0x35383c, roughness: 0.65 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(profile.length, profile.height, profile.width), paintMaterial);
  base.position.y = 1;
  root.add(base);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(profile.roofLength, 0.68, profile.width - 0.32), paintMaterial);
  roof.position.set(0.05, profile.roofHeight, 0);
  root.add(roof);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.26, profile.width - 0.24), paintMaterial);
  hood.position.set(profile.length / 2 - 0.72, 1.22, 0);
  hood.rotation.z = profile.hoodTilt;
  root.add(hood);

  const rear = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.34, profile.width - 0.24), paintMaterial);
  rear.position.set(-profile.length / 2 + 0.72, 1.2, 0);
  rear.rotation.z = profile.rearTilt;
  root.add(rear);

  const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(profile.roofLength - 0.2, 0.38, 0.04), glassMaterial);
  sideWindow.position.set(0.08, profile.roofHeight - 0.08, 0.82);
  root.add(sideWindow);
  const farSideWindow = sideWindow.clone();
  farSideWindow.position.z = -0.82;
  root.add(farSideWindow);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.44, profile.width - 0.42), glassMaterial);
  windshield.position.set(profile.length / 2 - 1.55, profile.roofHeight - 0.15, 0);
  windshield.rotation.z = -0.48;
  root.add(windshield);

  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.38, profile.width - 0.48), glassMaterial);
  rearWindow.position.set(-profile.length / 2 + 1.45, profile.roofHeight - 0.18, 0);
  rearWindow.rotation.z = 0.5;
  root.add(rearWindow);

  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, profile.width - 0.28), darkMaterial);
  frontBumper.position.set(profile.length / 2 + 0.08, 0.86, 0);
  root.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, profile.width - 0.28), darkMaterial);
  rearBumper.position.set(-profile.length / 2 - 0.06, 0.86, 0);
  root.add(rearBumper);

  const grillWidth = vehicle.fuel === "Electric" ? 0.54 : 0.94;
  const grill = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, grillWidth), trimMaterial);
  grill.position.set(profile.length / 2 + 0.18, 1.05, 0);
  root.add(grill);

  const cabin = new THREE.Group();
  const frontSeatLeft = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.42), seatMaterial);
  frontSeatLeft.position.set(0.7, 1.16, 0.4);
  cabin.add(frontSeatLeft);
  const frontSeatRight = frontSeatLeft.clone();
  frontSeatRight.position.z = -0.4;
  cabin.add(frontSeatRight);

  const rearSeat = new THREE.Mesh(
    new THREE.BoxGeometry(vehicle.bodyStyle === "Minivan" ? 1.3 : 0.95, 0.5, vehicle.bodyStyle === "Coupe" ? 0.76 : 1.2),
    seatMaterial
  );
  rearSeat.position.set(vehicle.bodyStyle === "Minivan" ? -0.45 : -0.3, 1.1, 0);
  cabin.add(rearSeat);

  if (vehicle.bodyStyle === "Minivan") {
    const thirdRow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.46, 1.16), seatMaterial);
    thirdRow.position.set(-1.5, 1.04, 0);
    cabin.add(thirdRow);
  }

  const dashboard = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.26, 1.3), dashMaterial);
  dashboard.position.set(1.35, 1.45, 0);
  cabin.add(dashboard);

  const console = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.18, 0.28), dashMaterial);
  console.position.set(0.32, 1.02, 0);
  cabin.add(console);
  root.add(cabin);

  if (vehicle.bodyStyle === "Truck") {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.46, 1.62), darkMaterial);
    bed.position.set(-1.65, 1.12, 0);
    root.add(bed);
  }

  if (vehicle.bodyStyle === "Coupe") {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 1.1), trimMaterial);
    spoiler.position.set(-1.95, 1.52, 0);
    root.add(spoiler);
  }

  if (vehicle.bodyStyle === "SUV" || vehicle.bodyStyle === "Crossover") {
    const roofPanel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 1.08), darkMaterial);
    roofPanel.position.set(0.06, profile.roofHeight + 0.33, 0);
    root.add(roofPanel);
  }

  const wheelZ = profile.width / 2 - 0.93;
  [
    [profile.wheelBase, 0.54, wheelZ],
    [-profile.wheelBase, 0.54, wheelZ],
    [profile.wheelBase, 0.54, -wheelZ],
    [-profile.wheelBase, 0.54, -wheelZ]
  ].forEach(([x, y, z]) => {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.38, 30), darkMaterial);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(x, y, z);
    root.add(tire);

    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.4, 22), trimMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    root.add(wheel);
  });

  return { root, paintMaterial, glassMaterial, trimMaterial };
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

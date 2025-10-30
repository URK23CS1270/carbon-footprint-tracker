// --- Carbon Footprint Tracker ---
const defaultFactors = {
  car_km: 0.192,
  public_km: 0.075,
  electric_kwh: 0.475,
  flight_hr: 90,
  meat_meal: 2.5,
  waste_kg: 1.2,
  bike_km: 0
};

const STORAGE_KEY = "cf_app_v1";

function loadState() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    return r ? JSON.parse(r) : null;
  } catch (e) {
    return null;
  }
}

function saveState(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

let state =
  loadState() || {
    profile: { name: "Guest", household: 1, units: "metric", factors: defaultFactors },
    entries: [],
    points: 0,
    challenges: [],
    posts: []
  };

// UI references
const profileName = document.getElementById("profileName");
const pointsEl = document.getElementById("points");
const chartCtx = document.getElementById("chart").getContext("2d");
const logEl = document.getElementById("log");
const todayCO2 = document.getElementById("todayCO2");
const nameInput = document.getElementById("name");
const householdInput = document.getElementById("household");
const unitsInput = document.getElementById("units");
const activityType = document.getElementById("activityType");
const activityQty = document.getElementById("activityQty");
const activityDate = document.getElementById("activityDate");
const addActivityBtn = document.getElementById("addActivity");
const exportCsvBtn = document.getElementById("exportCsv");
const exportJsonBtn = document.getElementById("exportJson");
const importFile = document.getElementById("importFile");
const saveProfile = document.getElementById("saveProfile");
const clearData = document.getElementById("clearData");
const spotsEl = document.getElementById("spots");
const spotQuery = document.getElementById("spotQuery");
const findSpotsBtn = document.getElementById("findSpots");
const postsEl = document.getElementById("posts");
const postText = document.getElementById("postText");
const addPostBtn = document.getElementById("addPost");
const clearPostsBtn = document.getElementById("clearPosts");

let chart;

// --- Chart ---
function buildChart(labels, data) {
  if (chart) chart.destroy();
  chart = new Chart(chartCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "CO₂ (kg)", data, borderRadius: 6 }]
    },
    options: {
      plugins: { legend: { display: false } }
    }
  });
}

// --- Recompute everything ---
function recompute() {
  profileName.textContent = state.profile.name;
  pointsEl.textContent = state.points;
  nameInput.value = state.profile.name;
  householdInput.value = state.profile.household;
  unitsInput.value = state.profile.units;

  const today = new Date().toISOString().slice(0, 10);
  const todaysTotal =
    state.entries
      .filter((e) => e.date === today)
      .reduce((s, e) => s + (e.co2 || 0), 0) / (state.profile.household || 1);

  todayCO2.textContent = Math.round(todaysTotal * 100) / 100 + " kg";

  const days = [];
  const data = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(key.slice(5));
    const sum =
      state.entries
        .filter((e) => e.date === key)
        .reduce((s, e) => s + (e.co2 || 0), 0) / (state.profile.household || 1);
    data.push(Math.round(sum * 100) / 100);
  }
  buildChart(days, data);
  renderLog();
  renderPosts();
  saveState(state);
}

// --- Helpers ---
function estimateCO2(type, qty) {
  const f = state.profile.factors;
  switch (type) {
    case "car_km":
      return f.car_km * qty;
    case "public_km":
      return f.public_km * qty;
    case "electric_kwh":
      return f.electric_kwh * qty;
    case "flight_hr":
      return f.flight_hr * qty;
    case "meat_meal":
      return f.meat_meal * qty;
    case "waste_kg":
      return f.waste_kg * qty;
    case "bike_km":
      return 0;
    default:
      return 0;
  }
}

function nameForType(t) {
  const map = {
    car_km: "Car",
    public_km: "Public Transport",
    electric_kwh: "Electricity",
    flight_hr: "Flight",
    meat_meal: "Meat meal",
    waste_kg: "Waste",
    bike_km: "Bike/Walk"
  };
  return map[t] || t;
}

// --- Render Log ---
function renderLog() {
  logEl.innerHTML = "";
  const entries = [...state.entries].sort((a, b) => b.date.localeCompare(a.date));
  if (entries.length === 0) {
    logEl.innerHTML = "<div class='muted'>No entries yet</div>";
    return;
  }
  for (const x of entries) {
    const div = document.createElement("div");
    div.className = "entry";
    div.innerHTML = `
      <div><b>${nameForType(x.type)}</b><div class='muted'>${x.qty} • ${x.date}</div></div>
      <div><b>${x.co2} kg</b> <button data-id='${x.id}' class='deleteBtn secondary'>Del</button></div>`;
    logEl.appendChild(div);
  }
  logEl.querySelectorAll(".deleteBtn").forEach((b) => {
    b.onclick = (e) => {
      const id = e.target.dataset.id;
      state.entries = state.entries.filter((x) => x.id !== id);
      recompute();
    };
  });
}

// --- Activity Add ---
addActivityBtn.onclick = () => {
  const t = activityType.value;
  let q = parseFloat(activityQty.value) || 0;
  if (q <= 0) return alert("Enter positive quantity");
  const d = activityDate.value || new Date().toISOString().slice(0, 10);
  if (state.profile.units === "imperial" && t.includes("_km")) q *= 1.60934;
  const c = estimateCO2(t, q);
  state.entries.push({
    id: Date.now().toString(36),
    type: t,
    qty: Math.round(q * 100) / 100,
    date: d,
    co2: Math.round(c * 100) / 100
  });
  if (t === "bike_km") state.points += Math.round(q);
  recompute();
};

// --- Export / Import ---
exportCsvBtn.onclick = () => {
  const rows =
    "id,type,qty,date,co2\n" +
    state.entries.map((e) => `${e.id},${e.type},${e.qty},${e.date},${e.co2}`).join("\n");
  const blob = new Blob([rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "carbon_entries.csv";
  a.click();
  URL.revokeObjectURL(url);
};

exportJsonBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "carbon_export.json";
  a.click();
  URL.revokeObjectURL(url);
};

importFile.onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const t = await f.text();
  try {
    if (f.name.endsWith(".csv")) {
      t.split(/\r?\n/)
        .slice(1)
        .filter(Boolean)
        .forEach((l) => {
          const [a, b, c, d, x] = l.split(",");
          state.entries.push({
            id: a || Date.now().toString(36),
            type: b,
            qty: +c,
            date: d,
            co2: +x
          });
        });
    } else {
      const j = JSON.parse(t);
      if (j.entries) state.entries.push(...j.entries);
      if (j.profile) Object.assign(state.profile, j.profile);
    }
    recompute();
  } catch (err) {
    alert("Import failed: " + err.message);
  }
};

// --- Profile ---
saveProfile.onclick = () => {
  state.profile.name = nameInput.value || "Guest";
  state.profile.household = parseInt(householdInput.value) || 1;
  state.profile.units = unitsInput.value;
  recompute();
};

clearData.onclick = () => {
  if (confirm("Reset all data?")) {
    state = {
      profile: { name: "Guest", household: 1, units: "metric", factors: defaultFactors },
      entries: [],
      points: 0,
      challenges: [],
      posts: []
    };
    recompute();
  }
};

// --- Eco Spot Finder ---
findSpotsBtn.onclick = async () => {
  spotsEl.innerHTML = "<div class='muted'>Searching...</div>";
  const q = spotQuery.value || "park";
  let lat, lon;
  try {
    const p = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
    lat = p.coords.latitude;
    lon = p.coords.longitude;
  } catch {}
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "8");
    if (lat && lon)
      url.searchParams.set(
        "viewbox",
        `${lon - 0.05},${lat + 0.05},${lon + 0.05},${lat - 0.05}`
      );
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const arr = await res.json();
    spotsEl.innerHTML =
      arr
        .map(
          (a) => `
        <div class='entry'>
          <div><b>${a.display_name.split(",")[0]}</b>
          <div class='muted'>${a.type}</div></div>
          <a href='https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lon}#map=16/${a.lat}/${a.lon}'
             target='_blank' class='secondary small'>Open</a>
        </div>`
        )
        .join("") || "<div class='muted'>No results</div>";
  } catch {
    spotsEl.innerHTML = "<div class='muted'>Failed</div>";
  }
};

// --- Community Posts ---
function renderPosts() {
  postsEl.innerHTML = "";
  if (state.posts.length === 0) {
    postsEl.innerHTML = "<div class='muted'>No posts yet</div>";
    return;
  }
  state.posts.forEach((p) => {
    const div = document.createElement("div");
    div.className = "entry";
    div.innerHTML = `<div>${p.text}</div><div class='muted'>${p.date}</div>`;
    postsEl.appendChild(div);
  });
}

addPostBtn.onclick = () => {
  const t = postText.value.trim();
  if (!t) return;
  state.posts.push({ text: t, date: new Date().toLocaleString() });
  postText.value = "";
  recompute();
};

clearPostsBtn.onclick = () => {
  if (confirm("Clear all posts?")) {
    state.posts = [];
    recompute();
  }
};

// --- Initialize ---
recompute();
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(showMap, () => {
    alert("Please allow location access or use HTTPS to enable Eco Spot Finder.");
  });
} else {
  alert("Geolocation not supported by your browser.");
}

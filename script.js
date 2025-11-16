const defaultFactors = {
  car_km: 0.192,
  public_km: 0.075,
  electric_kwh: 0.475,
  flight_hr: 90,
  meat_meal: 2.5,
  waste_kg: 1.2,
  bike_km: 0
};

const STORAGE_KEY = 'cf_app_v1';

function loadState() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}

function saveState(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

let state = loadState() || {
  profile: { name: "Guest", household: 1, units: "metric", factors: defaultFactors },
  entries: [],
  points: 0,
  posts: []
};

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

function buildChart(labels, data) {
  if (chart) chart.destroy();
  chart = new Chart(chartCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "CO₂ (kg)",
        data,
        borderRadius: 6,
        backgroundColor: "#18a999"
      }]
    },
    options: { plugins: { legend: { display: false } } }
  });
}

function recompute() {
  profileName.textContent = state.profile.name;
  pointsEl.textContent = state.points;
  nameInput.value = state.profile.name;
  householdInput.value = state.profile.household;
  unitsInput.value = state.profile.units;

  const today = new Date().toISOString().slice(0, 10);
  const todayTotal = state.entries
    .filter(e => e.date === today)
    .reduce((s, e) => s + (e.co2 || 0), 0) / state.profile.household;

  todayCO2.textContent = Math.round(todayTotal * 100) / 100 + " kg";

  const days = [], data = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(key.slice(5));

    const sum = state.entries
      .filter(e => e.date === key)
      .reduce((s, e) => s + (e.co2 || 0), 0);

    data.push(Math.round(sum * 100) / 100);
  }

  buildChart(days, data);
  renderLog();
  renderPosts();
  saveState(state);
}

function estimateCO2(type, qty) {
  const f = state.profile.factors;
  return f[type] ? f[type] * qty : 0;
}

function renderLog() {
  logEl.innerHTML = "";
  const entries = [...state.entries].sort((a, b) => b.date.localeCompare(a.date));
  if (entries.length === 0) {
    logEl.innerHTML = "<div class='muted'>No entries yet</div>";
    return;
  }

  for (const e of entries) {
    const div = document.createElement("div");
    div.className = "entry";
    div.innerHTML = `
      <div><b>${e.type}</b><div class='muted'>${e.qty} • ${e.date}</div></div>
      <div><b>${e.co2} kg</b><button data-id='${e.id}' class='deleteBtn secondary'>Del</button></div>
    `;
    logEl.appendChild(div);
  }

  logEl.querySelectorAll(".deleteBtn").forEach(b => {
    b.onclick = ev => {
      const id = ev.target.dataset.id;
      state.entries = state.entries.filter(x => x.id !== id);
      recompute();
    };
  });
}

addActivityBtn.onclick = () => {
  const type = activityType.value;
  let qty = parseFloat(activityQty.value) || 0;
  if (qty <= 0) return alert("Enter positive quantity");

  const date = activityDate.value || new Date().toISOString().slice(0, 10);
  const co2 = estimateCO2(type, qty);

  state.entries.push({
    id: Date.now().toString(36),
    type,
    qty,
    date,
    co2: Math.round(co2 * 100) / 100
  });

  recompute();
};

addPostBtn.onclick = () => {
  const text = postText.value.trim();
  if (!text) return;

  const post = {
    id: Date.now().toString(36),
    text,
    time: new Date().toLocaleString()
  };

  state.posts.push(post);
  postText.value = "";
  recompute();
};

function renderPosts() {
  postsEl.innerHTML = "";
  for (const p of state.posts) {
    const div = document.createElement("div");
    div.className = "entry";
    div.innerHTML = `
      <div><b>Guest</b><div class='muted'>${p.time}</div><div>${p.text}</div></div>
      <button data-id='${p.id}' class='deletePost secondary'>Del</button>
    `;
    postsEl.appendChild(div);
  }

  postsEl.querySelectorAll(".deletePost").forEach(b => {
    b.onclick = e => {
      const id = e.target.dataset.id;
      state.posts = state.posts.filter(x => x.id !== id);
      recompute();
    };
  });
}

clearPostsBtn.onclick = () => {
  if (confirm("Clear all posts?")) {
    state.posts = [];
    recompute();
  }
};

findSpotsBtn.onclick = async () => {
  spotsEl.innerHTML = "<div class='muted'>Searching...</div>";
  const q = spotQuery.value || "park";

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");

  try {
    const res = await fetch(url);
    const arr = await res.json();

    spotsEl.innerHTML =
      arr
        .map(
          a => `
      <div class='entry'>
        <div><b>${a.display_name.split(",")[0]}</b></div>
        <a href='https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lon}#map=16/${a.lat}/${a.lon}'
           target='_blank'
           class='secondary small'>Open</a>
      </div>`
        )
        .join("") || "<div class='muted'>No results</div>";
  } catch {
    spotsEl.innerHTML = "<div class='muted'>Failed</div>";
  }
};

saveProfile.onclick = () => {
  state.profile.name = nameInput.value || "Guest";
  state.profile.household = parseInt(householdInput.value) || 1;
  state.profile.units = unitsInput.value;
  recompute();
};

clearData.onclick = () => {
  if (confirm("Reset all data?")) {
    localStorage.removeItem(STORAGE_KEY);
    state = {
      profile: { name: "Guest", household: 1, units: "metric", factors: defaultFactors },
      entries: [],
      points: 0,
      posts: []
    };
    recompute();
  }
};

recompute();

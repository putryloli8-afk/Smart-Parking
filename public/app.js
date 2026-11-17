/* =========================
   API
========================= */

const API = {
  async request(url, opts = {}) {
    const r = await fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });

    let d = {};

    try {
      d = await r.json();
    } catch {}

    if (!r.ok) throw new Error(d.message || "Permintaan gagal");

    return d;
  },

  areas: () => API.request("/api/areas"),

  history: (q = {}) => API.request("/api/history?" + new URLSearchParams(q)),

  updateArea: (id, data) =>
    API.request("/api/areas/" + id, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  camera: (id, enabled) =>
    API.request("/api/areas/" + id + "/camera", {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),

  addArea: (data) =>
    API.request("/api/areas", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteArea: (id) =>
    API.request("/api/areas/" + id, {
      method: "DELETE",
    }),
};

/* =========================
   WARNA AREA
========================= */

const COLORS = {
  A: "#20C4D0",
  B: "#FF8A32",
  C: "#4798F5",
  D: "#50B85A",
  E: "#A875E8",
  F: "#FFD43B",
  G: "#FF7188",
};

const ALLOWED_AREAS = ["A", "B", "C", "D", "E", "F", "G"];

const $ = (id) => document.getElementById(id);

const colorFor = (area) =>
  COLORS[String(area.id).toUpperCase()] || area.color || "#94A3B8";

/* =========================
   NORMALISASI DATA PARKIR
========================= */

// Membaca slot tersedia dari backend.
// Jumlah terisi dihitung dari kapasitas dikurangi slot tersedia.

function normalizeArea(a) {
  const capacity = Number(a.capacity);

  const available = Number(a.available);

  const valid =
    a.capacity != null &&
    Number.isFinite(capacity) &&
    capacity > 0 &&
    a.available != null &&
    Number.isFinite(available) &&
    available >= 0 &&
    available <= capacity;

  if (!valid) {
    return {
      ...a,
      parkingValid: false,
      capacity: Number.isFinite(capacity) ? capacity : 0,
      occupied: 0,
      available: 0,
    };
  }

  const occupied = capacity - available;

  return {
    ...a,
    parkingValid: true,
    capacity,
    occupied,
    available,
  };
}

const hasParkingData = (a) => a.parkingValid === true;

const statusFor = (occupied, capacity) => {
  if (capacity <= 0) return "Belum ada data";

  const ratio = occupied / capacity;

  if (ratio >= 0.95) return "Penuh";

  if (ratio >= 0.8) return "Hampir Penuh";

  return "Tersedia";
};

const statusClass = (status) =>
  status === "Tersedia"
    ? "green"
    : status === "Hampir Penuh"
    ? "yellow"
    : status === "Penuh"
    ? "red"
    : "";

const fmtDate = (date) => (date ? date.split("-").reverse().join("/") : "-");

async function loadAreas() {
  const response = await API.areas();

  // Mendukung respons berupa array atau object { areas: [...] }
  const areas = Array.isArray(response) ? response : response.areas || [];

  return areas.map(normalizeArea);
}

/* =========================
   JAM DAN TANGGAL
========================= */

function clock() {
  const now = new Date();

  if ($("clock")) {
    $("clock").textContent =
      now.toLocaleTimeString("id-ID", {
        hour12: false,
      }) + " WIB";
  }

  if ($("clockDate")) {
    $("clockDate").textContent = now.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
}

/* =========================
   INISIALISASI HALAMAN
========================= */

document.addEventListener("DOMContentLoaded", async () => {
  if (document.body.dataset.protected === "true" && !requireAdmin()) {
    return;
  }

  clock();

  setInterval(clock, 1000);

  const page = location.pathname.split("/").pop();

  document.querySelectorAll(".menu a").forEach((link) => {
    const href = link.getAttribute("href");

    if (href && href.split("/").pop() === page) {
      link.classList.add("active");
    }
  });

  if (page === "smart_parking_dashboard.html") initDashboard();

  if (page === "data-parkir.html") initData();

  if (page === "riwayat.html") initHistory();

  if (page === "pengaturan-kamera.html") initCameras();

  if (page === "pengaturan-slot.html") initSlots();
});

/* =========================
   DASHBOARD
========================= */

async function initDashboard() {
  const refresh = async (showError = false) => {
    try {
      const areas = await loadAreas();

      const active = areas.filter((a) => a.enabled);

      const sum = (key) =>
        active.reduce((total, area) => {
          if (!hasParkingData(area)) return total;

          const value = Number(area[key]);

          return total + (Number.isFinite(value) ? value : 0);
        }, 0);

      if ($("areaCount")) {
        $("areaCount").textContent = active.length;
      }

      if ($("occupiedCount")) {
        $("occupiedCount").textContent = sum("occupied");
      }

      if ($("availableCount")) {
        $("availableCount").textContent = sum("available");
      }

      if ($("capacityCount")) {
        $("capacityCount").textContent = sum("capacity");
      }

      renderDashboardTable(areas);

      renderMap(areas, "dashboardMap");

      renderDonuts(areas);

      renderBars(areas);
    } catch (error) {
      console.error("Dashboard gagal diperbarui:", error);

      if (showError) {
        alert("Gagal memuat dashboard: " + error.message);
      }
    }
  };

  await refresh(true);

  if (!window.dashboardRefreshTimer) {
    window.dashboardRefreshTimer = setInterval(() => refresh(false), 60000);
  }
}

function renderDashboardTable(areas) {
  const table = $("dashboardAreas");

  if (!table) return;

  table.innerHTML = areas
    .map((a) => {
      const valid = a.enabled && hasParkingData(a);

      const status = valid
        ? statusFor(a.occupied, a.capacity)
        : a.enabled
        ? "Belum ada data"
        : "Nonaktif";

      const available = valid ? a.available : "—";

      return `
        <tr>
          <td>
            <b style="color:${colorFor(a)}">●</b>
            ${a.name}
          </td>

          <td>${valid ? a.capacity : "—"}</td>

          <td>${valid ? a.occupied : "—"}</td>

          <td>${available}</td>

          <td>
            <span class="status ${statusClass(status)}">
              ${status}
            </span>
          </td>

          <td>
            <span class="status ${a.cameraEnabled ? "green" : "red"}">
              Kamera ${a.cameraEnabled ? "ON" : "OFF"}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
}

/* =========================
   DIAGRAM DONAT
========================= */

function renderDonuts(areas, containerId = "donutCharts") {
  const container = $(containerId);

  if (!container) return;

  if (!areas.length) {
    container.innerHTML = '<p class="muted">Belum ada data area parkir.</p>';

    return;
  }

  container.innerHTML = areas
    .map((a) => {
      const valid = a.enabled && hasParkingData(a);

      const capacity = valid ? a.capacity : 0;

      const occupied = valid ? a.occupied : 0;

      const available = valid ? a.available : 0;

      const pct = valid
        ? Math.min(100, Math.round((occupied / capacity) * 100))
        : 0;

      const color = colorFor(a);

      return `
        <article class="donut-item">

          <div
            class="donut"
            style="--pct:${pct}%;--donut-color:${color}"
            role="img"
            aria-label="${a.name}: ${
        valid ? pct + "% terisi" : "Belum ada data"
      }"
          >
            <span>${valid ? pct + "%" : "—"}</span>
          </div>

          <b style="color:${color}">${a.name}</b>

          <small>
            ${valid ? `${occupied} terisi` : "Belum ada data"}
          </small>

          <small>
            ${valid ? `${available} tersedia` : "Kapasitas belum tersedia"}
          </small>

          <small class="camera-status">
            Kamera ${a.cameraEnabled ? "ON" : "OFF"}
          </small>

        </article>
      `;
    })
    .join("");
}

/* =========================
   DIAGRAM BATANG DASHBOARD
========================= */

function renderBars(areas) {
  const chart = $("capacityChart");

  if (!chart) return;

  const values = areas
    .filter((a) => ALLOWED_AREAS.includes(String(a.id).toUpperCase()))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((a) => {
      const valid = a.enabled && hasParkingData(a);

      // Diagram menunjukkan slot TERISI
      const occupied = valid ? a.capacity - a.available : 0;

      return {
        area: a,
        valid,
        occupied,
        available: valid ? a.available : 0,
        color: colorFor(a),
      };
    });

  const chartMax = 30;

  const tickStep = 6;

  chart.innerHTML = `
    <div class="vertical-chart-scroll">

      <div class="vertical-chart">

        <div class="chart-y-axis">

          ${Array.from({ length: 6 }, (_, i) => {
            const value = chartMax - tickStep * i;

            return `
              <div class="chart-y-label">
                ${value}
              </div>
            `;
          }).join("")}

        </div>

        <div class="chart-plot">

          <div class="chart-grid-lines">

            ${Array.from(
              { length: 6 },
              () => '<div class="chart-grid-line"></div>'
            ).join("")}

          </div>

          <div class="chart-bars">

            ${values
              .map((item) => {
                const height = item.valid
                  ? Math.min((item.occupied / chartMax) * 100, 100)
                  : 0;

                return `
                <div class="chart-bar-item">

                  <div class="chart-bar-area">

                    ${
                      item.valid
                        ? `
                          <span
                            class="chart-bar-value"
                            style="bottom:${height}%"
                            title="${item.available} slot tersedia"
                          >
                            ${item.occupied}
                          </span>
                        `
                        : ""
                    }

                    <div
                      class="chart-bar"
                      style="
                        height:${height}%;
                        background-color:${item.color};
                      "
                      title="${item.area.name}: ${
                  item.valid
                    ? item.occupied + " terisi, " + item.available + " tersedia"
                    : "Belum ada data"
                }"
                    ></div>

                  </div>

                  <div class="chart-x-label">
                    ${item.area.name}
                  </div>

                </div>
              `;
              })
              .join("")}

          </div>

        </div>

      </div>

    </div>
  `;
}

/* =========================
   DENAH AREA
========================= */

function renderMap(areas, containerId) {
  const box = $(containerId);

  if (!box) return;

  const positions = {
    A: [4.5, 54],
    B: [26, 18],
    C: [43, 69],
    D: [50, 55],
    E: [79, 29],
    F: [79, 42],
    G: [88, 38],
  };

  const dots = areas
    .filter((a) => ALLOWED_AREAS.includes(String(a.id).toUpperCase()))
    .map((a) => {
      const position = positions[a.id] || [50, 50];

      const color = colorFor(a);

      const camera = a.cameraEnabled ? "ON" : "OFF";

      const valid = a.enabled && hasParkingData(a);

      const available = valid ? a.available : "belum diketahui";

      const capacity = valid ? a.capacity : "—";

      return `
        <button
          type="button"
          class="map-dot ${!a.cameraEnabled || !a.enabled ? "off" : ""}"
          title="${a.name}: kamera ${camera}"
          aria-label="${a.name}: kamera ${camera}"
          style="
            left:${position[0]}%;
            top:${position[1]}%;
            background:${color};
            color:#101828;
          "
          onclick="alert('${
            a.name
          }: kamera ${camera}; slot tersedia ${available}/${capacity}')"
        >
          ${a.id} · ${camera}
        </button>
      `;
    })
    .join("");

  box.innerHTML = `
    <img
      src="/assets/peta-area-parkir.png"
      alt="Denah area parkir kampus UPI"
      onerror="
        this.style.display='none';
        const message=this.parentElement.querySelector('.map-image-error');
        if(message) message.style.display='block';
      "
    >

    <div
      class="map-image-error"
      style="display:none;padding:16px;text-align:center"
    >
      Gambar denah tidak ditemukan. Pastikan file
      <code>/assets/peta-area-parkir.png</code> tersedia.
    </div>

    ${dots}

    <div class="map-status">
      Warna area A–G mengikuti denah. Status kamera diperbarui dari backend.
    </div>
  `;
}

/* =========================
   DATA PARKIR
========================= */

async function initData() {
  try {
    const areas = await loadAreas();

    const activeAreas = areas
      .filter((a) => a.enabled !== false)
      .filter((a) => ALLOWED_AREAS.includes(String(a.id).toUpperCase()))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));

    // Render kartu Data Parkir
    if (typeof renderParkingAreaCards === "function") {
      renderParkingAreaCards(activeAreas);
    }

    // Render tabel Data Parkir
    const table = $("parkingData");

    if (!table) return;

    if (!activeAreas.length) {
      table.innerHTML = `
        <tr>
          <td colspan="7">
            Belum ada data Area A-G yang aktif.
          </td>
        </tr>
      `;

      return;
    }

    table.innerHTML = activeAreas
      .map((a) => {
        const valid = hasParkingData(a);

        const capacity = valid ? a.capacity : 0;

        const available = valid ? a.available : 0;

        const occupied = valid ? capacity - available : 0;

        const pct = valid ? Math.round((occupied / capacity) * 100) : null;

        const status = valid ? statusFor(occupied, capacity) : "Belum ada data";

        return `
          <tr>

            <td>
              <b style="color:${colorFor(a)}">●</b>
              ${a.name}
            </td>

            <td>
              <span class="status ${a.cameraEnabled ? "green" : "red"}">
                ${a.cameraEnabled ? "ON" : "OFF"}
              </span>
            </td>

            <td>${valid ? capacity : "—"}</td>

            <td>${valid ? occupied : "—"}</td>

            <td>${valid ? available : "—"}</td>

            <td>
              ${pct === null ? "—" : pct + "%"}
            </td>

            <td>
              <span class="status ${statusClass(status)}">
                ${status}
              </span>
            </td>

          </tr>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Data parkir gagal dimuat:", error);

    const table = $("parkingData");

    if (table) {
      table.innerHTML = `
        <tr>
          <td colspan="7">
            Gagal memuat data parkir.
          </td>
        </tr>
      `;
    }
  }

  if (!window.dataParkingRefreshTimer) {
    window.dataParkingRefreshTimer = setInterval(() => {
      initData();
    }, 60000);
  }
}

/* =========================
   RIWAYAT
========================= */

async function initHistory() {
  try {
    const areas = await loadAreas();

    const select = $("areaFilter");

    if (select) {
      select.innerHTML =
        "<option>Semua Area</option>" +
        areas.map((a) => `<option>${a.name}</option>`).join("");
    }
  } catch (error) {
    console.error(error);
  }

  ["dateFilter", "areaFilter", "statusFilter"].forEach((id) => {
    const element = $(id);

    if (element) {
      element.addEventListener("change", loadHistory);
    }
  });

  await loadHistory();
}

async function loadHistory() {
  try {
    const query = {};

    if ($("dateFilter")?.value) {
      query.date = $("dateFilter").value;
    }

    if ($("areaFilter") && $("areaFilter").value !== "Semua Area") {
      query.area = $("areaFilter").value;
    }

    if ($("statusFilter") && $("statusFilter").value !== "Semua Status") {
      query.status = $("statusFilter").value;
    }

    const data = await API.history(query);

    if ($("historyBody")) {
      $("historyBody").innerHTML = data
        .map(
          (r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${fmtDate(r.date)}</td>
              <td>${r.time}</td>
              <td>${r.area}</td>
              <td>${r.capacity}</td>
              <td>${r.occupied}</td>
              <td>${r.available}</td>
              <td>
                <span class="status ${statusClass(r.status)}">
                  ${r.status}
                </span>
              </td>
            </tr>
          `
        )
        .join("");
    }

    if ($("empty")) {
      $("empty").style.display = data.length ? "none" : "block";
    }

    if ($("totalData")) {
      $("totalData").textContent = data.length;
    }

    if ($("availableCount")) {
      $("availableCount").textContent = data.filter(
        (r) => r.status === "Tersedia"
      ).length;
    }

    if ($("fullCount")) {
      $("fullCount").textContent = data.filter(
        (r) => r.status === "Hampir Penuh"
      ).length;
    }

    window.filteredHistory = data;
  } catch (error) {
    alert("Riwayat gagal dimuat: " + error.message);
  }
}

/* =========================
   EKSPOR EXCEL
========================= */

function exportExcel() {
  const rows = window.filteredHistory || [];

  if (!rows.length) {
    return alert("Tidak ada data sesuai filter.");
  }

  if (!window.XLSX) {
    return alert("Library Excel perlu koneksi internet.");
  }

  const filters = {
    tanggal: $("dateFilter")?.value || "Semua tanggal",
    area: $("areaFilter")?.value || "Semua Area",
    status: $("statusFilter")?.value || "Semua Status",
  };

  const worksheet = XLSX.utils.aoa_to_sheet([
    ["LAPORAN RIWAYAT SMART PARKING"],
    ["Tanggal", filters.tanggal],
    ["Area", filters.area],
    ["Status", filters.status],
    [],
    [
      "No",
      "Tanggal",
      "Waktu",
      "Area",
      "Kapasitas",
      "Terisi",
      "Tersedia",
      "Status",
    ],
    ...rows.map((r, i) => [
      i + 1,
      fmtDate(r.date),
      r.time,
      r.area,
      r.capacity,
      r.occupied,
      r.available,
      r.status,
    ]),
  ]);

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat");

  XLSX.writeFile(workbook, "riwayat-parkir.xlsx");
}

/* =========================
   EKSPOR PDF
========================= */

function exportPDF() {
  const rows = window.filteredHistory || [];

  if (!rows.length) {
    return alert("Tidak ada data sesuai filter.");
  }

  if (!window.jspdf) {
    return alert("Library PDF perlu koneksi internet.");
  }

  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({
    orientation: "landscape",
  });

  pdf.setFontSize(16);

  pdf.text("Laporan Riwayat Smart Parking", 14, 16);

  pdf.setFontSize(10);

  pdf.text(
    `Tanggal: ${$("dateFilter")?.value || "Semua tanggal"} | Area: ${
      $("areaFilter")?.value || "Semua Area"
    } | Status: ${$("statusFilter")?.value || "Semua Status"}`,
    14,
    24
  );

  pdf.autoTable({
    startY: 31,

    head: [
      [
        "No",
        "Tanggal",
        "Waktu",
        "Area",
        "Kapasitas",
        "Terisi",
        "Tersedia",
        "Status",
      ],
    ],

    body: rows.map((r, i) => [
      i + 1,
      fmtDate(r.date),
      r.time,
      r.area,
      r.capacity,
      r.occupied,
      r.available,
      r.status,
    ]),

    theme: "grid",

    headStyles: {
      fillColor: [16, 47, 87],
    },
  });

  pdf.save("riwayat-parkir.pdf");
}

/* =========================
   PENGATURAN KAMERA
========================= */

async function initCameras() {
  try {
    const areas = await loadAreas();

    const cards = $("cameraCards");

    if (cards) {
      cards.innerHTML = areas
        .map(
          (a) => `
            <article
              class="area-card"
              style="--area-color:${colorFor(a)}"
            >

              <h3>${a.name}</h3>

              <p>Status kamera mengikuti pengaturan area.</p>

              <label style="display:flex;align-items:center;gap:10px">

                <input
                  class="switch"
                  type="checkbox"
                  ${a.cameraEnabled ? "checked" : ""}
                  onchange="toggleCamera('${a.id}',this.checked)"
                >

                <b>${a.cameraEnabled ? "ON" : "OFF"}</b>

              </label>

              <p class="small" style="margin-top:10px">
                Area ${a.enabled ? "aktif" : "nonaktif"}
              </p>

            </article>
          `
        )
        .join("");
    }

    renderMap(areas, "cameraMap");
  } catch (error) {
    alert("Gagal memuat pengaturan kamera: " + error.message);
  }
}

async function toggleCamera(id, enabled) {
  try {
    await API.camera(id, enabled);

    await initCameras();
  } catch (error) {
    alert("Gagal menyimpan status kamera: " + error.message);

    await initCameras();
  }
}

/* =========================
   PENGATURAN SLOT
========================= */

async function initSlots() {
  try {
    const areas = await loadAreas();

    const rows = $("slotRows");

    if (!rows) return;

    rows.innerHTML = areas
      .map(
        (a) => `
          <tr>

            <td>
              <b style="color:${colorFor(a)}">●</b>
              ${a.name}
            </td>

            <td>${a.id}</td>

            <td>
              <input
                id="cap${a.id}"
                type="number"
                min="1"
                max="5000"
                value="${a.capacity ?? ""}"
                style="width:90px;padding:8px;border:1px solid #cbd5e1;border-radius:7px"
              >
            </td>

            <td>
              <input
                id="name${a.id}"
                value="${a.name}"
                style="width:115px;padding:8px;border:1px solid #cbd5e1;border-radius:7px"
              >
            </td>

            <td>
              <span class="status ${a.enabled ? "green" : "red"}">
                ${a.enabled ? "Aktif" : "Nonaktif"}
              </span>
            </td>

            <td>
              <span class="status ${a.cameraEnabled ? "green" : "red"}">
                ${a.cameraEnabled ? "ON" : "OFF"}
              </span>
            </td>

            <td>
              <div class="btn-row">

                <button
                  class="btn"
                  onclick="saveArea('${a.id}')"
                >
                  Simpan
                </button>

                <button
                  class="btn ${a.enabled ? "btn-danger" : "btn-green"}"
                  onclick="toggleArea('${a.id}',${!a.enabled})"
                >
                  ${a.enabled ? "Nonaktifkan" : "Aktifkan"}
                </button>

                ${
                  "ABCDEFG".includes(a.id)
                    ? ""
                    : `
                      <button
                        class="btn btn-danger"
                        onclick="removeArea('${a.id}')"
                      >
                        Hapus
                      </button>
                    `
                }

              </div>
            </td>

          </tr>
        `
      )
      .join("");
  } catch (error) {
    alert("Gagal memuat pengaturan slot: " + error.message);
  }
}

async function saveArea(id) {
  try {
    const capacity = Number($("cap" + id)?.value);

    const name = $("name" + id)?.value.trim();

    if (!Number.isFinite(capacity) || capacity < 1) {
      return alert("Kapasitas harus lebih dari 0.");
    }

    if (!name) {
      return alert("Nama area tidak boleh kosong.");
    }

    await API.updateArea(id, {
      capacity,
      name,
    });

    await initSlots();

    alert("Area berhasil disimpan.");
  } catch (error) {
    alert(error.message);
  }
}

async function toggleArea(id, enabled) {
  try {
    await API.updateArea(id, { enabled });

    await initSlots();
  } catch (error) {
    alert(error.message);
  }
}

async function removeArea(id) {
  if (
    !confirm("Hapus area tambahan " + id + "? Riwayat lama tetap tersimpan.")
  ) {
    return;
  }

  try {
    await API.deleteArea(id);

    await initSlots();
  } catch (error) {
    alert(error.message);
  }
}

async function addArea(event) {
  event.preventDefault();

  try {
    const data = {
      id: $("newId").value.trim().toUpperCase(),

      name: $("newName").value.trim(),

      capacity: Number($("newCapacity").value),

      color: $("newColor").value,
    };

    await API.addArea(data);

    event.target.reset();

    await initSlots();

    alert("Area baru berhasil ditambahkan.");
  } catch (error) {
    alert(error.message);
  }
}

/* =========================
   PROFIL
========================= */

async function initProfile() {
  try {
    if (typeof API.profile !== "function") {
      throw new Error("Endpoint profil belum tersedia pada API.");
    }

    const profile = await API.profile();

    if ($("adminName")) {
      $("adminName").value = profile.name || "Admin Parkir";
    }

    if ($("adminEmail")) {
      $("adminEmail").value = profile.email || "";
    }

    if ($("adminPhone")) {
      $("adminPhone").value = profile.phone || "";
    }

    if ($("adminUnit")) {
      $("adminUnit").value = profile.unit || "UPI Kampus Tasikmalaya";
    }

    if ($("adminAddress")) {
      $("adminAddress").value = profile.address || "";
    }
  } catch (error) {
    alert(error.message);
  }
}

async function saveProfile(event) {
  event.preventDefault();

  try {
    if (typeof API.saveProfile !== "function") {
      throw new Error("Endpoint simpan profil belum tersedia pada API.");
    }

    await API.saveProfile({
      name: $("adminName")?.value,
      email: $("adminEmail")?.value,
      phone: $("adminPhone")?.value,
      unit: $("adminUnit")?.value,
      address: $("adminAddress")?.value,
    });

    alert("Profil berhasil disimpan.");
  } catch (error) {
    alert(error.message);
  }
}

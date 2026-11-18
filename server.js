const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const areas = ["A", "B", "C", "D", "E", "F", "G", "H", "I"].map((id) => ({
  id,
  name: `Area ${id}`,
  capacity: null,
  occupied: null,
  color: "#64748b",
  enabled: true,
  cameraEnabled: false,
  cameraUrl: "",
  updatedAt: null,
}));

let history = [];

function viewArea(area) {
  const valid =
    Number.isFinite(area.capacity) && Number.isFinite(area.occupied);

  return {
    ...area,
    available: valid ? Math.max(0, area.capacity - area.occupied) : null,
    status: !valid
      ? "Belum ada data"
      : area.occupied / area.capacity >= 0.95
      ? "Penuh"
      : area.occupied / area.capacity >= 0.8
      ? "Hampir Penuh"
      : "Tersedia",
    camera: area.cameraEnabled ? "ON" : "OFF",
  };
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    database: false,
    mode: "memory-only",
  });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};

  if (
    username === (process.env.ADMIN_USERNAME || "adminparkir") &&
    password === (process.env.ADMIN_PASSWORD || "UPIparkir2026!")
  ) {
    return res.json({
      ok: true,
      user: {
        username: "adminparkir",
        role: "admin",
        name: "Admin Parkir",
      },
    });
  }

  res.status(401).json({ message: "Username atau password salah." });
});

app.get("/api/areas", (req, res) => {
  res.json(areas.map(viewArea));
});

app.post("/api/areas", (req, res) => {
  const id = String(req.body.id || "")
    .trim()
    .toUpperCase();
  const capacity = Number(req.body.capacity);

  if (
    !/^[A-Z0-9_-]{1,8}$/.test(id) ||
    areas.some((area) => area.id === id) ||
    !req.body.name ||
    !Number.isInteger(capacity) ||
    capacity < 1
  ) {
    return res.status(400).json({
      message: "ID harus unik, nama wajib diisi, dan kapasitas harus valid.",
    });
  }

  const area = {
    id,
    name: String(req.body.name),
    capacity,
    occupied: 0,
    color: /^#[0-9a-f]{6}$/i.test(req.body.color || "")
      ? req.body.color
      : "#64748b",
    enabled: true,
    cameraEnabled: false,
    cameraUrl: "",
    updatedAt: new Date().toISOString(),
  };

  areas.push(area);
  res.status(201).json(viewArea(area));
});

app.patch("/api/areas/:id", (req, res) => {
  const area = areas.find((item) => item.id === req.params.id.toUpperCase());

  if (!area) {
    return res.status(404).json({ message: "Area tidak ditemukan." });
  }

  if (req.body.name !== undefined) area.name = String(req.body.name);
  if (req.body.enabled !== undefined) area.enabled = Boolean(req.body.enabled);
  if (req.body.color !== undefined) area.color = req.body.color;

  if (req.body.capacity !== undefined) {
    const capacity = Number(req.body.capacity);

    if (!Number.isInteger(capacity) || capacity < 1) {
      return res.status(400).json({
        message: "Kapasitas harus bilangan bulat positif.",
      });
    }

    area.capacity = capacity;

    if (area.occupied !== null) {
      area.occupied = Math.min(area.occupied, capacity);
    }
  }

  if (req.body.cameraUrl !== undefined) {
    area.cameraUrl = String(req.body.cameraUrl);
  }

  area.updatedAt = new Date().toISOString();
  res.json(viewArea(area));
});

app.patch("/api/areas/:id/camera", (req, res) => {
  const area = areas.find((item) => item.id === req.params.id.toUpperCase());

  if (!area) {
    return res.status(404).json({ message: "Area tidak ditemukan." });
  }

  area.cameraEnabled = Boolean(req.body.enabled);
  area.updatedAt = new Date().toISOString();

  res.json(viewArea(area));
});

app.delete("/api/areas/:id", (req, res) => {
  const id = req.params.id.toUpperCase();

  if ("ABCDEFGHI".includes(id) && id.length === 1) {
    return res.status(400).json({
      message: "Area bawaan A–I tidak dapat dihapus.",
    });
  }

  const index = areas.findIndex((area) => area.id === id);

  if (index < 0) {
    return res.status(404).json({ message: "Area tidak ditemukan." });
  }

  areas.splice(index, 1);
  res.json({ ok: true });
});

app.post("/api/iot/reading", (req, res) => {
  const id = String(req.body.areaId || "").toUpperCase();
  const area = areas.find((item) => item.id === id);
  const occupied = Number(req.body.occupied);

  if (
    !area ||
    !Number.isFinite(occupied) ||
    occupied < 0 ||
    !Number.isFinite(area.capacity)
  ) {
    return res.status(400).json({
      message:
        "Area harus ada dan kapasitas harus diatur sebelum menerima data.",
    });
  }

  area.occupied = Math.min(Math.round(occupied), area.capacity);
  area.updatedAt = new Date().toISOString();

  const record = {
    timestamp: area.updatedAt,
    areaId: area.id,
    area: area.name,
    capacity: area.capacity,
    occupied: area.occupied,
    available: area.capacity - area.occupied,
    source: req.body.source || "iot",
  };

  history.push(record);
  res.status(201).json({ ok: true, record: viewArea(area) });
});

app.get("/api/history", (req, res) => {
  let rows = [...history].reverse();
  const { date, area, status: filterStatus, period } = req.query;

  if (period && period !== "all" && period !== "custom") {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const start = new Date(today);

    if (period === "today") {
      start.setHours(0, 0, 0, 0);
    } else {
      const days = Number(period);
      if (Number.isFinite(days) && days > 0) {
        start.setDate(start.getDate() - (days - 1));
        start.setHours(0, 0, 0, 0);
      }
    }

    rows = rows.filter((r) => {
      const stamp = r.timestamp ? new Date(r.timestamp) : new Date(r.date);
      return stamp >= start && stamp <= today;
    });
  } else if (date) {
    rows = rows.filter((r) => r.date === date);
  }

  if (area && area !== "Semua Area")
    rows = rows.filter(
      (r) =>
        r.areaId ===
        String(area)
          .replace(/^Area /, "")
          .toUpperCase()
    );
  if (filterStatus && filterStatus !== "Semua Status")
    rows = rows.filter((r) => r.status === filterStatus);
  res.json(rows);
});

app.listen(PORT, () => {
  console.log(`Smart Parking aktif: http://localhost:${PORT}`);
});

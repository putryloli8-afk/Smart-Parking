# Smart Parking UPI Tasikmalaya — versi revisi

Prototipe Express dengan API backend, database SQLite, data awal Area A–G, denah parkir yang diberikan, status kamera ON/OFF, pengelolaan kapasitas/area, riwayat, dan ekspor Excel/PDF.

## Menjalankan
1. Install **Node.js 20 LTS** (direkomendasikan untuk kompatibilitas `better-sqlite3`).
2. Ekstrak ZIP lalu buka folder ini di VS Code.
3. Jalankan `npm install`.
4. Jalankan `npm start`.
5. Buka `http://localhost:3000`.

Login demo: `adminparkir` / `UPIparkir2026!`

## Catatan integrasi
- Dashboard, data parkir, riwayat, pengaturan kamera, dan pengaturan slot menggunakan API backend yang sama. Area yang ditambahkan melalui Pengaturan Slot akan muncul pada halaman lain setelah halaman dimuat ulang.
- API `/api/iot/reading` tersedia sebagai titik masuk pembacaan sensor/IoT. Status ON/OFF saat ini mengubah status logis kamera; video kamera fisik memerlukan URL stream dan perangkat yang dikonfigurasi.
- Database SQLite lokal dibuat otomatis di folder `data/`. Ini prototipe pengembangan; login demo belum layak dipakai di internet/produksi tanpa autentikasi dan keamanan tambahan.
- Denah A–G memakai koordinat yang ditetapkan sesuai lokasi pada gambar. Area tambahan diberi titik fallback di peta; untuk presisi lokasi area baru, koordinat peta perlu ditetapkan.
- Ekspor Excel/PDF memakai library CDN sehingga memerlukan koneksi internet saat tombol ekspor digunakan.

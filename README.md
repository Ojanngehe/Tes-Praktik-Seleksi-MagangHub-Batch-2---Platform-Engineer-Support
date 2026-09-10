# Platform Engineer Support — Tes Praktik

Repository ini berisi hasil pengerjaan **Tes Praktik Seleksi MagangHub Batch 2 — Platform Engineer Support**.

**Problem statement:**  
https://github.com/suksest/plaform-engineer-support-prob

Solusi mencakup:

1. Dashboard status container menggunakan Docker API.
2. Investigasi dan perbaikan container yang mengalami restart loop.
3. Pengecekan kesesuaian versi deployment terhadap desired state.

---

## Requirements

Pastikan environment memiliki:

- Docker Engine / Docker Desktop
- Docker Compose
- Git
- Web browser

Verifikasi instalasi:

```bash
docker --version
docker compose version
```

---

## Cara Menjalankan

Clone repository:

```bash
git clone https://github.com/Ojanngehe/Tes-Praktik-Seleksi-MagangHub-Batch-2---Platform-Engineer-Support.git
cd Tes-Praktik-Seleksi-MagangHub-Batch-2---Platform-Engineer-Support
```

Build dan jalankan seluruh service:

```bash
docker compose up -d --build
```

Periksa status container:

```bash
docker compose ps
```

Dashboard dapat diakses melalui:

```text
http://localhost:8080
```

Untuk menghentikan seluruh service:

```bash
docker compose down
```

Port dashboard dapat diubah menggunakan environment variable `DASHBOARD_PORT`.

Contoh:

```bash
DASHBOARD_PORT=8081 docker compose up -d
```

---

## Struktur Repository

```text
.
├── app/
│   ├── Dockerfile
│   └── index.html
├── dashboard/
│   ├── Dockerfile
│   ├── app.js
│   ├── index.html
│   └── nginx.conf
├── .env.example
├── .gitignore
├── desired-state.json
├── docker-compose.yml
└── README.md
```

- `app/` berisi image sederhana untuk service simulasi.
- `dashboard/` berisi frontend dashboard dan konfigurasi Nginx.
- `desired-state.json` menyimpan target versi deployment.
- `docker-compose.yml` mendefinisikan seluruh service untuk environment pengujian.

---

# Soal 1 — Dashboard Status Container

## Pendekatan

Dashboard mengambil data container dari Docker API menggunakan:

```text
GET /containers/json?all=1
```

Parameter `all=1` digunakan agar container dengan kondisi selain running, seperti `exited`, tetap dapat dideteksi.

Frontend tidak mengakses Docker socket secara langsung. Request diteruskan oleh Nginx ke Docker Engine melalui:

```text
/var/run/docker.sock
```

Dengan pendekatan ini, frontend dapat menggunakan request same-origin tanpa mengekspos Docker API melalui TCP port tambahan.

## Informasi yang Ditampilkan

Setiap container menampilkan:

- Nama container
- Image dan tag
- Status
- Environment
- Container ID
- Waktu pembuatan container

Environment diambil dari label:

```text
com.project.env
```

Container kemudian dikelompokkan berdasarkan:

```text
production
staging
unknown
```

Container tanpa label environment ditempatkan pada kelompok `unknown`.

## Penanganan Image Digest

Pada beberapa kondisi, Docker API dapat mengembalikan image sebagai digest:

```text
sha256:...
```

Jika hal tersebut terjadi, dashboard melakukan Docker Inspect:

```text
GET /containers/{id}/json
```

dan menggunakan:

```text
Config.Image
```

agar image tetap ditampilkan dalam format yang mudah dibaca, misalnya:

```text
api-gateway:v2.3.0
web-frontend:v1.4.2
auth-service:v0.9.5
postgres:16-alpine
```

## Status dan UI

Container dengan state berikut ditandai sebagai bermasalah:

```text
restarting
exited
dead
```

Dashboard juga menampilkan jumlah container serta jumlah container bermasalah.

Data diperbarui otomatis setiap 5 detik dan dapat diperbarui manual melalui tombol **Muat Ulang**.

Sebagai bonus, UI dibuat menggunakan card, badge status, badge environment, responsive grid, dan visual warning untuk mempermudah identifikasi masalah.

## Dashboard Healthcheck

Pada pengujian awal, dashboard dapat diakses melalui browser tetapi healthcheck Docker berstatus `unhealthy`.

Request dari dalam container ke:

```text
http://localhost/
```

ter-resolve ke IPv6 `::1` dan menghasilkan `Connection refused`.

Sementara:

```text
http://127.0.0.1/
```

menghasilkan:

```text
HTTP/1.1 200 OK
```

Healthcheck kemudian disesuaikan menjadi:

```yaml
healthcheck:
  test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1/"]
```

Setelah perubahan, container dashboard berada pada kondisi `healthy`.

---

# Soal 2 — Investigasi Container Bermasalah

## Deteksi Masalah

Container yang mengalami restart loop adalah:

```text
reporting-service
```

Pemeriksaan dilakukan menggunakan:

```bash
docker compose ps
```

Kondisi awal menunjukkan:

```text
Restarting (1)
```

## Investigasi

Logs diperiksa menggunakan:

```bash
docker compose logs --tail=20 reporting-service
```

Ditemukan error:

```text
[FATAL] REPORTING_DB_URL is not set - cannot connect to reporting database
```

State container kemudian diperiksa menggunakan:

```bash
docker inspect pe-support-test-reporting-service-1 --format='ExitCode={{.State.ExitCode}} Status={{.State.Status}} Restarting={{.State.Restarting}} Error={{.State.Error}}'
```

Hasil kondisi awal:

```text
ExitCode=1
Status=restarting
Restarting=true
```

Environment variable juga diperiksa menggunakan:

```bash
docker inspect pe-support-test-reporting-service-1 --format='{{range .Config.Env}}{{println .}}{{end}}'
```

Pada kondisi awal tidak terdapat `REPORTING_DB_URL`.

## Root Cause

`reporting-service` membutuhkan environment variable:

```text
REPORTING_DB_URL
```

Startup process menghentikan service dengan `exit code 1` ketika variable tersebut tidak tersedia.

Karena container menggunakan:

```yaml
restart: always
```

Docker terus menjalankan kembali process yang gagal sehingga terjadi restart loop.

Dengan demikian, hanya melakukan restart container tidak menyelesaikan root cause.

## Perbaikan

Konfigurasi PostgreSQL yang tersedia adalah:

```text
Host     : postgres
Port     : 5432
Database : appdb
User     : app
Password : apppass
```

Connection string yang digunakan:

```text
postgres://app:apppass@postgres:5432/appdb
```

Kemudian ditambahkan ke konfigurasi `reporting-service`:

```yaml
environment:
  REPORTING_DB_URL: "postgres://app:apppass@postgres:5432/appdb"
```

Container dibuat ulang:

```bash
docker compose up -d --force-recreate reporting-service
```

Verifikasi logs:

```bash
docker compose logs --tail=10 reporting-service
```

Hasil:

```text
reporting-service started
```

Status container setelah perbaikan:

```text
Up
```

Dengan demikian, restart loop berhasil diperbaiki dengan menangani root cause pada konfigurasi environment variable.

---

# Soal 3 — Cek Kesesuaian Versi Deployment

## Desired State

Target versi disimpan pada:

```text
desired-state.json
```

Isi:

```json
{
  "service": "api-gateway",
  "expected_tag": "v2.3.1"
}
```

Deployment aktual menggunakan:

```text
api-gateway:v2.3.0
```

## Pendekatan

Version checker melakukan proses berikut:

1. Membaca `service` dan `expected_tag` dari `desired-state.json`.
2. Mengambil daftar container melalui Docker API.
3. Mencari container berdasarkan label `com.docker.compose.service`.
4. Menggunakan nama container sebagai fallback.
5. Memastikan service berada pada state `running`.
6. Mengambil image aktual.
7. Mengekstrak image tag.
8. Membandingkan actual tag dengan expected tag.
9. Menampilkan hasil pada dashboard.

Jika Docker API hanya memberikan digest image, informasi image diambil melalui Docker Inspect dari:

```text
Config.Image
```

## Status yang Didukung

### MATCH

```text
Expected : v2.3.0
Actual   : v2.3.0
Status   : MATCH
```

### MISMATCH

Kondisi default project:

```text
Expected : v2.3.1
Actual   : v2.3.0
Status   : MISMATCH
```

### SERVICE NOT RUNNING

Jika service tidak ditemukan atau tidak sedang running:

```text
Expected : v2.3.1
Actual   : -
Status   : SERVICE NOT RUNNING
```

Kondisi tersebut dapat diuji dengan:

```bash
docker compose stop api-gateway
```

Kemudian service dapat dijalankan kembali:

```bash
docker compose start api-gateway
```

Status `MISMATCH` pada kondisi akhir bukan merupakan error aplikasi. Status tersebut menunjukkan bahwa version checker berhasil mendeteksi perbedaan antara desired state dan deployment aktual.

---

# Pendekatan Multi-Environment

Implementasi saat ini menggunakan satu Docker Engine.

Jika solusi dikembangkan untuk banyak environment seperti:

```text
development
staging
production
```

dashboard sebaiknya tidak mengakses Docker socket dari setiap server secara langsung.

Pendekatan yang lebih sesuai adalah menggunakan collector atau agent pada masing-masing environment:

```text
Docker Engine / Container Platform
              |
              v
      Collector / Agent
              |
              v
          Central API
              |
              v
      Database / State Store
              |
              v
           Dashboard
```

Collector mengambil informasi seperti:

- Environment
- Service
- Image
- Tag
- Container status
- Timestamp

Data kemudian dikirim ke central service.

Version check juga sebaiknya dipindahkan dari frontend menjadi **scheduled job** atau background process sehingga pengecekan tetap berjalan tanpa bergantung pada dashboard yang sedang dibuka.

Pendekatan tersebut dapat dikembangkan untuk mendukung:

- Banyak host
- Banyak environment
- Banyak service
- Deployment history
- Alerting
- CI/CD integration
- Artifact Registry
- Audit trail
- Scheduled reconciliation

---

# Asumsi

Beberapa asumsi yang digunakan:

1. Docker Engine dapat diakses melalui `/var/run/docker.sock`.
2. Environment container ditentukan dari label `com.project.env`.
3. Container tanpa label environment dikategorikan sebagai `unknown`.
4. `expected_tag` pada `desired-state.json` merupakan Docker image tag.
5. Service target berada pada Docker Engine yang sama dengan dashboard.
6. Label `com.docker.compose.service` digunakan sebagai identifikasi utama service.
7. Nama container digunakan sebagai fallback jika label service tidak tersedia.
8. `desired-state.json` saat ini berisi satu service target.

---

# Batasan

Implementasi saat ini memiliki beberapa batasan:

- Hanya membaca satu Docker Engine.
- Belum menyimpan deployment history.
- `desired-state.json` hanya menangani satu service.
- Belum memiliki alert otomatis untuk `MISMATCH` atau `SERVICE NOT RUNNING`.
- Belum memiliki authentication dan authorization.
- Dashboard masih menggunakan Docker socket lokal sebagai sumber data.

Akses ke Docker socket memiliki privilege yang tinggi. Untuk penggunaan production, sebaiknya digunakan backend atau collector dengan permission yang lebih terbatas.

---

# Rencana Pengembangan

Jika solusi dikembangkan lebih lanjut:

1. Mengganti akses langsung ke Docker socket dengan backend/collector service.
2. Menambahkan dukungan multi-host dan multi-environment.
3. Menambahkan database untuk menyimpan deployment history.
4. Mendukung desired state untuk banyak service.
5. Menjalankan version check melalui scheduled job.
6. Menambahkan alert untuk mismatch atau service yang tidak berjalan.
7. Menambahkan authentication dan role-based access.
8. Mengintegrasikan deployment status dengan CI/CD dan Artifact Registry.

Dengan pengembangan tersebut, traceability dapat diperluas menjadi:

```text
Task Management
      ↓
Repository
      ↓
CI/CD
      ↓
Quality
      ↓
Artifact Registry
      ↓
Deployment
```

---

# Validasi

Validasi Docker Compose:

```bash
docker compose config
```

Build dan jalankan environment:

```bash
docker compose up -d --build
```

Periksa seluruh container:

```bash
docker compose ps
```

Periksa `reporting-service`:

```bash
docker compose logs --tail=10 reporting-service
```

Expected:

```text
reporting-service started
```

Buka dashboard:

```text
http://localhost:8080
```

Kondisi akhir version check:

```text
Service  : api-gateway
Expected : v2.3.1
Actual   : v2.3.0
Status   : MISMATCH
```

`reporting-service` berada pada kondisi `Up` dan dashboard berada pada kondisi `healthy`.

---

# Ringkasan

| Soal                             | Hasil      |
| -------------------------------- | ---------- |
| Dashboard Status Container       | Selesai    |
| Grouping berdasarkan environment | Selesai    |
| Image + tag                      | Selesai    |
| UI improvement                   | Selesai    |
| Investigasi restart loop         | Selesai    |
| Root cause analysis              | Selesai    |
| Perbaikan `reporting-service`    | Selesai    |
| Deployment version check         | Selesai    |
| MATCH                            | Didukung   |
| MISMATCH                         | Didukung   |
| SERVICE NOT RUNNING              | Didukung   |
| Multi-environment approach       | Dijelaskan |

Kondisi akhir deployment:

```text
api-gateway
Expected : v2.3.1
Actual   : v2.3.0
Status   : MISMATCH
```

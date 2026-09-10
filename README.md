# Platform Engineer Support — Practical Test

Repository ini berisi hasil pengerjaan Tes Praktik Platform Engineer Support.

Problem statement asli:

https://github.com/suksest/plaform-engineer-support-prob

Solusi mencakup tiga bagian utama:

1. Dashboard status container menggunakan Docker API.
2. Investigasi dan perbaikan container yang mengalami restart loop.
3. Pengecekan kesesuaian versi deployment terhadap desired state.

---

## Daftar Isi

- [Requirements](#requirements)
- [Cara Menjalankan](#cara-menjalankan)
- [Struktur Project](#struktur-project)
- [Soal 1 — Dashboard Status Container](#soal-1--dashboard-status-container)
- [Soal 2 — Investigasi Container Bermasalah](#soal-2--investigasi-container-bermasalah)
- [Soal 3 — Cek Kesesuaian Versi Deployment](#soal-3--cek-kesesuaian-versi-deployment)
- [Pendekatan Multi-Environment](#pendekatan-multi-environment)
- [Asumsi](#asumsi)
- [Batasan](#batasan)
- [Rencana Pengembangan](#rencana-pengembangan)
- [Validasi Akhir](#validasi-akhir)

---

# Requirements

Pastikan environment yang digunakan memiliki:

- Docker Engine atau Docker Desktop
- Docker Compose
- Git
- Web browser

Untuk memeriksa Docker dan Docker Compose:

```bash
docker --version
docker compose version
```

Project diuji menggunakan Docker Compose dan dapat dijalankan pada environment yang memiliki akses ke Docker Engine.

---

# Cara Menjalankan

Clone repository:

```bash
git clone https://github.com/Ojanngehe/Tes-Praktik-Seleksi-MagangHub-Batch-2---Platform-Engineer-Support.git
cd Tes-Praktik-Seleksi-MagangHub-Batch-2---Platform-Engineer-Support
```

Build dan jalankan seluruh service:

```bash
docker compose up -d --build
```

Periksa status seluruh container:

```bash
docker compose ps
```

Dashboard dapat diakses melalui browser:

```text
http://localhost:8080
```

Port dashboard dapat diubah menggunakan environment variable `DASHBOARD_PORT`.

Contoh:

```bash
DASHBOARD_PORT=8081 docker compose up -d
```

Untuk menghentikan seluruh environment:

```bash
docker compose down
```

Untuk menghapus environment sekaligus volume:

```bash
docker compose down -v
```

---

# Struktur Project

```text
.
├── app/
│   ├── Dockerfile
│   └── index.html
│
├── dashboard/
│   ├── Dockerfile
│   ├── app.js
│   ├── index.html
│   └── nginx.conf
│
├── .env.example
├── .gitignore
├── desired-state.json
├── docker-compose.yml
└── README.md
```

Keterangan:

- `app/` digunakan untuk membuat service simulasi seperti `api-gateway`, `web-frontend`, dan `auth-service`.
- `dashboard/` berisi frontend dashboard serta konfigurasi Nginx.
- `desired-state.json` menyimpan target versi deployment untuk proses pengecekan versi.
- `docker-compose.yml` mendefinisikan seluruh service dan environment pengujian.

---

# Soal 1 — Dashboard Status Container

## Tujuan

Membuat dashboard yang mengambil informasi container dari Docker API dan menampilkan:

- Nama container
- Image dan tag
- Status container
- Environment
- Container ID
- Informasi waktu pembuatan container

Container juga dikelompokkan berdasarkan environment.

---

## Pendekatan

Dashboard mengambil data container melalui Docker API menggunakan endpoint:

```text
GET /containers/json?all=1
```

Query parameter:

```text
all=1
```

digunakan agar dashboard tidak hanya melihat container yang sedang berjalan, tetapi juga dapat membaca container dengan kondisi seperti `exited` jika tersedia.

Request dari frontend diteruskan melalui Nginx ke Docker Engine menggunakan Unix socket:

```text
/var/run/docker.sock
```

Frontend menggunakan same-origin request sehingga tidak perlu mengekspos Docker API melalui port TCP tambahan.

---

## Environment

Environment container ditentukan menggunakan Docker label:

```text
com.project.env
```

Contoh:

```text
com.project.env=production
```

atau:

```text
com.project.env=staging
```

Container kemudian dikelompokkan berdasarkan environment.

Environment yang digunakan pada project ini meliputi:

```text
production
staging
unknown
```

Jika suatu container tidak memiliki label:

```text
com.project.env
```

container tersebut dimasukkan ke kelompok:

```text
unknown
```

Environment juga ditampilkan secara eksplisit pada masing-masing container card.

---

## Status Container

Status container ditampilkan langsung pada dashboard.

Beberapa kondisi yang dianggap bermasalah adalah:

```text
restarting
exited
dead
```

Container yang berada pada kondisi tersebut diberikan penanda visual agar lebih mudah ditemukan.

Dashboard juga menampilkan ringkasan jumlah container dan jumlah container yang sedang bermasalah.

Contoh:

```text
7 container · 0 bermasalah
```

---

## Image dan Tag

Pada beberapa kondisi, endpoint:

```text
GET /containers/json
```

dapat menampilkan nilai image sebagai digest:

```text
sha256:...
```

Hal tersebut kurang informatif untuk kebutuhan dashboard karena image name dan tag tidak terlihat.

Untuk menangani kondisi tersebut, dashboard melakukan Docker Inspect menggunakan endpoint:

```text
GET /containers/{id}/json
```

dan mengambil configured image dari:

```text
Config.Image
```

Dengan pendekatan ini, dashboard dapat menampilkan image seperti:

```text
api-gateway:v2.3.0
web-frontend:v1.4.2
auth-service:v0.9.5
postgres:16-alpine
```

Jika `/containers/json` sudah memberikan image name dan tag, nilai tersebut dapat digunakan langsung.

---

## Auto Refresh

Dashboard melakukan refresh otomatis setiap:

```text
5 detik
```

Selain itu tersedia tombol:

```text
Muat Ulang
```

untuk melakukan refresh secara manual.

---

## UI

Sebagai bagian bonus, dashboard menggunakan tampilan dark UI dengan:

- Card per container
- Badge environment
- Badge status
- Highlight untuk container bermasalah
- Responsive grid
- Deployment Version Check panel

Tujuan perubahan UI adalah membuat informasi operasional lebih mudah dibaca dan container bermasalah lebih cepat ditemukan.

---

## Dashboard Healthcheck

Pada pengujian awal, dashboard dapat diakses normal dari browser tetapi container berstatus:

```text
unhealthy
```

Investigasi dari dalam container menggunakan:

```bash
docker compose exec dashboard wget -S -O - http://localhost/
```

menghasilkan koneksi ke:

```text
::1
```

dan gagal dengan:

```text
Connection refused
```

Sedangkan request ke:

```bash
docker compose exec dashboard wget -S -O - http://127.0.0.1/
```

menghasilkan:

```text
HTTP/1.1 200 OK
```

Hal ini terjadi karena `localhost` pada container ter-resolve ke IPv6, sedangkan endpoint Nginx dapat diakses melalui IPv4.

Healthcheck kemudian menggunakan:

```yaml
healthcheck:
  test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1/"]
```

Setelah perubahan, status dashboard menjadi:

```text
healthy
```

---

# Soal 2 — Investigasi Container Bermasalah

## Kondisi Awal

Container yang terdeteksi bermasalah adalah:

```text
reporting-service
```

Pemeriksaan menggunakan:

```bash
docker compose ps
```

menunjukkan status:

```text
Restarting (1)
```

Hal ini menunjukkan bahwa proses utama container terus berhenti dan Docker mencoba menjalankannya kembali.

---

## Investigasi Logs

Logs diperiksa menggunakan:

```bash
docker compose logs --tail=20 reporting-service
```

Pesan error yang ditemukan:

```text
[FATAL] REPORTING_DB_URL is not set - cannot connect to reporting database
```

Pesan tersebut menunjukkan bahwa startup `reporting-service` membutuhkan environment variable:

```text
REPORTING_DB_URL
```

tetapi variable tersebut belum tersedia.

---

## Investigasi Docker Inspect

State container diperiksa menggunakan:

```bash
docker inspect pe-support-test-reporting-service-1
```

Untuk mendapatkan informasi yang lebih ringkas digunakan:

```bash
docker inspect pe-support-test-reporting-service-1 --format='ExitCode={{.State.ExitCode}} Status={{.State.Status}} Restarting={{.State.Restarting}} Error={{.State.Error}}'
```

Hasil kondisi awal:

```text
ExitCode=1
Status=restarting
Restarting=true
```

Environment variable container juga diperiksa menggunakan:

```bash
docker inspect pe-support-test-reporting-service-1 --format='{{range .Config.Env}}{{println .}}{{end}}'
```

Pada kondisi awal, output tidak memiliki:

```text
REPORTING_DB_URL
```

---

## Root Cause

`reporting-service` memiliki startup command yang memeriksa keberadaan:

```text
REPORTING_DB_URL
```

Jika variable tersebut kosong, proses mengeluarkan pesan:

```text
[FATAL] REPORTING_DB_URL is not set - cannot connect to reporting database
```

kemudian berhenti dengan:

```text
exit code 1
```

Container juga menggunakan restart policy:

```yaml
restart: always
```

Akibatnya proses yang gagal terus dijalankan kembali oleh Docker dan menghasilkan restart loop.

Dengan demikian, melakukan:

```text
docker restart
```

saja tidak menyelesaikan masalah karena tidak memperbaiki root cause.

---

## Perbaikan

Konfigurasi PostgreSQL pada environment menggunakan:

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

Kemudian `REPORTING_DB_URL` ditambahkan pada `reporting-service`:

```yaml
environment:
  REPORTING_DB_URL: "postgres://app:apppass@postgres:5432/appdb"
```

Container kemudian dibuat ulang:

```bash
docker compose up -d --force-recreate reporting-service
```

Logs diperiksa kembali:

```bash
docker compose logs --tail=10 reporting-service
```

Hasil setelah perbaikan:

```text
reporting-service started
```

Status container:

```bash
docker compose ps reporting-service
```

berubah menjadi:

```text
Up
```

Dengan demikian, restart loop berhasil diselesaikan dengan memperbaiki konfigurasi environment variable yang menjadi root cause.

---

# Soal 3 — Cek Kesesuaian Versi Deployment

## Desired State

Target deployment disimpan pada:

```text
desired-state.json
```

Isi default:

```json
{
  "service": "api-gateway",
  "expected_tag": "v2.3.1"
}
```

Sementara deployment aktual menggunakan image:

```text
api-gateway:v2.3.0
```

---

## Pendekatan

Dashboard melakukan proses:

1. Membaca `service` dan `expected_tag` dari `desired-state.json`.
2. Mengambil daftar container melalui Docker API.
3. Mencari container berdasarkan nama service.
4. Memastikan container target sedang berjalan.
5. Mengambil configured image container.
6. Mengekstrak image tag aktual.
7. Membandingkan actual tag dengan expected tag.
8. Menampilkan hasil pada dashboard.

Untuk mengidentifikasi service Docker Compose digunakan label:

```text
com.docker.compose.service
```

Jika label tidak tersedia, nama container digunakan sebagai fallback.

---

## Mengambil Image Aktual

Image aktual diperoleh melalui Docker API.

Jika informasi image dari:

```text
GET /containers/json
```

tidak cukup dan hanya menghasilkan digest, digunakan Docker Inspect:

```text
GET /containers/{id}/json
```

Kemudian image diambil dari:

```text
Config.Image
```

Contoh:

```text
api-gateway:v2.3.0
```

Tag kemudian diekstrak menjadi:

```text
v2.3.0
```

---

## Status Deployment

Terdapat tiga status yang dapat ditampilkan.

### MATCH

Jika actual tag sama dengan expected tag:

```text
Expected : v2.3.0
Actual   : v2.3.0
Status   : MATCH
```

---

### MISMATCH

Jika service berjalan tetapi version tag berbeda:

```text
Expected : v2.3.1
Actual   : v2.3.0
Status   : MISMATCH
```

Ini merupakan kondisi default pada problem statement.

---

### SERVICE NOT RUNNING

Jika service target tidak ditemukan atau tidak berada pada state:

```text
running
```

maka dashboard menampilkan:

```text
Expected : v2.3.1
Actual   : -
Status   : SERVICE NOT RUNNING
```

---

## Pengujian SERVICE NOT RUNNING

Kondisi ini dapat direproduksi menggunakan:

```bash
docker compose stop api-gateway
```

Dashboard kemudian mendeteksi bahwa service tidak sedang berjalan.

Untuk menghidupkannya kembali:

```bash
docker compose start api-gateway
```

---

## Pengujian MATCH

Untuk menguji kondisi `MATCH`, `desired-state.json` dapat sementara diubah menjadi:

```json
{
  "service": "api-gateway",
  "expected_tag": "v2.3.0"
}
```

Kemudian rebuild dashboard:

```bash
docker compose build dashboard
docker compose up -d --force-recreate dashboard
```

Expected dan actual version menjadi:

```text
Expected : v2.3.0
Actual   : v2.3.0
Status   : MATCH
```

Setelah pengujian, `desired-state.json` dikembalikan ke kondisi problem statement:

```json
{
  "service": "api-gateway",
  "expected_tag": "v2.3.1"
}
```

Sehingga kondisi akhir kembali menjadi:

```text
Expected : v2.3.1
Actual   : v2.3.0
Status   : MISMATCH
```

Status `MISMATCH` pada kondisi akhir bukan merupakan error pada aplikasi, tetapi menunjukkan bahwa version checker berhasil mendeteksi perbedaan antara desired state dan deployment aktual.

---

# Pendekatan Multi-Environment

Implementasi saat ini menggunakan satu Docker Engine.

Untuk penggunaan pada banyak environment seperti:

```text
development
staging
production
```

pendekatan yang digunakan perlu diubah karena dashboard tidak sebaiknya terhubung langsung ke Docker socket pada setiap server.

Pendekatan yang dapat digunakan adalah menyediakan collector atau agent pada setiap environment.

Contoh arsitektur:

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

Collector bertugas mengambil informasi seperti:

```text
environment
service
image
tag
container status
timestamp
```

dari masing-masing environment.

Informasi tersebut kemudian dikirimkan ke central service.

Pengecekan versi juga sebaiknya dipindahkan dari frontend menjadi scheduled job atau background service.

Contoh proses:

```text
Read Desired State
        |
        v
Read Actual Deployment
        |
        v
Compare Version
        |
        v
Store Result
        |
        v
MATCH / MISMATCH / SERVICE NOT RUNNING
```

Dengan pendekatan tersebut, pengecekan tidak bergantung pada browser yang sedang membuka dashboard.

Pendekatan ini juga lebih mudah dikembangkan untuk:

- Banyak server
- Banyak environment
- Banyak service
- Deployment history
- Alert dan notification
- CI/CD integration
- Artifact Registry
- Audit trail
- Scheduled reconciliation
- Role-based access

---

# Asumsi

Beberapa asumsi yang digunakan dalam pengerjaan:

1. Docker Engine dapat diakses oleh container dashboard melalui:

   ```text
   /var/run/docker.sock
   ```

2. Environment container ditentukan melalui label:

   ```text
   com.project.env
   ```

3. Container tanpa label environment dikategorikan sebagai:

   ```text
   unknown
   ```

4. `expected_tag` pada `desired-state.json` merupakan Docker image tag.

5. Service target pada implementasi saat ini berjalan pada Docker Engine yang sama dengan dashboard.

6. Label:

   ```text
   com.docker.compose.service
   ```

   digunakan untuk mencocokkan service dengan container.

7. Nama container digunakan sebagai fallback jika label service tidak tersedia.

8. `desired-state.json` pada implementasi saat ini berisi satu service target.

---

# Batasan

Implementasi saat ini memiliki beberapa batasan.

### Single Docker Engine

Dashboard saat ini membaca satu Docker Engine melalui:

```text
/var/run/docker.sock
```

Sehingga belum secara langsung mendukung banyak host atau banyak Docker Engine.

### Tidak Ada Deployment History

Status container dan version check yang ditampilkan merupakan kondisi terkini.

Belum terdapat persistent storage untuk menyimpan history deployment.

### Satu Desired Service

`desired-state.json` saat ini hanya menangani satu service target.

### Tidak Ada Alert Otomatis

Kondisi:

```text
MISMATCH
```

atau:

```text
SERVICE NOT RUNNING
```

hanya ditampilkan pada dashboard dan belum menghasilkan notification.

### Tidak Ada Authentication

Dashboard digunakan sebagai environment tes lokal sehingga belum memiliki authentication dan authorization.

### Docker Socket Access

Docker socket memberikan akses yang sensitif terhadap Docker Engine.

Pendekatan ini sesuai untuk environment tes, tetapi untuk production sebaiknya frontend tidak diberikan akses langsung ke Docker socket.

---

# Rencana Pengembangan

Jika solusi dikembangkan lebih lanjut untuk production, beberapa peningkatan yang dapat dilakukan adalah:

### 1. Backend atau Collector Service

Mengganti akses langsung dashboard terhadap Docker socket dengan backend atau collector yang memiliki permission terbatas.

Dashboard hanya berkomunikasi dengan API dari backend tersebut.

### 2. Multi-Environment Support

Menambahkan collector untuk setiap environment:

```text
development
staging
production
```

Data dari setiap environment dikirim menuju central service.

### 3. Persistent Storage

Menambahkan database untuk menyimpan:

- Status container
- Deployment version
- Environment
- Timestamp
- History perubahan deployment

### 4. Multiple Desired States

Mengembangkan format desired state agar dapat menangani banyak service.

Contoh:

```json
{
  "services": [
    {
      "service": "api-gateway",
      "expected_tag": "v2.3.1"
    },
    {
      "service": "web-frontend",
      "expected_tag": "v1.4.2"
    }
  ]
}
```

### 5. Scheduled Version Check

Memindahkan version check dari browser menjadi scheduled job atau background process.

Dengan demikian, pengecekan tetap berjalan meskipun dashboard tidak sedang dibuka.

### 6. Alerting

Menambahkan notification ketika ditemukan:

```text
MISMATCH
SERVICE NOT RUNNING
```

Notification dapat dikirim melalui channel seperti email atau platform komunikasi internal.

### 7. Authentication dan Authorization

Menambahkan authentication dan role-based access apabila dashboard digunakan pada environment production.

### 8. CI/CD dan Artifact Registry Integration

Deployment version dapat dihubungkan dengan pipeline CI/CD dan Artifact Registry sehingga traceability dapat dilakukan dari:

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

Dengan pendekatan ini, versi yang sedang berjalan dapat dilacak kembali hingga source code dan proses build yang menghasilkan artifact tersebut.

---

# Validasi Akhir

Validasi konfigurasi Docker Compose:

```bash
docker compose config
```

Build dan jalankan seluruh environment:

```bash
docker compose up -d --build
```

Periksa seluruh container:

```bash
docker compose ps
```

Periksa reporting service:

```bash
docker compose ps reporting-service
```

Periksa logs reporting service:

```bash
docker compose logs --tail=10 reporting-service
```

Expected log setelah perbaikan:

```text
reporting-service started
```

Periksa dashboard:

```text
http://localhost:8080
```

Pada kondisi akhir, version check menunjukkan:

```text
Service  : api-gateway
Expected : v2.3.1
Actual   : v2.3.0
Status   : MISMATCH
```

`reporting-service` berada pada status:

```text
Up
```

dan dashboard berada pada kondisi:

```text
healthy
```

---

# Ringkasan Hasil

## Soal 1

Dashboard berhasil:

- Mengambil data container dari Docker API
- Menampilkan nama container
- Menampilkan image dan tag
- Menampilkan status
- Menampilkan environment
- Mengelompokkan container berdasarkan environment
- Mendeteksi container bermasalah
- Melakukan auto-refresh
- Menyediakan UI yang lebih nyaman digunakan

## Soal 2

`reporting-service` berhasil diinvestigasi.

Root cause ditemukan berupa:

```text
REPORTING_DB_URL tidak tersedia
```

Container berhenti dengan:

```text
ExitCode=1
```

dan restart policy menyebabkan restart loop.

Masalah diperbaiki dengan memberikan connection string yang diperlukan sehingga container kembali berada pada status:

```text
Up
```

## Soal 3

Deployment Version Check berhasil:

- Membaca `desired-state.json`
- Mengambil versi aktual melalui Docker API
- Membandingkan expected dan actual tag
- Menghasilkan status `MATCH`
- Menghasilkan status `MISMATCH`
- Menghasilkan status `SERVICE NOT RUNNING`

Kondisi akhir:

```text
api-gateway
Expected : v2.3.1
Actual   : v2.3.0
Status   : MISMATCH
```

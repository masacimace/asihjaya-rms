export type HardwareGuideBadge =
  | "development"
  | "outlet"
  | "production"
  | "safety";

export type HardwareGuideCommand = {
  label?: string;
  code: string;
};

export type HardwareGuideCallout = {
  tone: "info" | "warning" | "danger" | "success";
  title: string;
  body: string;
};

export type HardwareGuideStep = {
  id: string;
  title: string;
  body: string[];
  commands?: HardwareGuideCommand[];
  checks?: string[];
  callout?: HardwareGuideCallout;
};

export type HardwareGuideSection = {
  id: string;
  title: string;
  summary: string;
  badges: HardwareGuideBadge[];
  steps: HardwareGuideStep[];
};

export const HARDWARE_SETUP_GUIDE_VERSION = "1.0.0-pr10";

export const hardwareSetupGuideSections: HardwareGuideSection[] = [
  {
    id: "architecture",
    title: "1. Arsitektur dan aturan dasar",
    summary:
      "Pahami alur job sebelum memasang software agar Android POS tidak pernah mencoba mengakses printer USB secara langsung.",
    badges: ["development", "outlet", "production"],
    steps: [
      {
        id: "architecture-flow",
        title: "Alur integrasi",
        body: [
          "Android POS dan browser admin membuat hardware job ke RMS. Cloud menyimpan intent, lalu Hardware Hub Agent pada Mini PC melakukan claim, menyimpan attempt ke SQLite, dan menjalankan adapter printer.",
          "Mini PC adalah satu-satunya komponen yang berinteraksi dengan printer USB/Windows spooler. Android tidak perlu driver SATO atau Epson.",
        ],
        commands: [
          {
            code: "Android POS → RMS Cloud/API → Hardware Job Queue → Windows Mini PC → SATO / Epson / Cash Drawer",
          },
        ],
        callout: {
          tone: "warning",
          title: "Effectively-once execution",
          body: "Setelah dispatch dimulai, job yang hasilnya tidak pasti tidak boleh dicetak ulang otomatis. Gunakan halaman Unknown Outcome untuk keputusan operator.",
        },
      },
      {
        id: "architecture-status",
        title: "Status kesiapan yang digunakan",
        body: [
          "Gunakan tiga status terpisah: Implemented, Simulated and automated-test passed, dan Physically validated.",
          "Receipt A4 dan SBPL dapat dinyatakan simulated sebelum diuji secara fisik. Margin Epson, sensor SATO, darkness, speed, dan barcode scan tetap menunggu validasi outlet.",
        ],
      },
    ],
  },
  {
    id: "windows-preparation",
    title: "2. Persiapan Mini PC Windows 10",
    summary:
      "Siapkan dedicated Windows user dan konfigurasi daya sebelum menginstal agent.",
    badges: ["outlet", "production", "safety"],
    steps: [
      {
        id: "windows-account",
        title: "Buat dedicated Windows user",
        body: [
          "Gunakan satu user Windows khusus Hardware Hub dan jalankan instalasi printer, DPAPI check, agent manual, serta Scheduled Task dengan user yang sama.",
          "DPAPI memakai CurrentUser. Mengganti user setelah attempt tersimpan dapat membuat lease token lokal tidak dapat dibuka.",
        ],
        checks: [
          "User memiliki password dan tidak menggunakan guest account.",
          "User dapat login interaktif untuk instalasi driver dan troubleshooting.",
          "Folder C:\\ASIHJAYA dapat ditulis oleh user tersebut.",
        ],
      },
      {
        id: "windows-power",
        title: "Atur power, waktu, dan jaringan",
        body: [
          "Matikan sleep dan hibernation selama jam outlet. Pastikan timezone Asia/Jakarta dan Windows Time aktif.",
          "Gunakan koneksi internet stabil. Ethernet lebih disarankan untuk Mini PC; printer Epson dapat tetap USB atau Wi-Fi sesuai hasil UAT.",
        ],
        checks: [
          "Sleep = Never saat terhubung listrik.",
          "Tanggal, waktu, dan timezone benar.",
          "Disk kosong minimal 10 GB.",
          "Windows Update dan restart selesai sebelum UAT.",
        ],
      },
    ],
  },
  {
    id: "software-installation",
    title: "3. Software yang harus di-install",
    summary:
      "Gunakan versi runtime yang kompatibel dan hindari aplikasi portable dari sumber yang tidak tepercaya.",
    badges: ["development", "outlet", "production"],
    steps: [
      {
        id: "install-node",
        title: "Node.js 22 atau 24",
        body: [
          "Hardware Hub memerlukan Node.js minimal 22.5 dan kurang dari 25 karena menggunakan built-in node:sqlite.",
        ],
        commands: [
          { code: "node -v" },
          { code: "npm -v" },
        ],
        checks: ["Versi Node memenuhi >=22.5 dan <25."],
      },
      {
        id: "install-sumatra",
        title: "SumatraPDF",
        body: [
          "Install SumatraPDF pada path yang tetap. Agent memakai executable ini sebagai Windows PDF print runner dengan argument allowlisted.",
        ],
        commands: [
          {
            code: 'Test-Path "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe"',
          },
        ],
        checks: [
          "Executable ditemukan.",
          "PDF dapat dibuka secara manual.",
          "Jangan mengisi raw PDF_PRINT_COMMAND untuk Protocol v2.",
        ],
      },
      {
        id: "install-drivers",
        title: "Driver printer resmi",
        body: [
          "Install driver Windows SATO CG408TT dan Epson EcoTank L3251 dari vendor/reseller resmi. Catat nama printer persis seperti yang tampil di Windows.",
        ],
        commands: [
          {
            code: "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus",
          },
        ],
      },
    ],
  },
  {
    id: "printer-preparation",
    title: "4. Persiapan hardware fisik",
    summary:
      "Pastikan perangkat dapat dipakai dari Windows sebelum melibatkan RMS atau agent.",
    badges: ["outlet", "safety"],
    steps: [
      {
        id: "prepare-sato",
        title: "SATO CG408TT",
        body: [
          "Pasang media label dan ribbon sesuai spesifikasi. Hubungkan USB, install driver, lalu lakukan test print Windows/vendor terlebih dahulu.",
          "Ukur label fisik dan gap. Nilai development 400×300 dots bukan ukuran final sampai diverifikasi pada media outlet.",
        ],
        checks: [
          "Printer muncul di Get-Printer.",
          "Nama printer dicatat untuk LABEL_PRINTER_NAME.",
          "Media dan ribbon terpasang.",
          "Calibration/gap sensor vendor selesai.",
        ],
      },
      {
        id: "prepare-epson",
        title: "Epson EcoTank L3251",
        body: [
          "Install driver resmi, pilih A4, dan lakukan test page dari Windows. Nama driver dapat tampil sebagai EPSON L3250 Series; gunakan nama yang benar-benar muncul pada Mini PC.",
        ],
        checks: [
          "Printer muncul di Get-Printer.",
          "Test page Windows berhasil.",
          "Paper A4 tersedia pada driver.",
          "Nama printer dicatat untuk DOCUMENT_PRINTER_NAME.",
        ],
      },
      {
        id: "prepare-drawer",
        title: "Cash drawer",
        body: [
          "Biarkan adapter drawer pada mode fake sampai model dan interface final. Drawer RJ11 biasanya membutuhkan receipt printer/trigger yang kompatibel; Epson L3251 bukan interface drawer kick yang ideal.",
        ],
        callout: {
          tone: "danger",
          title: "Jangan aktifkan drawer real dulu",
          body: "PR 10 memblokir aktivasi drawer real sebagai default. Tentukan model, trigger, pin, dan pulse timing terlebih dahulu.",
        },
      },
    ],
  },
  {
    id: "agent-placement",
    title: "5. Menempatkan source Hardware Hub",
    summary:
      "Gunakan folder permanen dan jangan menjalankan agent dari Downloads atau folder sementara.",
    badges: ["development", "outlet", "production"],
    steps: [
      {
        id: "agent-folder",
        title: "Folder yang direkomendasikan",
        body: [
          "Salin folder hardware-hub dari release/repository ke C:\\ASIHJAYA\\hardware-hub. Pastikan user Hardware Hub memiliki akses read/write.",
        ],
        commands: [
          { code: "New-Item -ItemType Directory -Force C:\\ASIHJAYA" },
          { code: "cd C:\\ASIHJAYA\\hardware-hub" },
          { code: "npm install --omit=dev" },
        ],
        checks: [
          "Folder data, logs, support-bundles, dan outlet-reports dapat dibuat.",
          "node_modules tidak disalin dari komputer/OS lain; jalankan npm install pada Mini PC.",
        ],
      },
    ],
  },
  {
    id: "agent-registration",
    title: "6. Register agent pada RMS",
    summary:
      "Agent harus terikat ke organization, outlet, dan register yang benar.",
    badges: ["development", "outlet", "production", "safety"],
    steps: [
      {
        id: "create-agent",
        title: "Buat atau pilih Hardware Agent",
        body: [
          "Gunakan tool administrasi project untuk membuat agent, lalu simpan Agent ID dan secret hanya pada Mini PC yang bersangkutan.",
        ],
        commands: [
          { code: "npm run hardware:agent:create" },
        ],
        checks: [
          "Outlet benar.",
          "Register benar.",
          "Secret minimal 32 karakter.",
          "Secret tidak dikirim melalui grup chat umum atau dimasukkan ke Git.",
        ],
        callout: {
          tone: "warning",
          title: "Secret hanya untuk satu agent",
          body: "Jangan memakai secret yang sama untuk beberapa Mini PC. Rotate atau revoke bila perangkat diganti.",
        },
      },
    ],
  },
  {
    id: "environment-configuration",
    title: "7. Membuat file .env agent",
    summary:
      "Mulai dari fake mode, lalu aktifkan hardware real satu per satu setelah preflight lulus.",
    badges: ["development", "outlet", "production", "safety"],
    steps: [
      {
        id: "copy-env",
        title: "Copy template outlet",
        body: [
          "Gunakan .env.outlet.example sebagai template. Jangan commit .env hasil konfigurasi.",
        ],
        commands: [
          { code: "Copy-Item .env.outlet.example .env" },
        ],
      },
      {
        id: "set-api-url",
        title: "Pilih URL RMS yang benar",
        body: [
          "Local development memakai localhost:3000. Docker validation memakai localhost:3001. Outlet production wajib HTTPS ke domain cloud.",
        ],
        commands: [
          { label: "Local development", code: "ASIHJAYA_API_URL=http://localhost:3000" },
          { label: "Docker validation", code: "ASIHJAYA_API_URL=http://localhost:3001" },
          { label: "Production", code: "ASIHJAYA_API_URL=https://rms.example.com" },
        ],
      },
      {
        id: "safe-defaults",
        title: "Gunakan fake mode sebagai default",
        body: [
          "Sebelum physical validation, seluruh adapter harus fake. Cash drawer tetap fake sampai perangkat final tersedia.",
        ],
        commands: [
          {
            code: "HARDWARE_ADAPTER_MODE=fake\nLABEL_PRINTER_ADAPTER=fake\nDOCUMENT_PRINTER_ADAPTER=fake\nCASH_DRAWER_ADAPTER=fake",
          },
        ],
      },
    ],
  },
  {
    id: "self-tests",
    title: "8. Install dependency dan jalankan self-test",
    summary:
      "Agent tidak boleh claim job bila DPAPI, SQLite journal, atau konfigurasi belum sehat.",
    badges: ["development", "outlet", "production"],
    steps: [
      {
        id: "run-self-tests",
        title: "Pemeriksaan wajib",
        body: [
          "Jalankan seluruh command dengan Windows user yang sama dengan Scheduled Task.",
        ],
        commands: [
          {
            code: "npm install --omit=dev\nnpm run check:dpapi\nnpm run check\nnpm run check:v2\nnpm run check:operations\nnpm run check:sato\nnpm run check:print-profiles\nnpm run outlet:preflight",
          },
        ],
        checks: [
          "DPAPI round-trip OK.",
          "Config check tidak memiliki BLOCKED/error.",
          "SQLite journal dapat dibuka.",
          "Health server loopback valid.",
        ],
      },
    ],
  },
  {
    id: "local-development",
    title: "9. Integrasi local development",
    summary:
      "Jalankan database, Next.js, dan agent pada terminal terpisah.",
    badges: ["development"],
    steps: [
      {
        id: "run-local-stack",
        title: "Tiga terminal",
        body: [
          "Database tetap di Docker, sedangkan Next.js dan agent dapat berjalan langsung pada Windows untuk proses coding.",
        ],
        commands: [
          { label: "Terminal 1 — database", code: "docker compose up -d db" },
          { label: "Terminal 2 — web", code: "npm run dev" },
          {
            label: "Terminal 3 — agent",
            code: "cd hardware-hub\nnpm start",
          },
        ],
        checks: [
          "Web dapat dibuka di http://localhost:3000.",
          "Agent tampil online pada Hardware Hub.",
          "Local health tersedia pada http://127.0.0.1:3210/health.",
        ],
      },
    ],
  },
  {
    id: "fake-validation",
    title: "10. Validasi end-to-end dengan fake adapter",
    summary:
      "Fake mode tetap memakai claim, lease, SQLite journal, download PDF, dan lifecycle Protocol v2.",
    badges: ["development", "outlet", "safety"],
    steps: [
      {
        id: "test-buttons",
        title: "Jalankan test dari dashboard",
        body: [
          "Klik Tes Label, Test Nota PDF, dan Test Drawer. Periksa status job serta artifact yang dibuat.",
        ],
        commands: [
          { code: "Get-ChildItem .\\data\\fake-output -Recurse" },
        ],
        checks: [
          "label.sbpl dan artifact.json tersedia.",
          "document.pdf dan artifact.json tersedia.",
          "drawer.json tersedia.",
          "Job mencapai completed.",
        ],
      },
      {
        id: "generate-fixtures",
        title: "Generate calibration fixtures",
        body: [
          "Fixture tidak memakai data transaksi. Gunakan untuk inspeksi SBPL dan PDF A4 sebelum real mode.",
        ],
        commands: [
          { code: "npm run outlet:fixtures" },
        ],
      },
    ],
  },
  {
    id: "switch-real",
    title: "11. Beralih ke real hardware secara bertahap",
    summary:
      "Aktifkan hanya satu device setelah preflight dan fake test lulus.",
    badges: ["outlet", "production", "safety"],
    steps: [
      {
        id: "real-label",
        title: "Aktifkan SATO terlebih dahulu",
        body: [
          "Script membuat backup .env, menolak perubahan bila masih ada local active attempt, memvalidasi printer name, lalu menjalankan config check.",
        ],
        commands: [
          { code: "npm run outlet:enable-real-label" },
        ],
        checks: [
          "Document printer tetap fake.",
          "Cash drawer tetap fake.",
          "Satu test label berhasil sebelum batch test.",
        ],
      },
      {
        id: "real-document",
        title: "Aktifkan Epson setelah SATO stabil",
        body: [
          "Pastikan SumatraPDF dan printer Epson tersedia. Profile default adalah epson_l3251_a4_v1 dan receipt A4 landscape.",
        ],
        commands: [
          { code: "npm run outlet:enable-real-document" },
        ],
        checks: [
          "A4 tidak terpotong.",
          "Orientasi landscape benar.",
          "Scaling fit tidak merusak design.",
        ],
      },
      {
        id: "rollback-fake",
        title: "Rollback bila ada masalah",
        body: [
          "Rollback tidak menghapus SQLite journal, job cloud, atau evidence attempt.",
        ],
        commands: [
          { code: "npm run outlet:rollback-to-fake\nnpm run support:bundle" },
        ],
        callout: {
          tone: "danger",
          title: "Jangan hapus journal",
          body: "Jangan menghapus hardware-executions.sqlite untuk memperbaiki job. Resolve unknown outcome dari dashboard dan simpan support bundle.",
        },
      },
    ],
  },
  {
    id: "scheduled-task",
    title: "12. Setup operasional production Windows",
    summary:
      "Gunakan Scheduled Task dengan absolute path Node dan dedicated user yang sama.",
    badges: ["outlet", "production"],
    steps: [
      {
        id: "install-task",
        title: "Install production task",
        body: [
          "Jalankan setelah manual test dan preflight lulus. Script memasang dependency, memeriksa runtime, lalu membuat Scheduled Task.",
        ],
        commands: [
          { code: "npm run setup:production\nnpm run status\nnpm run health" },
        ],
        checks: [
          "Task menggunakan Windows user yang sama.",
          "Agent kembali online setelah restart Windows.",
          "Agent kedua ditolak oleh process lock.",
        ],
      },
    ],
  },
  {
    id: "physical-acceptance",
    title: "13. Physical hardware acceptance test",
    summary:
      "Uji happy path dan kegagalan nyata. Jangan hanya mengandalkan satu test print.",
    badges: ["outlet", "safety"],
    steps: [
      {
        id: "sato-acceptance",
        title: "SATO CG408TT",
        body: [
          "Ukur media, tune offset, scan barcode menggunakan semua tipe Android sales, lalu uji kegagalan perangkat.",
        ],
        checks: [
          "1 label, 10 label, dan 100 label berurutan.",
          "Barcode dapat dipindai semua Android POS.",
          "Printer offline sebelum job.",
          "USB dicabut saat testing.",
          "Media/ribbon habis.",
          "Internet putus setelah dispatch tidak membuat duplicate print.",
        ],
      },
      {
        id: "epson-acceptance",
        title: "Epson L3251",
        body: [
          "Validasi A4 landscape, printable margin, fit scaling, warna, multi-page, dan Windows spooler behavior.",
        ],
        checks: [
          "Receipt pendek dan panjang.",
          "Printer offline.",
          "Kertas habis.",
          "USB/Wi-Fi putus.",
          "Restart agent setelah submission.",
          "Internet putus setelah print tidak memicu duplicate.",
        ],
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "14. Troubleshooting dan support bundle",
    summary:
      "Kumpulkan evidence sebelum restart, retry, atau mengubah konfigurasi.",
    badges: ["development", "outlet", "production", "safety"],
    steps: [
      {
        id: "common-errors",
        title: "Error yang sering ditemui",
        body: [
          "DPAPI error: jalankan npm run check:dpapi dengan user yang sama.",
          "Agent degraded/offline: periksa npm run health, npm run status, dan koneksi API.",
          "Printer not found: bandingkan LABEL_PRINTER_NAME/DOCUMENT_PRINTER_NAME dengan Get-Printer.",
          "PDF mismatch: periksa documentProfileId, printProfileId, dan artifact metadata.",
          "SATO barcode invalid: periksa barcode canonical database; agent tidak mengubah barcode diam-diam.",
          "Unknown outcome: jangan retry biasa; gunakan halaman detail job dan konfirmasi risiko duplikat.",
        ],
        commands: [
          { code: "npm run health\nnpm run status\nnpm run support:bundle" },
        ],
      },
      {
        id: "report",
        title: "Buat outlet report",
        body: [
          "Report menyimpan hasil preflight, konfigurasi yang sudah disanitasi, daftar printer, dan checklist acceptance. Foto hasil fisik ditambahkan manual.",
        ],
        commands: [
          { code: "npm run outlet:report" },
        ],
      },
    ],
  },
];

export const hardwareSetupFinalChecklist = [
  "Dedicated Windows user tersedia dan digunakan konsisten.",
  "Node.js, PowerShell, DPAPI, dan node:sqlite lulus self-test.",
  "Agent terikat ke outlet/register yang benar.",
  "Fake label, document, dan drawer test lulus.",
  "SATO terdeteksi dan barcode berhasil dipindai.",
  "Epson menghasilkan receipt A4 tanpa clipping.",
  "Scheduled Task menghidupkan kembali agent setelah restart.",
  "Failure scenarios dan unknown-outcome workflow diuji.",
  "Support bundle dan outlet report berhasil dibuat.",
  "Cash drawer tetap fake sampai perangkat/interface final tervalidasi.",
] as const;

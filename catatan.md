# 📑 Catatan Audit Hasil Kalkulasi Saldo Kas Admin

Dokumen ini berisi rincian audit finansial lengkap seluruh transaksi yang membentuk **Saldo Kas Operasional Admin (Rp 11.518.540)** pada sistem ARKA Finance.

---

## 📊 Ringkasan Eksekutif

- **Saldo Akhir Kas Admin**: **Rp 11.518.540** *(Match 100% dengan Dashboard)*
- **Total Transaksi Terlibat**: **68 Transaksi**
- **Total Uang Masuk**: **+Rp 53.088.874** *(Mutasi Kucuran / Refund)*
- **Total Uang Keluar**: **-Rp 41.570.334** *(Belanja Lapangan & Operasional Proyek)*

---

## 💡 Kategori Penyebab Saldo Kas Admin Rp 11.518.540

1. **Transfer Kucuran Modal / Mutasi Masuk (+Rp 53.088.874)**:
   Uang masuk dari BCA Utama / BRI Utama ke Kas Admin sebagai dana operasional proyek atau reimbursement.
2. **Pengeluaran Operasional / Belanja Proyek (-Rp 41.570.334)**:
   Pengeluaran yang terjadi di lapangan. Transaksi *legacy* tanpa `rekening_id` yang terikat pada `proyek_id` secara otomatis memotong Kas Admin.

---

## 📋 Daftar 68 Transaksi Kas Admin (Urut Kronologis Tanggal)

| No | Tanggal | ID Transaksi (Supabase) | Deskripsi Transaksi | Jenis & Kategori | Nominal | Saku DB (`rekening_id`) | Perubahan Saldo | Running Balance |
|:---:|:---:|:---:|:---|:---|:---:|:---:|:---:|:---:|
| 1 | 2026-07-20 | `txn_1784816199360_04x7h7q1q` | Akomodasi PP keberangkatan Bandara Soetta | PENGELUARAN (Transport & Bensin) | Rp 500.000 | `NULL (Default Proyek)` | **Rp -500.000** | **Rp -500.000** |
| 2 | 2026-07-20 | `txn_1784748193950_86wdjjsbf` | Perbantuan Bapak Rio | PENGELUARAN (Pengeluaran Lainnya) | Rp 3.000.000 | `NULL (Default Proyek)` | **Rp -3.000.000** | **Rp -3.500.000** |
| 3 | 2026-07-20 | `txn_1784630426547_7z70j9uqo` | Tiket pesawat berangkat Pak Habsi dan Fakhziar | PENGELUARAN (Transport & Bensin) | Rp 4.178.400 | `NULL (Default Proyek)` | **Rp -4.178.400** | **Rp -7.678.400** |
| 4 | 2026-07-20 | `txn_1784632868031_esnhvmm5d` | Cetak Stiker, Rompi dan Spidol (Reimbursement Arya) | PENGELUARAN (Peralatan & Sewa Alat) | Rp 381.715 | `NULL (Default Proyek)` | **Rp -381.715** | **Rp -8.060.115** |
| 5 | 2026-07-20 | `txn_1784630602184_0xnu3vy0s` | Etiket Pesawat Surabaya-Makassar (Kates) | PENGELUARAN (Transport & Bensin) | Rp 1.445.934 | `NULL (Default Proyek)` | **Rp -1.445.934** | **Rp -9.506.049** |
| 6 | 2026-07-20 | `txn_1784632631911_9bn5iwbuj` | Meeting dengan Pak Fatwa di LAMANSUA COFFEE and EATR | PENGELUARAN (Konsumsi & Akomodasi) | Rp 217.140 | `NULL (Default Proyek)` | **Rp -217.140** | **Rp -9.723.189** |
| 7 | 2026-07-20 | `txn_1784747094190_2vo8lav0z` | modal angkur | MUTASI MASUK (Mutasi Internal / Transfer Kas) | Rp 20.000.000 | `bri_utama` | **+Rp 20.000.000** | **Rp 10.276.811** |
| 8 | 2026-07-20 | `txn_1785138186898_30igsx771` | Biaya Admin Bank (BI-FAST) - Perbantuan Bapak Rio | PENGELUARAN (Biaya Admin Bank) | Rp 2.500 | `NULL (Default Proyek)` | **Rp -2.500** | **Rp 10.274.311** |
| 9 | 2026-07-21 | `txn_1784631390249_9ylvvn7y7` | DP Penginapan Resky | PENGELUARAN (Konsumsi & Akomodasi) | Rp 180.000 | `NULL (Default Proyek)` | **Rp -180.000** | **Rp 10.094.311** |
| 10 | 2026-07-21 | `txn_1785138194015_w208vvdhk` | Biaya Admin Bank (BI-FAST) - Pelunasan Crimping Ferulle Kates | PENGELUARAN (Biaya Admin Bank) | Rp 2.500 | `NULL (Default Proyek)` | **Rp -2.500** | **Rp 10.091.811** |
| 11 | 2026-07-21 | `txn_1784606414731_uxrgz359h` | Konsumsi Day 1 | PENGELUARAN (Konsumsi & Akomodasi) | Rp 150.000 | `NULL (Default Proyek)` | **Rp -150.000** | **Rp 9.941.811** |
| 12 | 2026-07-21 | `txn_1784606235199_obqrerl8l` | Top Up E toll - Reimbursement Ziar | PENGELUARAN (Transport & Bensin) | Rp 101.500 | `NULL (Default Proyek)` | **Rp -101.500** | **Rp 9.840.311** |
| 13 | 2026-07-21 | `txn_1785138175072_6n1czlocs` | Biaya Admin Bank (BI-FAST) - Pelunasan biaya penginapan Resky (3 hari) | PENGELUARAN (Biaya Admin Bank) | Rp 2.500 | `NULL (Default Proyek)` | **Rp -2.500** | **Rp 9.837.811** |
| 14 | 2026-07-21 | `txn_1784631741651_e3mt9aggt` | Pelunasan biaya penginapan Resky (3 hari) | PENGELUARAN (Konsumsi & Akomodasi) | Rp 585.102 | `NULL (Default Proyek)` | **Rp -585.102** | **Rp 9.252.709** |
| 15 | 2026-07-21 | `txn_1784632325321_ovate5rpm` | Pelunasan Crimping Ferulle Kates | PENGELUARAN (Pengeluaran Lainnya) | Rp 750.000 | `NULL (Default Proyek)` | **Rp -750.000** | **Rp 8.502.709** |
| 16 | 2026-07-21 | `txn_1784631208949_je7x038wo` | DP Sewa Mobil Makassar (A23) | PENGELUARAN (Transport & Bensin) | Rp 300.000 | `NULL (Default Proyek)` | **Rp -300.000** | **Rp 8.202.709** |
| 17 | 2026-07-21 | `txn_1784605990038_e27oioy6z` | Extra Baggage Pelita Air - Reimbursement Ziar | PENGELUARAN (Transport & Bensin) | Rp 715.000 | `NULL (Default Proyek)` | **Rp -715.000** | **Rp 7.487.709** |
| 18 | 2026-07-21 | `txn_1784629278266_yma5bceki` | Biaya konsumsi, roko dan loundry | PENGELUARAN (Konsumsi & Akomodasi) | Rp 1.000.000 | `NULL (Default Proyek)` | **Rp -1.000.000** | **Rp 6.487.709** |
| 19 | 2026-07-21 | `txn_1785138226212_ezmhtqixj` | Biaya Admin Bank (BI-FAST) - DP Penginapan Resky | PENGELUARAN (Biaya Admin Bank) | Rp 2.500 | `NULL (Default Proyek)` | **Rp -2.500** | **Rp 6.485.209** |
| 20 | 2026-07-22 | `txn_1784866413648_0xei9lj1m` | Pengajuan Budget Operasional Kantor Juli 2026 | MUTASI MASUK (Mutasi Internal / Transfer Kas) | Rp 4.456.000 | `bri_utama` | **+Rp 4.456.000** | **Rp 10.941.209** |
| 21 | 2026-07-22 | `txn_1784719793260_5zeuojy4p` | sisa transfer konsumsi dan roko | PENGELUARAN (Konsumsi & Akomodasi) | Rp 260.000 | `NULL (Default Proyek)` | **Rp -260.000** | **Rp 10.681.209** |
| 22 | 2026-07-23 | `txn_1784819598739_t3ugwp72i` | Tiket pesawat pulang Kates UPG-SUB | PENGELUARAN (Transport & Bensin) | Rp 1.642.290 | `NULL (Default Proyek)` | **Rp -1.642.290** | **Rp 9.038.919** |
| 23 | 2026-07-24 | `txn_1784904440373_9ml75gmen` | Bensin mobil jemput ke Bandara | PENGELUARAN (Biaya Proyek) | Rp 250.000 | `NULL (Default Proyek)` | **Rp -250.000** | **Rp 8.788.919** |
| 24 | 2026-07-24 | `txn_1784899986918_9l3pjlzo6` | E-toll Pulang | PENGELUARAN (Transport & Bensin) | Rp 204.500 | `NULL (Default Proyek)` | **Rp -204.500** | **Rp 8.584.419** |
| 25 | 2026-07-24 | `txn_1784861461565_h2vm36h0b` | Biaya Koordinasi dengan Disnaker setempat | PENGELUARAN (Biaya Proyek) | Rp 1.500.000 | `NULL (Default Proyek)` | **Rp -1.500.000** | **Rp 7.084.419** |
| 26 | 2026-07-24 | `txn_1784900152563_ao4t3ijny` | DP mobil refund | PEMASUKAN (Pengembalian Dana (Refund)) | Rp 300.000 | `kas_admin` | **+Rp 300.000** | **Rp 7.384.419** |
| 27 | 2026-07-24 | `txn_1784861991429_pwrwr7skq` | Tambah modal operasional Projek Angkur | MUTASI MASUK (Mutasi Internal / Transfer Kas) | Rp 6.000.000 | `bri_utama` | **+Rp 6.000.000** | **Rp 13.384.419** |
| 28 | 2026-07-24 | `txn_1784861219625_5jemi2boc` | TIKET PULANG PESAWAT UPG-CGK | PENGELUARAN (Transport & Bensin) | Rp 5.346.700 | `NULL (Default Proyek)` | **Rp -5.346.700** | **Rp 8.037.719** |
| 29 | 2026-07-24 | `txn_1784889861826_hnoo0s219` | Pelunasan mobil | PENGELUARAN (Transport & Bensin) | Rp 2.110.000 | `NULL (Default Proyek)` | **Rp -2.110.000** | **Rp 5.927.719** |
| 30 | 2026-07-24 | `txn_1784859665207_uhvk2o3cw` | Konsumsi hari terakhir | PENGELUARAN (Konsumsi & Akomodasi) | Rp 420.000 | `NULL (Default Proyek)` | **Rp -420.000** | **Rp 5.507.719** |
| 31 | 2026-07-25 | `txn_1784976575990_f6oeeuuyf` | Belanja Operasional Kantor (Lampu, Bensin Mobil & Motor, Pakan Burung)⁠ | PENGELUARAN (Lain-lain) | Rp 512.000 | `NULL (Default Proyek)` | **Rp -512.000** | **Rp 4.995.719** |
| 32 | 2026-07-25 | `txn_1784989301561_6jdyr7u46` | Tf reimburse sebagian ziar | PENGELUARAN (Biaya Proyek) | Rp 579.219 | `NULL (Default Proyek)` | **Rp -579.219** | **Rp 4.416.500** |
| 33 | 2026-07-25 | `txn_1784963912802_sokvm3inv` | Bayar wifi juli | PENGELUARAN (Operasional Kantor) | Rp 342.550 | `kas_admin` | **Rp -342.550** | **Rp 4.073.950** |
| 34 | 2026-07-25 | `txn_1784975330190_jympp5je8` | Reimbursement Kates Gocar, antar-jemput | PENGELUARAN (Biaya Proyek) | Rp 470.000 | `NULL (Default Proyek)` | **Rp -470.000** | **Rp 3.603.950** |
| 35 | 2026-07-25 | `txn_1784964051563_ggos379n0` | Belanja Rio galon, Sierra, kopi, sabun cuci mobil, semir ban, pewangi, kamper, matrai | PENGELUARAN (Operasional Kantor) | Rp 606.000 | `NULL (Default Proyek)` | **Rp -606.000** | **Rp 2.997.950** |
| 36 | 2026-07-25 | `txn_1785138151526_j0eqpyg2j` | Biaya Admin Bank (BI-FAST) - Reimbursement Kates Gocar, antar-jemput | PENGELUARAN (Biaya Admin Bank) | Rp 2.500 | `NULL (Default Proyek)` | **Rp -2.500** | **Rp 2.995.450** |
| 37 | 2026-07-26 | `txn_1785037639678_lilh8tjbu` | Sisa Mutasi Kas dari Transfer reimburse ziar dan bayar kates | MUTASI MASUK (Mutasi Internal / Transfer Kas) | Rp 6.000.000 | `bri_utama` | **+Rp 6.000.000** | **Rp 8.995.450** |
| 38 | 2026-07-26 | `txn_1785101523726_h2zixveao` | Sisa Reimburse Ziar (extra bagasi dll) | PENGELUARAN (Reimbursement) | Rp 280.481 | `NULL (Default Proyek)` | **Rp -280.481** | **Rp 8.714.969** |
| 39 | 2026-07-27 | `txn_1785152079310_ouuhlt8hr` | Bayar kates 4 hari | PENGELUARAN (Biaya Proyek) | Rp 4.000.000 | `NULL (Default Proyek)` | **Rp -4.000.000** | **Rp 4.714.969** |
| 40 | 2026-07-27 | `txn_1785152079312_xxqcf7lpl` | Biaya Admin Bank (BI-FAST) - Bayar kates 4 hari | PENGELUARAN (Biaya Admin Bank) | Rp 2.500 | `NULL (Default Proyek)` | **Rp -2.500** | **Rp 4.712.469** |
| 41 | 2026-07-28 | `txn_1785221996389_wpnjdh0g0` | Pembayaran bulanan token Listrik Juli | PENGELUARAN (Operasional Kantor) | Rp 300.000 | `NULL (Default Proyek)` | **Rp -300.000** | **Rp 4.412.469** |
| 42 | 2026-07-28 | `txn_1785216434894_ls8lbjf92` | Pembayaran Biaya Keamanan dan Biaya Kebersihan | PENGELUARAN (Operasional Kantor) | Rp 150.000 | `NULL (Default Proyek)` | **Rp -150.000** | **Rp 4.262.469** |
| 43 | 2026-07-28 | `txn_1785497307865_vqgv6skgt` | Beli Pomade untuk Pak Fatwa Reimburse | PENGELUARAN (Reimbursement) | Rp 80.000 | `kas_admin` | **Rp -80.000** | **Rp 4.182.469** |
| 44 | 2026-07-28 | `txn_1785240459497_3r5emkmq3` | Budget Pengajuan Divisi IT Bulan Juli | MUTASI MASUK (Mutasi Internal / Transfer Kas) | Rp 1.117.710 | `bri_utama` | **+Rp 1.117.710** | **Rp 5.300.179** |
| 45 | 2026-07-28 | `txn_1785238745854_jexft53il` | REIMBURSEMENT JULI ALL TEAM (SESUAI LAMPIRAN | MUTASI MASUK (Mutasi Internal / Transfer Kas) | Rp 1.397.700 | `bri_utama` | **+Rp 1.397.700** | **Rp 6.697.879** |
| 46 | 2026-07-29 | `txn_1785498418885_m2cyvzvk3` | Beli 2 Dus AIr Cup 600ml di Warung/Grosir | PENGELUARAN (Konsumsi & Akomodasi) | Rp 64.000 | `NULL (Default Proyek)` | **Rp -64.000** | **Rp 6.633.879** |
| 47 | 2026-07-29 | `txn_1785330394452_awm8fw2yw` | DJKA Operasional Bogor-Sukabumi | MUTASI MASUK (Mutasi Internal / Transfer Kas) | Rp 2.350.000 | `bri_utama` | **+Rp 2.350.000** | **Rp 8.983.879** |
| 48 | 2026-07-29 | `txn_1785497131813_0a0n1352g` | Beli filet Ayam untuk Kucing | PENGELUARAN (Pengeluaran Lainnya) | Rp 150.000 | `kas_admin` | **Rp -150.000** | **Rp 8.833.879** |
| 49 | 2026-07-29 | `txn_1785330502950_z7al12mjc` | 050. Permohonan Budget Operational Riksa Uji DJKA Area Bogor dan Sukabumi | PENGELUARAN (Operasional Kantor) | Rp 2.350.000 | `NULL (Default Proyek)` | **Rp -2.350.000** | **Rp 6.483.879** |
| 50 | 2026-07-29 | `txn_1785498172642_rrt9c3mfp` | Tiket Berangkat KA Pandalungan Eksekutif (Surabaya Pasar Turi – Karawang PP) a.n. Kates | PENGELUARAN (Transport & Bensin) | Rp 633.300 | `NULL (Default Proyek)` | **Rp -633.300** | **Rp 5.850.579** |
| 51 | 2026-07-30 | `txn_1785499137773_zrthib2gk` | Konsumsi untuk Kates di Karawang | PENGELUARAN (Konsumsi & Akomodasi) | Rp 200.000 | `NULL (Default Proyek)` | **Rp -200.000** | **Rp 5.650.579** |
| 52 | 2026-07-30 | `txn_1785499035897_etqfzmtdq` | Konsumsi untuk Rio di Karawang | PENGELUARAN (Konsumsi & Akomodasi) | Rp 200.000 | `NULL (Default Proyek)` | **Rp -200.000** | **Rp 5.450.579** |
| 53 | 2026-07-30 | `txn_1785373331372_yl6d1yywq` | Dana Operasional Angkur HM Sampoerna Karawang | MUTASI MASUK (Mutasi Internal / Transfer Kas) | Rp 10.855.000 | `bri_utama` | **+Rp 10.855.000** | **Rp 16.305.579** |
| 54 | 2026-07-30 | `txn_1785391100534_ui8gl7aid` | Pembelian Online bindex, penyaring air, tinta, clip kertas, rompi, casan batre, batre kotak 9v | PENGELUARAN (Operasional Kantor) | Rp 1.279.903 | `NULL (Default Proyek)` | **Rp -1.279.903** | **Rp 15.025.676** |
| 55 | 2026-07-30 | `txn_1785501116331_1kcaqbp8x` | Penginapan Tim & Kates (N2-3) Hotel Front One Akshaya  (Twin Bed, 30 Jul - 1 Aug, inc. Breakfast) | PENGELUARAN (Konsumsi & Akomodasi) | Rp 900.000 | `NULL (Default Proyek)` | **Rp -900.000** | **Rp 14.125.676** |
| 56 | 2026-07-30 | `txn_1785499310529_k1tngmoid` | Top Up E-Toll PP Bandung-Karawang Rio dan Ajay, Mobil Pajero | PENGELUARAN (Transport & Bensin) | Rp 350.000 | `NULL (Default Proyek)` | **Rp -350.000** | **Rp 13.775.676** |
| 57 | 2026-07-30 | `txn_1785498972307_xaucl8m0p` | Isi Bensin PP Bandung-Karawang Rio dan Ajay, Mobil Pajero | PENGELUARAN (Transport & Bensin) | Rp 500.000 | `NULL (Default Proyek)` | **Rp -500.000** | **Rp 13.275.676** |
| 58 | 2026-07-30 | `txn_1785499100566_t71bal1er` | Konsumsi untuk Ajay di Karawang | PENGELUARAN (Konsumsi & Akomodasi) | Rp 200.000 | `NULL (Default Proyek)` | **Rp -200.000** | **Rp 13.075.676** |
| 59 | 2026-07-30 | `txn_1785499137785_076z2eba6` | Biaya Admin Bank (BI-FAST) - Konsumsi untuk Kates di Karawang | PENGELUARAN (Biaya Admin Bank) | Rp 2.500 | `NULL (Default Proyek)` | **Rp -2.500** | **Rp 13.073.176** |
| 60 | 2026-07-31 | `txn_1785496846025_2qwzss39n` | Pembelian Standing Plasma TV online | PENGELUARAN (Peralatan & Sewa Alat) | Rp 524.000 | `NULL (Default Proyek)` | **Rp -524.000** | **Rp 12.549.176** |
| 61 | 2026-07-31 | `txn_1785905463804_csocghe30` | Admin Transfer Pembayaran Sentra Yasa  dari Pak Sali, Setor tunai dan TF dari Rek BCA FInance ke BRI Utama | PENGELUARAN (Biaya Admin Bank) | Rp 2.500 | `kas_admin` | **Rp -2.500** | **Rp 12.546.676** |
| 62 | 2026-07-31 | `txn_1785579076294_7wccrhgeq` | Pembelian 10 isi ualng Galon Bulan Juli | PENGELUARAN (Konsumsi & Akomodasi) | Rp 90.000 | `NULL (Default Proyek)` | **Rp -90.000** | **Rp 12.456.676** |
| 63 | 2026-08-01 | `txn_1785917459427_6xot817a2` | Tiket Kereta Api Stasiun Karawang-Surabaya (Pasar Turi) Traveloka | PENGELUARAN (Konsumsi & Akomodasi) | Rp 602.100 | `kas_admin` | **Rp -602.100** | **Rp 11.854.576** |
| 64 | 2026-08-03 | `txn_1785811682238_pz2yz882w` | Capcut 1 tahun langganan (Diskon Pengguna) | PENGELUARAN (Operasional Kantor) | Rp 367.000 | `NULL (Default Proyek)` | **Rp -367.000** | **Rp 11.487.576** |
| 65 | 2026-08-04 | `txn_1785917997585_4xjuq8q9r` | Refund  E-Toll, Konsumsi Rio & Ajay, dan Reimbursement Roko Kates | PEMASUKAN (Pengembalian Dana (Refund)) | Rp 612.464 | `kas_admin` | **+Rp 612.464** | **Rp 12.100.040** |
| 66 | 2026-08-05 | `txn_1785917764959_2u4e3jdv3` | Konsumsi Angga (subtitusi tim lapangan dengan Ajay dan Rio) | PENGELUARAN (Konsumsi & Akomodasi) | Rp 200.000 | `kas_admin` | **Rp -200.000** | **Rp 11.900.040** |
| 67 | 2026-08-05 | `txn_1785915919370_xx5uxjrrc` | Biaya Admin Bank (BI-FAST) - Reimbursement Kates HMS Karawang (PP Transportasi Lokal Surabaya dan Hotel Transit Karawang 1 hari) | PENGELUARAN (Biaya Admin Bank) | Rp 2.500 | `kas_admin` | **Rp -2.500** | **Rp 11.897.540** |
| 68 | 2026-08-05 | `txn_1785915919363_zdfb4z42u` | Reimbursement Kates HMS Karawang (PP Transportasi Lokal Surabaya dan Hotel Transit Karawang 1 hari) | PENGELUARAN (Biaya Proyek) | Rp 379.000 | `kas_admin` | **Rp -379.000** | **Rp 11.518.540** |

---

## 🛠️ Langkah Perbaikan Mapping di Supabase (Opsional)

Jika terdapat transaksi legacy pada tabel di atas yang sebenarnya dibayar menggunakan **BCA Utama** atau **BRI Utama** (bukan dari Kas Admin), Anda dapat memperbaruinya di Supabase atau via modal Edit Transaksi di aplikasi:

```sql
-- Contoh update transaksi legacy ke BCA Utama jika sebenarnya bukan dari Kas Admin:
UPDATE transactions 
SET rekening_id = 'bca_utama' 
WHERE id = 'TRANSAKSI_ID_TERTENTU';
```

Setelah di-update, sistem akan otomatis menyesuaikan saldo Kas Admin di Dashboard tanpa perlu penyesuaian fiktif.

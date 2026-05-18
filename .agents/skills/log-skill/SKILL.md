---
name: log-skill
description: Berikan logs yang sudah dikerjakan
license: MIT
compatibility: opencode, gemini-cli
metadata:
  audience: maintainers
---

## What I do

- Tambahkan log yang sudah dikerjakan di file IMPROVEMENTS_SUMMARY.md
- Propose a version bump
- Provide a copy-pasteable `gh release create` command

## When to use me

- Setiap selesai membuat file, refactor, menjalankan task, atau memperbaiki bug
- Setiap kali ada perubahan code3

## How I do it

- Read IMPROVEMENTS_SUMMARY.md, untuk melihat log terakhir
- Append entry baru di bagian bawah file
- Group berdasarkan tanggal, gunakan bullets points
- Format : aksi ( `Modified`, `Created`, `Fixed`, `Deleted`) + nama file + deskripsi

## Log Format

##2026-05-07

### Kategori task
-
-
-


**PENTING** Selalu append, jangan overwrite file yang sudah ada
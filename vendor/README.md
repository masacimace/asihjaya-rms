# Vendored dependencies

## SheetJS CE 0.20.3

`xlsx-0.20.3.tgz` is downloaded once from the official SheetJS CDN and accepted only when its SHA-512 integrity matches the approved value in `package-lock.json`.

Authoritative source:

```text
https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

Official source integrity:

```text
sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==
```

Generate or refresh the vendored archive only through:

```bash
npm run vendor:xlsx
```

The command downloads and verifies the official archive, updates the dependency to `file:vendor/xlsx-0.20.3.tgz`, refreshes `package-lock.json`, and writes `xlsx-0.20.3.sha512`.

Verify the generated archive from the repository root:

```bash
sha512sum -c vendor/xlsx-0.20.3.sha512
```

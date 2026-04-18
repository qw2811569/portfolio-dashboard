# Runtime Contracts

此目錄現在是 canonical runtime contract 邊界：

- `index.js`: CommonJS-compatible Zod schemas，供 `require()` 驗證使用
- `index.mjs`: ESM wrapper，供 repo runtime / bundler import 使用
- `package.json`: 局部 `type=commonjs`，讓 repo 根層 `type=module` 下仍可跑 `node -e "require(...)"` 驗證

目前已定義：

- `HoldingDossierSchema`
- `OperatingContextSchema`
- `CatalystEventSchema`
- `ThesisScorecardSchema`

額外的 request/helper schema 可沿用同一入口擴充，避免各 lane 再各自發明 shape。

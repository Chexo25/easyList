const fs = require('fs');
let code = fs.readFileSync('src/lib/shoppingSyncStore.ts', 'utf8');

code = code.replace(
  "if (payload.eventType === 'INSERT') return [...current, payload.new];",
  "if (payload.eventType === 'INSERT') return [payload.new, ...current];"
);

fs.writeFileSync('src/lib/shoppingSyncStore.ts', code);

const fs = require('fs');
let code = fs.readFileSync('src/routes/planning/+page.svelte', 'utf8');
code = code.replace(/\$effect\(\(\) => \{[\s\S]*?\}\);\s*\$effect\(\(\) => \{[\s\S]*?\}\);/,
`$effect(() => {
    const unsubM = syncMeals.subscribe(val => {
       meals = val.map(m => ({ ...m, isFavorite: m.is_favorite }));
    });
    const unsubP = syncPlanning.subscribe(val => {
       planning = val;
    });
    return () => { unsubM(); unsubP(); };
  });`
);
fs.writeFileSync('src/routes/planning/+page.svelte', code);

const fs = require('fs');
const files = [
  'src/app/api/auth/login/route.ts',
  'src/app/api/auth/logout/route.ts',
  'src/app/api/auth/me/route.ts'
];
files.forEach(function(f) {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/cookies\(\)\.set\(/g, "(await cookies()).set(");
  c = c.replace(/cookies\(\)\.get\(/g, "(await cookies()).get(");
  c = c.replace(/cookies\(\)\.delete\(/g, "(await cookies()).delete(");
  fs.writeFileSync(f, c);
});

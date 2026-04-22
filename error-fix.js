const fs = require('fs');
const files = [
  'src/app/api/auth/register/route.ts',
  'src/app/api/auth/login/route.ts',
  'src/app/api/auth/forgot-password/route.ts',
  'src/app/api/auth/reset-password/route.ts'
];
files.forEach(function(f) {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/error\.errors/g, "error.flatten().fieldErrors");
  fs.writeFileSync(f, c);
});

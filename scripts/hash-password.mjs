import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error("Usage: node scripts/hash-password.mjs <password>");
  process.exit(1);
}

const salt = bcrypt.genSaltSync(12);
const hash = bcrypt.hashSync(password, salt);

console.log("Bcrypt hash:", hash);
console.log('\nAdd this to your .env as ADMIN_PASSWORD_HASH="<hash>"');

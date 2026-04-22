const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.user.deleteMany({
      where: {
        email: 'talhawaris80@gmail.com'
      }
    });
    console.log(`Successfully deleted ${result.count} user(s) with email talhawaris80@gmail.com`);
  } catch (error) {
    console.error('Error deleting user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
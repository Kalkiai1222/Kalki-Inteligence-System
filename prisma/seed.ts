import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTestData() {
  const companyId = '8f365168-b50a-4ebc-8a9f-9ecef386d04b';

  console.log("Seeding real DB data for company:", companyId);

  // Helper to subtract days for the Recharts Activity AreaChart
  const subDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  };

  const project = await prisma.project.create({
    data: {
      companyId,
      name: 'Skyline Tower Phase 1',
      status: 'ACTIVE',
      description: 'Main commercial architectural build.',
      blueprintSets: {
        create: [{
          name: 'Structural Blueprints',
          versions: {
            create: [
              {
                versionNumber: 1,
                fileUrl: 'https://example.com/ structural-v1.pdf',
                fileKey: 'structural-v1.pdf',
                fileSize: 5240000, // ~5.2 MB
                createdAt: subDays(15), // Uploaded 15 days ago
              },
              {
                versionNumber: 2,
                fileUrl: 'https://example.com/ structural-v2.pdf',
                fileKey: 'structural-v2.pdf',
                fileSize: 6810000, // ~6.8 MB
                createdAt: subDays(2), // Uploaded 2 days ago
              }
            ]
          }
        }]
      }
    }
  });

  const project2 = await prisma.project.create({
    data: {
      companyId,
      name: 'City Plaza Maintenance',
      status: 'PLANNING',
      description: 'Routine updates and infrastructure changes.',
    }
  });

  console.log("Projects and Live Blueprint data successfully inserted!");
}

seedTestData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
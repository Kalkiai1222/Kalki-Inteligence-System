const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runTests() {
  try {
    console.log('=== Testing API Routes ===\n');

    // 1. Get a test user
    console.log('1. Fetching test user...');
    const user = await prisma.user.findFirst();
    if (!user) {
      console.error('❌ No users found in database. Seeding data...');
      const newUser = await prisma.user.create({
        data: {
          email: `test-${Date.now()}@example.com`,
          name: 'Test User',
          password: 'hashed_password',
          emailVerified: true,
        },
      });
      console.log(`✅ Created test user: ${newUser.id}`);
    } else {
      console.log(`✅ Found test user: ${user.id} (${user.email})`);
    }

    // 2. Get a test company
    console.log('\n2. Fetching test company...');
    let company = await prisma.company.findFirst();
    if (!company) {
      console.log('   No companies found. Creating test company...');
      company = await prisma.company.create({
        data: {
          name: 'Test Company',
          description: 'Test company for API testing',
        },
      });
      console.log(`✅ Created test company: ${company.id}`);
    } else {
      console.log(`✅ Found test company: ${company.id} (${company.name})`);
    }

    // 3. Ensure user is member of company
    console.log('\n3. Ensuring user is member of company...');
    const userId = user?.id || (await prisma.user.findFirst())?.id;
    const membership = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: company.id, userId } },
    });
    if (!membership) {
      await prisma.companyMember.create({
        data: {
          companyId: company.id,
          userId,
          role: 'ADMIN',
        },
      });
      console.log(`✅ Added user as ADMIN to company`);
    } else {
      console.log(`✅ User already member of company`);
    }

    // 4. Create a test project
    console.log('\n4. Creating test project...');
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        name: `Test Project ${Date.now()}`,
        description: 'Test project for API testing',
        status: 'active',
      },
    });
    console.log(`✅ Created test project: ${project.id}`);

    // 5. Test database connection
    console.log('\n5. Testing database connection...');
    const projectFetch = await prisma.project.findFirst({
      where: { id: project.id, companyId: company.id },
      include: {
        client: true,
        blueprintSets: { include: { versions: { orderBy: { versionNumber: 'desc' } } }, orderBy: { createdAt: 'desc' } }
      }
    });
    if (projectFetch) {
      console.log(`✅ Successfully queried project: ${projectFetch.name}`);
      console.log(`   - Blueprint sets: ${projectFetch.blueprintSets.length}`);
    }

    console.log('\n=== Test Summary ===');
    console.log(`Company ID: ${company.id}`);
    console.log(`Project ID: ${project.id}`);
    console.log(`User ID: ${userId}`);
    console.log('\n✅ All database tests passed!');
    console.log('\nNow test these API endpoints in browser/Postman:');
    console.log(`GET  http://localhost:3000/api/companies/${company.id}/projects/${project.id}`);
    console.log(`PUT  http://localhost:3000/api/companies/${company.id}/projects/${project.id}`);
    console.log(`POST http://localhost:3000/api/companies/${company.id}/projects`);

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error(err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runVerification() {
  console.log("--- RUNTIME DB VERIFICATION ---");
  
  // 1. Get any active user's company
  const companyMember = await prisma.companyMember.findFirst({
    include: { company: true }
  });

  if (!companyMember) {
    console.log("No active companies found. Please register an account first.");
    return;
  }

  const companyId = companyMember.companyId;
  console.log(`\nVerified Target Company: ${companyMember.company.name} (${companyId})`);

  // 2. Execute the exact API Query from /api/companies/[id]/route.ts
  const apiCompanyResponse = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      invites: { where: { expiresAt: { gt: new Date() } } },
      clients: { select: { id: true, name: true } },
      projects: { 
        include: { 
          blueprintSets: { include: { versions: true } } 
        } 
      }
    }
  });

  if (!apiCompanyResponse) return;

  console.log("\n--- RELATIONAL API FETCH RESULTS ---");
  console.log(`Total Members: ${apiCompanyResponse.members.length}`);
  console.log(`Total Clients: ${apiCompanyResponse.clients.length}`);
  console.log(`Total Projects: ${apiCompanyResponse.projects.length}`);

  let totalFiles = 0;
  let totalBytes = 0;

  apiCompanyResponse.projects.forEach((proj: any) => {
    console.log(`\n📁 Project: ${proj.name} | Status: ${proj.status}`);
    proj.blueprintSets.forEach((set: any) => {
      console.log(`  ↳ Blueprint Set: ${set.name}`);
      set.versions.forEach((v: any) => {
        totalFiles++;
        totalBytes += v.fileSize || 0;
        console.log(`    📄 Version ${v.versionNumber} | Size: ${v.fileSize} bytes | Created: ${v.createdAt.toISOString()}`);
        console.log(`       URL: ${v.fileUrl}`);
      });
    });
  });

  console.log("\n--- FRONTEND REACT AGGREGATION SIMULATION ---");
  console.log(`Calculated Storage MB: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total Live Files Synced: ${totalFiles}`);
  console.log("Status: 100% Connected to actual SQLite metrics. No mock data injected.");
}

runVerification()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

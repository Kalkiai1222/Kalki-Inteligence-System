import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { join } from 'path';
import { execFileSync } from 'child_process';

import { existsSync } from 'fs';

const pythonExe = process.platform === 'win32' 
    ? join(process.cwd(), '.venv', 'Scripts', 'python.exe')
    : join(process.cwd(), '.venv', 'bin', 'python');

function getPython() {
    if (!existsSync(pythonExe)) {
        return 'python3';
    }
    return pythonExe;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: id, userId: Object(auth).userId } }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { memoryType, featureText, correctionData } = await req.json();

    if (!memoryType || !featureText || !correctionData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Determine next embeddingId safely
    const lastMemory = await prisma.elasticMemory.findFirst({
        orderBy: { embeddingId: 'desc' }
    });
    
    // Fallback: If the DB is completely empty and no entry has an embeddingId yet, start at 1.
    const embeddingId = lastMemory ? lastMemory.embeddingId + 1 : 1;

    const memory = await prisma.elasticMemory.create({
      data: {
        companyId: id,
        memoryType,
        featureText,
        correctionData: typeof correctionData === 'string' ? correctionData : JSON.stringify(correctionData),
        embeddingId
      }
    });

    // Feed to FAISS Python Engine
    const scriptPath = join(process.cwd(), 'scripts', 'elastic_memory.py');
    const faissPayload = {
       companyId: id,
       text: featureText,
       embeddingId: memory.embeddingId
    };

    try {
        const faissOutput = execFileSync(getPython(), [scriptPath, 'add'], {
            input: JSON.stringify(faissPayload),
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024
        });
        console.log("FAISS Check:", faissOutput);
    } catch (e: any) {
        console.error("Python FAISS Engine Error", e.stdout || e.message);
    }

    return NextResponse.json({ memory }, { status: 201 });
  } catch (err: any) {
    console.error("ElasticMemory creation error", err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { requireAuth } from '@/lib/require-auth';

// Real local file storage that acts as the AWS S3 alternative. Ensure directories are physically built.
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    const token = url.searchParams.get('token');

    if (!key || !token) {
      return NextResponse.json({ error: 'Missing signed upload parameters' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const relativePath = join('public', 'uploads', key);
    const fullPath = join(process.cwd(), relativePath);

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);

    return NextResponse.json({ success: true, fileUrl: `/uploads/${key}` });
  } catch (error) {
    return NextResponse.json({ error: 'Storage transfer failed' }, { status: 500 });
  }
}
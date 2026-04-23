import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Serves 3D model files (OBJ, STEP, USDA) directly from the database.
 * Files are stored as binary data in the database to avoid ephemeral FS issues on Render.
 *
 * GET /api/models/:modelId/:fileType
 * fileType = "obj" | "step" | "usd"
 */

const FILE_TYPE_MAP = {
  obj: {
    contentType: 'model/obj',
    dataField: 'objData' as const,
    ext: 'obj',
  },
  step: {
    contentType: 'model/step',
    dataField: 'stepData' as const,
    ext: 'step',
  },
  usd: {
    contentType: 'model/vnd.usda',
    dataField: 'usdData' as const,
    ext: 'usda',
  },
} as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ modelId: string; fileType: string }> }
) {
  try {
    const { modelId, fileType } = await params;

    // Validate fileType early before hitting the DB
    const fileTypeDef = FILE_TYPE_MAP[fileType as keyof typeof FILE_TYPE_MAP];
    if (!fileTypeDef) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    const model = await prisma.blueprint3DModel.findUnique({
      where: { id: modelId },
      select: { [fileTypeDef.dataField]: true },
    });

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    const fileData = model[fileTypeDef.dataField];
    if (!fileData) {
      return NextResponse.json(
        { error: 'File content not available' },
        { status: 404 }
      );
    }

    // fileData is a string, convert to Buffer
    const buffer = Buffer.from(fileData, 'base64');
    if (buffer.length === 0) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 404 }
      );
    }

    // Sanitize modelId to prevent Content-Disposition header injection
    const safeId = modelId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeId}.${fileTypeDef.ext}`;

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': fileTypeDef.contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: unknown) {
    console.error(
      'Model serve error:',
      err instanceof Error ? err.message : err,
      err instanceof Error ? err.stack : ''
    );
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
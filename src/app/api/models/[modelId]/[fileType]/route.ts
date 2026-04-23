import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Serves 3D model files (OBJ, STEP, USDA) from the database content fields.
 * Files are stored in objData/stepData/usdData on the Blueprint3DModel record.
 *
 * GET /api/models/:modelId/:fileType
 * fileType = "obj" | "step" | "usd"
 */

const FILE_TYPE_MAP = {
  obj:  { contentType: 'model/obj',       field: 'objData'  as const, ext: 'obj'  },
  step: { contentType: 'model/step',      field: 'stepData' as const, ext: 'step' },
  usd:  { contentType: 'model/vnd.usda',  field: 'usdData'  as const, ext: 'usda' },
} as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ modelId: string; fileType: string }> }
) {
  const { modelId, fileType } = await params;

  const fileTypeDef = FILE_TYPE_MAP[fileType as keyof typeof FILE_TYPE_MAP];
  if (!fileTypeDef) {
    return NextResponse.json({ error: 'Invalid file type. Must be obj, step, or usd.' }, { status: 400 });
  }

  try {
    const model = await prisma.blueprint3DModel.findUnique({
      where: { id: modelId },
      select: { [fileTypeDef.field]: true },
    });

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    const content = (model as Record<string, string | null>)[fileTypeDef.field];
    if (!content) {
      return NextResponse.json({ error: 'File content not available for this model' }, { status: 404 });
    }

    const safeId = modelId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeId}.${fileTypeDef.ext}`;

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': fileTypeDef.contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: unknown) {
    console.error('Model serve error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
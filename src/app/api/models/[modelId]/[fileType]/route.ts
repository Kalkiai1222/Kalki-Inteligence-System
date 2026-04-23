import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Serves 3D model files (OBJ, STEP, USDA) from the database.
 * This route replaces the static file serving approach which fails
 * on ephemeral filesystems like Render.
 *
 * GET /api/models/:modelId/:fileType
 * fileType = "obj" | "step" | "usd"
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ modelId: string; fileType: string }> }
) {
  const { modelId, fileType } = await params;

  try {
    const model = await prisma.blueprint3DModel.findUnique({
      where: { id: modelId },
    });

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    let content: string | null = null;
    let contentType = 'text/plain';
    let filename = 'model';

    switch (fileType) {
      case 'obj':
        content = model.objData;
        contentType = 'model/obj';
        filename = `${modelId}.obj`;
        break;
      case 'step':
        content = model.stepData;
        contentType = 'model/step';
        filename = `${modelId}.step`;
        break;
      case 'usd':
        content = model.usdData;
        contentType = 'model/vnd.usda';
        filename = `${modelId}.usda`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    if (!content) {
      return NextResponse.json({ error: 'File content not available' }, { status: 404 });
    }

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (err: any) {
    console.error('Model serve error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

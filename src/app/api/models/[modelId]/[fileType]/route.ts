import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Serves 3D model files (OBJ, STEP, USDA) by proxying from stored URLs.
 * This route replaces the static file serving approach which fails
 * on ephemeral filesystems like Render.
 *
 * GET /api/models/:modelId/:fileType
 * fileType = "obj" | "step" | "usd"
 */

const FILE_TYPE_MAP = {
  obj: {
    contentType: 'model/obj',
    field: 'objUrl' as const,
    ext: 'obj',
  },
  step: {
    contentType: 'model/step',
    field: 'stepUrl' as const,
    ext: 'step',
  },
  usd: {
    contentType: 'model/vnd.usda',
    field: 'usdUrl' as const,
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
      select: { [fileTypeDef.field]: true },
    });

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    const fileUrl = model[fileTypeDef.field];
    if (!fileUrl) {
      return NextResponse.json(
        { error: 'File content not available' },
        { status: 404 }
      );
    }

    // Validate that fileUrl is an absolute URL (not a relative path)
    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(fileUrl).toString();
    } catch {
      // If fileUrl is not a valid absolute URL, it's likely a relative path
      // This indicates a data integrity issue in the database
      console.error(
        `Invalid file URL for modelId=${modelId} fileType=${fileType}: "${fileUrl}" is not an absolute URL`
      );
      return NextResponse.json(
        { error: 'File URL is misconfigured' },
        { status: 500 }
      );
    }

    // Proxy the file from the upstream URL (e.g. S3, GCS, etc.)
    const upstream = await fetch(absoluteUrl);
    if (!upstream.ok) {
      console.error(
        `Upstream fetch failed for modelId=${modelId} fileType=${fileType}: ${upstream.status} ${upstream.statusText}`
      );
      return NextResponse.json(
        { error: 'Failed to fetch file from storage' },
        { status: 502 }
      );
    }

    // Ensure we have a body to send
    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength === 0) {
      console.error(
        `Empty response body for modelId=${modelId} fileType=${fileType}`
      );
      return NextResponse.json(
        { error: 'File content is empty' },
        { status: 502 }
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
        // Removed `immutable` — model URLs can change for the same modelId
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
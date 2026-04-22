import { NextResponse } from 'next/server';
import { schemaRegistry, type SchemaStage } from '@/lib/pipeline-schemas';
import { z } from 'zod';

export async function GET(_: Request, { params }: { params: Promise<{ stage: string }> }) {
  const { stage } = await params;
  if (!(stage in schemaRegistry)) {
    return NextResponse.json({ error: 'Unknown schema stage' }, { status: 404 });
  }

  const schema = schemaRegistry[stage as SchemaStage];
  return NextResponse.json({
    stage,
    schema_version: 'v1',
    json_schema: z.toJSONSchema(schema),
  });
}

import { loadTemplateTree } from "@/lib/load-template";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const template = await loadTemplateTree();
    return NextResponse.json(template);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to load template: ${message}` },
      { status: 500 }
    );
  }
}

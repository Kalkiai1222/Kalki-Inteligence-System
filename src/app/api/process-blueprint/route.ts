import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // 1. Save the file locally so Python can access it
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const uploadDir = path.join(process.cwd(), "public", "uploads", "blueprints");
    await mkdir(uploadDir, { recursive: true });
    
    // Sanitize filename and create absolute path
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = path.join(uploadDir, `${Date.now()}-${safeName}`);
    
    await writeFile(filePath, buffer);

    // 2. Call the Python pipeline via child_process
    // Detect python executable with fallback logic
    const isWindows = os.platform() === "win32";
    let pythonExecutable = isWindows
      ? path.join(process.cwd(), ".venv", "Scripts", "python.exe")
      : path.join(process.cwd(), ".venv", "bin", "python");
    
    const { existsSync } = await import('fs');
    if (!existsSync(pythonExecutable)) {
      console.warn(`Venv python not found at ${pythonExecutable}, attempting global 'python3' fallback`);
      pythonExecutable = "python3";
    } else {
      console.log(`Using venv python: ${pythonExecutable}`);
    }
      
    const scriptPath = path.join(process.cwd(), "pipeline", "main.py");
    console.log(`Spawning: ${pythonExecutable} ${scriptPath} ${filePath}`);

    return await new Promise<Response>((resolve) => {
      const pyProcess = spawn(pythonExecutable, [scriptPath, filePath]);
      
      let stdoutData = "";
      let stderrData = "";
      let processCompleted = false;

      // Add 120 second timeout
      const timeout = setTimeout(() => {
        if (!processCompleted) {
          processCompleted = true;
          pyProcess.kill();
          console.error("Python pipeline timeout after 120s");
          resolve(
            NextResponse.json(
              { error: "Blueprint processing timeout - file may be too large" },
              { status: 504 }
            )
          );
        }
      }, 120000);

      pyProcess.stdout.on("data", (data) => {
        stdoutData += data.toString();
      });

      pyProcess.stderr.on("data", (data) => {
        stderrData += data.toString();
        console.log(`[Python Pipeline]`, data.toString().trim());
      });

      pyProcess.on("close", (code) => {
        if (processCompleted) return; // Already timed out
        processCompleted = true;
        clearTimeout(timeout);

        if (code !== 0) {
          console.error(`Pipeline exited with code ${code}`);
          console.error(`stderr output: ${stderrData}`);
          console.error(`stdout output: ${stdoutData}`);
          return resolve(
            NextResponse.json(
              { error: "Pipeline processing failed", details: stderrData, stdout: stdoutData },
              { status: 500 }
            )
          );
        }

        try {
          // Parse the strict JSON output expected from main.py
          const result = JSON.parse(stdoutData.trim());
          console.log(`Pipeline succeeded: Generated 3D models and takeoff`);
          return resolve(NextResponse.json(result, { status: 200 }));
        } catch (e: any) {
          console.error("Failed to parse pipeline output:", e.message);
          console.error("stdout:", stdoutData);
          console.error("stderr:", stderrData);
          return resolve(
            NextResponse.json(
              { error: "Invalid JSON from pipeline", raw: stdoutData, stderr: stderrData },
              { status: 500 }
            )
          );
        }
      });
    });
  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

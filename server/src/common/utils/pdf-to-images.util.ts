import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);

export interface PageImage {
  base64: string;
  mime: string;
}

/**
 * Rasterizes a PDF into per-page PNG images via `pdftoppm` (poppler-utils —
 * already present on the host, no native npm dependency needed) so they can
 * be handed to a vision-capable LLM. `maxPages` guards against a huge upload
 * blowing up the vision call's payload/cost.
 */
export async function pdfToPageImages(pdfBuffer: Buffer, maxPages = 40): Promise<PageImage[]> {
  const dir = await mkdtemp(join(tmpdir(), 'univdoc-'));
  const pdfPath = join(dir, 'input.pdf');
  const prefix = join(dir, 'page');
  try {
    await writeFile(pdfPath, pdfBuffer);
    await execFileAsync('pdftoppm', ['-png', '-r', '150', '-l', String(maxPages), pdfPath, prefix]);

    const files = (await readdir(dir))
      .filter((f) => f.startsWith('page') && f.endsWith('.png'))
      .sort((a, b) => {
        const na = parseInt(a.match(/(\d+)/)?.[1] ?? '0', 10);
        const nb = parseInt(b.match(/(\d+)/)?.[1] ?? '0', 10);
        return na - nb;
      });

    const out: PageImage[] = [];
    for (const f of files) {
      const buf = await readFile(join(dir, f));
      out.push({ base64: buf.toString('base64'), mime: 'image/png' });
    }
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { sniffStagedFile, hasAllowedExtension } from '../services/importValidation.js';

// Content validation is the gate that makes "reject anything unrecognized"
// real. The point of these tests is that the FILENAME never decides:
// every case below is named .txt.

let dir;
const write = async (name, content) => {
  const full = path.join(dir, name);
  await fs.writeFile(full, content);
  return full;
};

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'import-validation-'));
});
afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('hasAllowedExtension', () => {
  it('accepts .txt and .csv regardless of case', () => {
    expect(hasAllowedExtension('log.txt')).toBe(true);
    expect(hasAllowedExtension('LOG.TXT')).toBe(true);
    expect(hasAllowedExtension('export.CsV')).toBe(true);
  });

  it('rejects everything else, including a double extension', () => {
    expect(hasAllowedExtension('payload.exe')).toBe(false);
    expect(hasAllowedExtension('archive.zip')).toBe(false);
    // path.extname takes only the final segment, which is the point.
    expect(hasAllowedExtension('sneaky.txt.exe')).toBe(false);
    expect(hasAllowedExtension('noextension')).toBe(false);
  });
});

describe('sniffStagedFile', () => {
  it('identifies a GGPoker export from its first line', async () => {
    const p = await write('gg.txt', "Poker Hand #HD1: Hold'em No Limit ($0.05/$0.1) - 2026/01/01 12:00:00\n");
    expect(await sniffStagedFile(p)).toEqual({ format: 'GGPOKER' });
  });

  it('identifies an ACR export', async () => {
    const p = await write('acr.txt', 'Hand #123456 - Holdem - $0.05/$0.1 - 2026/01/01 12:00:00 UTC\n');
    expect(await sniffStagedFile(p)).toEqual({ format: 'ACR' });
  });

  it('identifies a PokerNow CSV by its entry column', async () => {
    const p = await write('pn.csv', 'entry,at,order\n"x",1,1\n');
    expect(await sniffStagedFile(p)).toEqual({ format: 'POKERNOW' });
  });

  it('rejects a JPEG renamed to .txt', async () => {
    // Real JPEG magic bytes. The extension check passes; the sniff must not.
    const p = await write('fake.txt', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]));
    const result = await sniffStagedFile(p);
    expect(result.format).toBeUndefined();
    expect(result.error).toMatch(/binary/i);
  });

  it('rejects a ZIP renamed to .txt', async () => {
    const p = await write('fake2.txt', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]));
    expect((await sniffStagedFile(p)).error).toMatch(/binary/i);
  });

  it('rejects an empty file', async () => {
    const p = await write('empty.txt', '');
    expect((await sniffStagedFile(p)).error).toMatch(/empty/i);
  });

  it('rejects plausible-looking text that is not a hand history', async () => {
    const p = await write('junk.txt', 'Dear player,\nYour session summary is attached.\n');
    expect((await sniffStagedFile(p)).error).toMatch(/Unrecognized file format/);
  });

  it('reports a missing file as an error rather than throwing', async () => {
    const result = await sniffStagedFile(path.join(dir, 'does-not-exist.txt'));
    expect(result.error).toMatch(/Could not read file/);
  });

  it('skips leading blank lines when detecting the format', async () => {
    const p = await write('blank.txt', "\n\n\nPoker Hand #HD9: Hold'em No Limit ($1/$2) - 2026/01/01 12:00:00\n");
    expect(await sniffStagedFile(p)).toEqual({ format: 'GGPOKER' });
  });
});

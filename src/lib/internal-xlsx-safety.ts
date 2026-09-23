import { inflateRawSync } from "node:zlib";

/** Bound actual ZIP expansion before ExcelJS allocates workbook objects. No ZIP64/encrypted uploads. */
export function checkInternalXlsx(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--)
    if (b.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("This is not a valid .xlsx workbook.");
  const count = b.readUInt16LE(end + 10),
    start = b.readUInt32LE(end + 16);
  if (count > 400 || count === 0 || b.readUInt16LE(end + 4) !== 0 || b.readUInt16LE(end + 6) !== 0)
    throw new Error("Unsupported or oversized workbook archive.");
  let cursor = start,
    total = 0;
  for (let n = 0; n < count; n++) {
    if (cursor + 46 > b.length || b.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error("Invalid Excel archive directory.");
    const flags = b.readUInt16LE(cursor + 8),
      method = b.readUInt16LE(cursor + 10),
      compressed = b.readUInt32LE(cursor + 20),
      size = b.readUInt32LE(cursor + 24),
      nameLength = b.readUInt16LE(cursor + 28),
      extra = b.readUInt16LE(cursor + 30),
      comment = b.readUInt16LE(cursor + 32),
      offset = b.readUInt32LE(cursor + 42);
    if (flags & 1 || ![0, 8].includes(method) || size > 10 * 1024 * 1024 || offset + 30 > b.length)
      throw new Error("Encrypted or oversized workbook content is not supported.");
    if (b.readUInt32LE(offset) !== 0x04034b50) throw new Error("Invalid Excel archive entry.");
    const dataStart = offset + 30 + b.readUInt16LE(offset + 26) + b.readUInt16LE(offset + 28);
    if (dataStart + compressed > b.length) throw new Error("Truncated Excel archive.");
    const data = b.subarray(dataStart, dataStart + compressed);
    const expanded =
      method === 0 ? data : inflateRawSync(data, { maxOutputLength: 10 * 1024 * 1024 });
    total += expanded.length;
    if (expanded.length !== size || total > 40 * 1024 * 1024)
      throw new Error("Workbook expands beyond the 40 MB safety limit.");
    cursor += 46 + nameLength + extra + comment;
  }
}

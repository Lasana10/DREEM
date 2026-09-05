const VERSION = 4;
const SIZE = 21 + 4 * (VERSION - 1);
const DATA_CODEWORDS = 80;
const ECC_CODEWORDS = 20;

function appendBits(value: number, length: number, target: boolean[]) {
  if (length < 0 || (value >>> length) !== 0) throw new Error("QR bit value is out of range.");
  for (let bit = length - 1; bit >= 0; bit -= 1) target.push(((value >>> bit) & 1) !== 0);
}

function multiply(x: number, y: number) {
  let z = 0;
  for (let i = 0; i < 8; i += 1) {
    if ((y & 1) !== 0) z ^= x;
    y >>>= 1;
    x <<= 1;
    if ((x & 0x100) !== 0) x ^= 0x11d;
  }
  return z;
}

function reedSolomonDivisor(degree: number) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = multiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = multiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data: Uint8Array, divisor: Uint8Array) {
  const result = new Uint8Array(divisor.length);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < result.length; i += 1) result[i] ^= multiply(divisor[i], factor);
  }
  return result;
}

function encodeData(text: string) {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 78) throw new Error("Credential QR payload is too long.");
  const capacityBits = DATA_CODEWORDS * 8;
  const bits: boolean[] = [];
  appendBits(0x4, 4, bits); // Byte mode.
  appendBits(bytes.length, 8, bits); // Versions 1-9 use an 8-bit byte count.
  for (const byte of bytes) appendBits(byte, 8, bits);
  const terminator = Math.min(4, capacityBits - bits.length);
  for (let i = 0; i < terminator; i += 1) bits.push(false);
  while (bits.length % 8 !== 0) bits.push(false);

  const data = new Uint8Array(DATA_CODEWORDS);
  let dataLength = 0;
  for (let offset = 0; offset < bits.length; offset += 8) {
    let value = 0;
    for (let i = 0; i < 8; i += 1) value = (value << 1) | (bits[offset + i] ? 1 : 0);
    data[dataLength++] = value;
  }
  for (let pad = 0; dataLength < DATA_CODEWORDS; pad += 1) data[dataLength++] = pad % 2 === 0 ? 0xec : 0x11;

  const ecc = reedSolomonRemainder(data, reedSolomonDivisor(ECC_CODEWORDS));
  return new Uint8Array([...data, ...ecc]);
}

export function makeQrMatrix(text: string): boolean[][] {
  const codewords = encodeData(text);
  const modules = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
  const functionModule = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));

  const setFunction = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    functionModule[y][x] = true;
  };
  const drawFinder = (centreX: number, centreY: number) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const x = centreX + dx;
        const y = centreY + dy;
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(x, y, distance !== 2 && distance !== 4);
      }
    }
  };

  drawFinder(3, 3);
  drawFinder(SIZE - 4, 3);
  drawFinder(3, SIZE - 4);

  for (let i = 8; i < SIZE - 8; i += 1) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }

  const alignment = [6, 26];
  for (const y of alignment) {
    for (const x of alignment) {
      if ((x === 6 && y === 6) || (x === 6 && y === 26) || (x === 26 && y === 6)) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) setFunction(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  // Error correction L (format bits 01) with mask 0. A fixed valid mask keeps
  // the implementation small and deterministic for short, random credential tokens.
  const formatData = 1 << 3;
  let remainder = formatData;
  for (let i = 0; i < 10; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  const formatBits = ((formatData << 10) | remainder) ^ 0x5412;
  const formatBit = (index: number) => ((formatBits >>> index) & 1) !== 0;
  for (let i = 0; i <= 5; i += 1) setFunction(8, i, formatBit(i));
  setFunction(8, 7, formatBit(6));
  setFunction(8, 8, formatBit(7));
  setFunction(7, 8, formatBit(8));
  for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, formatBit(i));
  for (let i = 0; i < 8; i += 1) setFunction(SIZE - 1 - i, 8, formatBit(i));
  for (let i = 8; i < 15; i += 1) setFunction(8, SIZE - 15 + i, formatBit(i));
  setFunction(8, SIZE - 8, true);

  let bitIndex = 0;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const upward = ((right + 1) & 2) === 0;
      const y = upward ? SIZE - 1 - vertical : vertical;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (functionModule[y][x] || bitIndex >= codewords.length * 8) continue;
        const byte = codewords[bitIndex >>> 3];
        modules[y][x] = ((byte >>> (7 - (bitIndex & 7))) & 1) !== 0;
        bitIndex += 1;
      }
    }
  }

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (!functionModule[y][x] && (x + y) % 2 === 0) modules[y][x] = !modules[y][x];
    }
  }
  return modules;
}

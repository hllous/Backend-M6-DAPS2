/**
 * Lo que el backend hace con el archivo antes de guardarlo: reconocer qué es de
 * verdad, y sacarle los metadatos.
 *
 * Las dos cosas van juntas porque son la misma pasada sobre los bytes, y porque
 * las dos existen por el mismo motivo: **el cliente no es autoridad sobre el
 * archivo que sube**. El frontend declaró que sus controles son defensa en
 * profundidad y que el backend es el que valida (Issue #90).
 */

/** Firma de cada tipo aceptado, para reconocerlo sin creerle al cliente. */
const FIRMAS: [mime: string, firma: number[], offset: number][] = [
  ['image/jpeg', [0xff, 0xd8, 0xff], 0],
  ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0],
  ['application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d], 0], // "%PDF-"
  // WebP es un contenedor RIFF: "RIFF" ---- "WEBP".
  ['image/webp', [0x57, 0x45, 0x42, 0x50], 8],
];

/**
 * Qué tipo de archivo es realmente, mirando los primeros bytes.
 * `null` si no es ninguno de los que aceptamos.
 */
export function sniffMime(buffer: Buffer): string | null {
  for (const [mime, firma, offset] of FIRMAS) {
    if (buffer.length < offset + firma.length) continue;
    if (firma.every((byte, i) => buffer[offset + i] === byte)) {
      // El RIFF de WebP también arranca con "RIFF"; sin ese chequeo, un .wav
      // pasaría como imagen.
      if (mime === 'image/webp' && buffer.toString('ascii', 0, 4) !== 'RIFF') continue;
      return mime;
    }
  }
  return null;
}

/**
 * Saca los metadatos que puedan identificar a quién sacó la foto y dónde.
 *
 * **No re-codifica la imagen.** Es evidencia: los píxeles tienen que quedar
 * idénticos, y una librería como sharp los volvería a comprimir. Acá se recorta
 * la estructura del contenedor y se deja el dato de imagen intacto.
 *
 * **Ante cualquier estructura inesperada devuelve el archivo entero, sin
 * tocar.** Es la asimetría que importa: no sacar un metadato es una fuga de
 * privacidad, pero entregar un recorte de un archivo que no entendimos es
 * perder la evidencia. Lo segundo es peor.
 *
 * ponytail: PDF pasa sin tocar — sacarle los metadatos necesita un parser de
 * PDF, que es otro trabajo. Queda documentado en docs/api/endpoints.md.
 */
export function stripMetadata(buffer: Buffer, mime: string): Buffer {
  switch (mime) {
    case 'image/jpeg':
      return stripJpeg(buffer);
    case 'image/png':
      return stripPng(buffer);
    case 'image/webp':
      return stripWebp(buffer);
    default:
      return buffer;
  }
}

// ─── JPEG ───────────────────────────────────────────
//
// Es donde vive el problema real: las cámaras de los teléfonos escriben el GPS
// en un segmento APP1 (Exif). Se copian todos los segmentos menos los APP1..15
// y los comentarios, y al llegar al inicio del scan se copia el resto crudo.

const JPEG_SIN_LARGO = new Set([0xd8, 0xd9, 0x01]); // SOI, EOI, TEM

function stripJpeg(buffer: Buffer): Buffer {
  if (buffer.length < 4) return buffer;

  const partes: Buffer[] = [buffer.subarray(0, 2)]; // SOI
  let i = 2;

  while (i + 4 <= buffer.length) {
    // Donde debería empezar un segmento no hay uno: no entendemos el archivo.
    if (buffer[i] !== 0xff) return buffer;
    const marcador = buffer[i + 1];

    // Start of Scan: de acá en adelante son datos comprimidos, no segmentos.
    if (marcador === 0xda) {
      partes.push(buffer.subarray(i));
      return Buffer.concat(partes);
    }

    if (JPEG_SIN_LARGO.has(marcador) || (marcador >= 0xd0 && marcador <= 0xd7)) {
      partes.push(buffer.subarray(i, i + 2));
      i += 2;
      continue;
    }

    const largo = buffer.readUInt16BE(i + 2);
    if (largo < 2 || i + 2 + largo > buffer.length) return buffer; // truncado
    const fin = i + 2 + largo;

    // APP1..APP15 (Exif, XMP, IPTC…) y COM: fuera. APP0 es el JFIF, que
    // describe la imagen y no identifica a nadie.
    const esAppn = marcador >= 0xe1 && marcador <= 0xef;
    const esComentario = marcador === 0xfe;
    if (!esAppn && !esComentario) partes.push(buffer.subarray(i, fin));

    i = fin;
  }

  // Se acabaron los bytes sin llegar al scan: el archivo no tiene la forma que
  // esperábamos. Mejor devolverlo entero que entregar un recorte.
  return buffer;
}

// ─── PNG ────────────────────────────────────────────

/** Chunks que llevan texto o Exif. El resto describe la imagen. */
const PNG_A_SACAR = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);

function stripPng(buffer: Buffer): Buffer {
  const partes: Buffer[] = [buffer.subarray(0, 8)]; // firma
  let i = 8;
  let cerrado = false;

  while (i + 8 <= buffer.length) {
    const largo = buffer.readUInt32BE(i);
    const tipo = buffer.toString('ascii', i + 4, i + 8);
    const fin = i + 12 + largo; // largo + tipo + datos + CRC
    if (fin > buffer.length) return buffer; // chunk truncado

    if (!PNG_A_SACAR.has(tipo)) partes.push(buffer.subarray(i, fin));

    i = fin;
    if (tipo === 'IEND') {
      cerrado = true;
      break;
    }
  }

  // Sin IEND el archivo no está bien formado y no sabemos qué recortamos.
  return cerrado ? Buffer.concat(partes) : buffer;
}

// ─── WebP ───────────────────────────────────────────

const WEBP_A_SACAR = new Set(['EXIF', 'XMP ']);

function stripWebp(buffer: Buffer): Buffer {
  if (buffer.length < 12) return buffer;

  const partes: Buffer[] = [];
  let i = 12; // "RIFF" + tamaño + "WEBP"

  while (i + 8 <= buffer.length) {
    const fourcc = buffer.toString('ascii', i, i + 4);
    const largo = buffer.readUInt32LE(i + 4);
    const fin = i + 8 + largo + (largo % 2); // los chunks se alinean a par
    if (fin > buffer.length) return buffer; // chunk truncado

    if (!WEBP_A_SACAR.has(fourcc)) {
      const chunk = Buffer.from(buffer.subarray(i, fin));
      // VP8X anuncia en sus flags qué chunks trae. Si dejamos los bits de Exif
      // y XMP prendidos después de sacarlos, el archivo queda mintiendo.
      if (fourcc === 'VP8X' && chunk.length > 8) {
        chunk[8] &= ~0b0000_1100; // bit 3 = Exif, bit 2 = XMP
      }
      partes.push(chunk);
    }

    i = fin;
  }

  const cuerpo = Buffer.concat(partes);
  const salida = Buffer.concat([buffer.subarray(0, 12), cuerpo]);
  salida.writeUInt32LE(salida.length - 8, 4); // el tamaño RIFF cambió
  return salida;
}

// ─── Nombre del archivo ─────────────────────────────

const NOMBRE_MAX = 120;

/**
 * El nombre original que mandó el cliente, en condiciones de guardarse.
 *
 * Se guarda porque **es lo que un inspector reconoce** al abrir el acta:
 * `medidor-frente.jpg` dice algo, un UUID no. Pero llega del cliente, así que
 * se le saca cualquier ruta, los caracteres de control y el largo de más antes
 * de tocar la base o de viajar hacia M2.
 */
export function sanitizeFilename(original: string | undefined, extension: string): string {
  const base = quitarControl(
    String(original ?? '')
      .split(/[\\/]/)
      .pop() as string,
  )
    .replace(/^\.+/, '')
    .trim();

  if (!base) return `evidencia.${extension}`;

  const punto = base.lastIndexOf('.');
  const nombre = punto > 0 ? base.slice(0, punto) : base;
  return `${nombre.slice(0, NOMBRE_MAX) || 'evidencia'}.${extension}`;
}

/**
 * Fuera los caracteres de control. Se filtra por punto de código en vez de por
 * regex: la clase de control en el fuente son bytes invisibles, y un fuente que
 * depende de bytes que no se ven es un fuente que alguien rompe sin notarlo.
 */
function quitarControl(valor: string): string {
  return [...valor].filter((c) => c.codePointAt(0)! > 0x1f && c.codePointAt(0) !== 0x7f).join('');
}

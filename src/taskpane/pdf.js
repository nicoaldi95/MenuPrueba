/*
 * AuditX — Generador mínimo de PDF (sin dependencias)
 *
 * Produce un PDF de texto (A4, Helvetica) con títulos, párrafos, saltos de línea y paginación.
 * Sirve para el historial de firmas y las fichas de papeles. No pretende reemplazar a una librería
 * de maquetación: no hay imágenes ni tablas, solo texto con sangría.
 *
 *   const bytes = crearPdf({ titulo, subtitulo, bloques: [{ texto, tam, negrita, sangria, espacioAntes }] });
 *   descargarPdf(bytes, "historial.pdf");
 */

/* global document, URL, Blob */

const ANCHO = 595.28;
const ALTO = 841.89;
const MARGEN = 50;

// Anchos de Helvetica (unidades de 1/1000 em) para ASCII 32..126
const W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];

const CP1252 = { "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f };
const SUSTITUTOS = { "→": "->", "←": "<-", "✓": "x", "≥": ">=", "≤": "<=", " ": " ", "\t": " " };

function aByte(ch) {
  if (SUSTITUTOS[ch]) return SUSTITUTOS[ch];
  const c = ch.charCodeAt(0);
  if (c >= 32 && c < 127) return ch;
  if (c >= 0xa0 && c <= 0xff) return ch;
  if (CP1252[ch]) return ch;
  return "?";
}
const limpiar = (t) => Array.from(String(t == null ? "" : t)).map(aByte).join("");

function ancho(texto, tam, negrita) {
  let w = 0;
  for (const ch of texto) {
    const c = ch.charCodeAt(0);
    w += c >= 32 && c < 127 ? W[c - 32] : 556;
  }
  return (w / 1000) * tam * (negrita ? 1.07 : 1);
}

function partir(texto, tam, negrita, maximo) {
  const res = [];
  String(texto).split("\n").forEach((parrafo) => {
    const palabras = limpiar(parrafo).split(" ");
    let linea = "";
    palabras.forEach((p) => {
      const prueba = linea ? linea + " " + p : p;
      if (ancho(prueba, tam, negrita) <= maximo || !linea) linea = prueba;
      else {
        res.push(linea);
        linea = p;
      }
    });
    res.push(linea);
  });
  return res;
}

function literal(t) {
  let s = "(";
  for (const ch of t) {
    const c = ch.charCodeAt(0);
    if (ch === "(" || ch === ")" || ch === "\\") s += "\\" + ch;
    else if (c >= 32 && c < 127) s += ch;
    else {
      const b = CP1252[ch] !== undefined ? CP1252[ch] : c;
      s += "\\" + b.toString(8).padStart(3, "0");
    }
  }
  return s + ")";
}

export function crearPdf({ titulo = "", subtitulo = "", bloques = [], pie = "AuditX" }) {
  const paginas = [[]];
  let y = ALTO - MARGEN;
  const nueva = () => {
    paginas.push([]);
    y = ALTO - MARGEN;
  };
  const poner = (texto, tam, negrita, sangria) => {
    const maximo = ANCHO - 2 * MARGEN - sangria;
    partir(texto, tam, negrita, maximo).forEach((linea) => {
      if (y - tam < MARGEN + 20) nueva();
      y -= tam * 1.25;
      paginas[paginas.length - 1].push({ x: MARGEN + sangria, y, tam, negrita, texto: linea });
    });
  };
  if (titulo) poner(titulo, 16, true, 0);
  if (subtitulo) {
    y -= 2;
    poner(subtitulo, 9.5, false, 0);
  }
  if (titulo || subtitulo) y -= 8;
  bloques.forEach((b) => {
    if (b.espacioAntes) y -= b.espacioAntes;
    poner(b.texto, b.tam || 10, !!b.negrita, b.sangria || 0);
  });

  // objetos: 1 catálogo, 2 páginas, 3 Helvetica, 4 Helvetica-Bold, luego (página, contenido) por página
  const objs = [];
  const n = paginas.length;
  const idPagina = (i) => 5 + i * 2;
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = "<< /Type /Pages /Count " + n + " /Kids [" + paginas.map((_, i) => idPagina(i) + " 0 R").join(" ") + "] >>";
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  paginas.forEach((lineas, i) => {
    let c = "";
    lineas.forEach((l) => (c += "BT /" + (l.negrita ? "F2" : "F1") + " " + l.tam + " Tf " + l.x.toFixed(2) + " " + l.y.toFixed(2) + " Td " + literal(l.texto) + " Tj ET\n"));
    c += "BT /F1 8 Tf " + MARGEN + " 30 Td " + literal(limpiar(pie + "  -  Página " + (i + 1) + " de " + n)) + " Tj ET\n";
    objs[idPagina(i)] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + ANCHO + " " + ALTO + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + (idPagina(i) + 1) + " 0 R >>";
    objs[idPagina(i) + 1] = "<< /Length " + c.length + " >>\nstream\n" + c + "endstream";
  });

  let salida = "%PDF-1.4\n";
  const pos = [];
  for (let i = 1; i < objs.length; i++) {
    pos[i] = salida.length;
    salida += i + " 0 obj\n" + objs[i] + "\nendobj\n";
  }
  const xref = salida.length;
  salida += "xref\n0 " + objs.length + "\n0000000000 65535 f \n";
  for (let i = 1; i < objs.length; i++) salida += String(pos[i]).padStart(10, "0") + " 00000 n \n";
  salida += "trailer\n<< /Size " + objs.length + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
  // todo el contenido es ASCII (los acentos van como escapes octales)
  const bytes = new Uint8Array(salida.length);
  for (let i = 0; i < salida.length; i++) bytes[i] = salida.charCodeAt(i) & 0xff;
  return bytes;
}

/* Descarga con un enlace temporal. Si el navegador del panel lo bloquea, devuelve false. */
export function descargarPdf(bytes, nombre) {
  try {
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return true;
  } catch (e) {
    console.error("AuditX: no se pudo descargar el PDF", e);
    return false;
  }
}

/*
 * Experimental: el libro completo como PDF con la API de Office (no permite elegir hojas).
 * Con 295 hojas puede tardar mucho; se deja para probar en Excel real.
 */
export function pdfDelLibro() {
  return new Promise((resolve, reject) => {
    /* global Office */
    if (typeof Office === "undefined" || !Office.context || !Office.context.document || !Office.context.document.getFileAsync) {
      reject(new Error("fuera-de-excel"));
      return;
    }
    Office.context.document.getFileAsync(Office.FileType.Pdf, { sliceSize: 4194304 }, (r) => {
      if (r.status !== Office.AsyncResultStatus.Succeeded) return reject(new Error(r.error ? r.error.message : "error"));
      const archivo = r.value;
      const partes = [];
      let i = 0;
      const siguiente = () => {
        archivo.getSliceAsync(i, (s) => {
          if (s.status !== Office.AsyncResultStatus.Succeeded) {
            archivo.closeAsync();
            return reject(new Error(s.error ? s.error.message : "error"));
          }
          partes.push(new Uint8Array(s.value.data));
          if (++i < archivo.sliceCount) siguiente();
          else {
            archivo.closeAsync();
            const total = partes.reduce((a, p) => a + p.length, 0);
            const todo = new Uint8Array(total);
            let o = 0;
            partes.forEach((p) => {
              todo.set(p, o);
              o += p.length;
            });
            resolve(todo);
          }
        });
      };
      siguiente();
    });
  });
}

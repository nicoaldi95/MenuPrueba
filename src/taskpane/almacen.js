/*
 * AuditX — Almacenamiento dentro del libro
 *
 * Dentro de Excel guarda en una parte XML personalizada del libro (viaja con el archivo).
 * Fuera de Excel (vista previa en el navegador) usa localStorage.
 * Para llevarlo a SharePoint basta con reemplazar cargar() y guardar().
 */

/* global window, Office, Excel, DOMParser */

function dentroDeExcel() {
  return (
    typeof Office !== "undefined" &&
    typeof Excel !== "undefined" &&
    Office.context &&
    Office.context.host === Office.HostType.Excel
  );
}

const escXml = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function crearAlmacen({ namespace, claveLocal, raiz }) {
  return {
    async cargar() {
      if (dentroDeExcel()) {
        try {
          return await Excel.run(async (ctx) => {
            const partes = ctx.workbook.customXmlParts.getByNamespace(namespace);
            partes.load("items");
            await ctx.sync();
            if (!partes.items.length) return null;
            const xml = partes.items[0].getXml();
            await ctx.sync();
            const nodo = new DOMParser().parseFromString(xml.value, "application/xml").documentElement;
            return nodo && nodo.textContent ? JSON.parse(nodo.textContent) : null;
          });
        } catch (e) {
          console.warn("AuditX: no se pudo leer «" + raiz + "» del libro; se usa la copia local", e);
          return this._local();
        }
      }
      return this._local();
    },
    async guardar(datos) {
      const json = JSON.stringify(datos);
      if (dentroDeExcel()) {
        const xml = "<" + raiz + ' xmlns="' + namespace + '">' + escXml(json) + "</" + raiz + ">";
        await Excel.run(async (ctx) => {
          const partes = ctx.workbook.customXmlParts.getByNamespace(namespace);
          partes.load("items");
          await ctx.sync();
          if (partes.items.length) partes.items[0].setXml(xml);
          else ctx.workbook.customXmlParts.add(xml);
          await ctx.sync();
        });
        return;
      }
      window.localStorage.setItem(claveLocal, json);
    },
    _local() {
      try {
        const t = window.localStorage.getItem(claveLocal);
        return t ? JSON.parse(t) : null;
      } catch (e) {
        return null;
      }
    },
  };
}

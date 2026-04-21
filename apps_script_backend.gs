/**
 * AMPM — Checklist Operativo GZ — Backend mínimo (Apps Script)
 * - doGet: recibe ?to=&subject=&body=&returnTo=&syncId= y envía correo
 * - doPost: opcional (JSON) para futuro
 */

function doGet(e){
  const p = (e && e.parameter) ? e.parameter : {};
  const returnTo = (p.returnTo || "").trim();
  const syncId = (p.syncId || "").trim();

  try {
    const to = (p.to || "").trim();
    const subject = (p.subject || "AMPM — Resultado Checklist").trim();
    const body = (p.body || "(sin cuerpo)").toString();

    if(!to){
      return buildReturnPage_(returnTo, false, "Falta parámetro: to", syncId);
    }

    GmailApp.sendEmail(to, subject, body, { htmlBody: body });
    return buildReturnPage_(returnTo, true, "Correo enviado", syncId);

  } catch(err) {
    return buildReturnPage_(returnTo, false, String(err), syncId);
  }
}

function buildReturnPage_(returnTo, ok, msg, syncId){
  if(returnTo){
    const sep = returnTo.indexOf("?") >= 0 ? "&" : "?";
    const target =
      returnTo +
      sep + "mailStatus=" + encodeURIComponent(ok ? "ok" : "error") +
      "&mailMsg=" + encodeURIComponent(msg || "") +
      "&syncId=" + encodeURIComponent(syncId || "");

    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Redirigiendo...</title></head><body style="font-family:Arial,sans-serif;padding:24px;">' +
      '<p>' + (ok ? 'Correo enviado. Regresando a la app...' : 'Hubo un problema. Regresando a la app...') + '</p>' +
      '<script>window.location.replace(' + JSON.stringify(target) + ');<\/script>' +
      '<p><a href="' + target + '">Tocar aquí si no redirige automáticamente</a></p>' +
      '</body></html>'
    );
  }

  return ContentService.createTextOutput((ok ? 'OK: ' : 'ERROR: ') + (msg || ''));
}

function doPost(e){
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const to = (data.to || "").trim();
    const subject = (data.subject || "AMPM — Resultado Checklist").trim();
    const body = (data.body || "(sin cuerpo)").toString();

    if(!to) throw new Error("Falta 'to'");

    GmailApp.sendEmail(to, subject, body, { htmlBody: body });

    return ContentService
      .createTextOutput(JSON.stringify({ ok:true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok:false, error:String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

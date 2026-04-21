AMPM — Checklist Operativo GZ (v3)

1) Abrí una terminal en esta carpeta y levantá servidor local:
   python -m http.server 8000

2) Abrí en Chrome/Edge:
   http://localhost:8000

3) Correo (Apps Script):
   - Pegá el Web App URL (termina en /exec) en app.js:
     const SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/XXXX/exec";
   - En Apps Script, implementá como "App web" y copiá el URL /exec.

4) Flujo:
   Inicio → Checklist → Resultado → Sincronizar (abre una pestaña y Apps Script manda el correo).

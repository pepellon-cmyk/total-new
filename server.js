// server.js - backend simples para Kite for Life protótipo
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Storage dirs
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PROCESSED_DIR = path.join(DATA_DIR, 'processed');

// ensure dirs exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDir(DATA_DIR);
ensureDir(UPLOADS_DIR);
ensureDir(PROCESSED_DIR);

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// multer setup (memory)
const upload = multer({ storage: multer.memoryStorage() });

// helpers
function sanitizeFilename(s) {
  return s.replace(/[^a-z0-9_\-\.]/gi, '_').slice(0, 200);
}
function saveJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
}
function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function csvFromArrayOfObjects(arr, headers) {
  const cols = headers;
  const lines = [];
  lines.push(cols.join(','));
  arr.forEach(r => {
    const row = cols.map(c => `"${String(r[c] ?? '').replace(/"/g,'""')}"`).join(',');
    lines.push(row);
  });
  return lines.join('\n');
}

// POST /api/upload
// Uploads an Excel file, parses sheets and saves JSON per sheet: data/uploads/<uploadId>/<sheetName>.json
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const uploadId = Date.now().toString();
    const uploadDir = path.join(UPLOADS_DIR, uploadId);
    ensureDir(uploadDir);

    const sheets = [];

    workbook.SheetNames.forEach(name => {
      const sheet = workbook.Sheets[name];
      // parse as objects (header auto)
      const objs = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      // also extract header row (header:1)
      const arr = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      let headers = [];
      for (let r of arr) {
        if (Array.isArray(r) && r.some(c => String(c).trim() !== '')) {
          headers = r.map(h => String(h).trim());
          break;
        }
      }
      const safeName = sanitizeFilename(name) || `sheet_${sheets.length+1}`;
      const filePath = path.join(uploadDir, safeName + '.json');
      saveJson(filePath, objs);
      sheets.push({ name, safeName, headers, filePath: `/data/uploads/${uploadId}/${safeName}.json` });
    });

    // save a manifest for this upload
    const manifest = { uploadId, originalName: req.file.originalname, createdAt: new Date().toISOString(), sheets };
    saveJson(path.join(uploadDir, '_manifest.json'), manifest);

    res.json({ uploadId, sheets, manifest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/uploads -> list uploads (manifests)
app.get('/api/uploads', (req, res) => {
  try {
    const uploads = fs.readdirSync(UPLOADS_DIR).filter(d => fs.statSync(path.join(UPLOADS_DIR,d)).isDirectory());
    const manifests = uploads.map(id => {
      const p = path.join(UPLOADS_DIR, id, '_manifest.json');
      return readJson(p);
    }).filter(Boolean);
    res.json({ uploads: manifests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

// GET raw sheet file content (server side)
function loadRawSheet(uploadId, safeName) {
  const p = path.join(UPLOADS_DIR, uploadId, safeName + '.json');
  return readJson(p);
}
// save processed
function saveProcessed(uploadId, safeName, data) {
  const p = path.join(PROCESSED_DIR, `${uploadId}__${safeName}.json`);
  saveJson(p, data);
  return p;
}
function loadProcessed(uploadId, safeName) {
  const p = path.join(PROCESSED_DIR, `${uploadId}__${safeName}.json`);
  return readJson(p);
}

// POST /api/apply-mapping
// body: { uploadId, safeName, mapping }
// mapping: { Nome: "Coluna A", Matrícula: "Matricula", ... }
app.post('/api/apply-mapping', (req, res) => {
  try {
    const { uploadId, safeName, mapping } = req.body;
    if (!uploadId || !safeName || !mapping) return res.status(400).json({ error: 'Missing params' });

    const raw = loadRawSheet(uploadId, safeName);
    if (!raw) return res.status(404).json({ error: 'Sheet not found' });

    const STANDARD_FIELDS = ['Nome','Matrícula','Cargo','Data','Nota','Comentários','Status'];

    const processed = raw.map(obj => {
      const out = {};
      // map standard fields
      STANDARD_FIELDS.forEach(f => {
        const src = mapping[f];
        if (src && src in obj) out[f] = obj[src];
        else if (src && src !== '') {
          // fallback: find key by normalized compare
          const k = Object.keys(obj).find(k2 => k2.replace(/\s+/g,'').toLowerCase() === src.replace(/\s+/g,'').toLowerCase());
          out[f] = k ? obj[k] : '';
        } else {
          out[f] = '';
        }
      });
      // copy other fields
      Object.keys(obj).forEach(k => {
        if (!Object.values(mapping).includes(k)) out[k] = obj[k];
      });
      return out;
    });

    // save processed
    saveProcessed(uploadId, safeName, processed);

    res.json({ uploadId, safeName, processed, count: processed.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/data?uploadId=&safeName= -> returns processed if exists else raw
app.get('/api/data', (req, res) => {
  try {
    const { uploadId, safeName } = req.query;
    if (!uploadId || !safeName) return res.status(400).json({ error: 'Missing params' });
    const processed = loadProcessed(uploadId, safeName);
    if (processed) return res.json({ source: 'processed', data: processed });
    const raw = loadRawSheet(uploadId, safeName);
    if (!raw) return res.status(404).json({ error: 'Not found' });
    return res.json({ source: 'raw', data: raw });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

// CRUD endpoints operate on processed if exists, else raw (and write processed to persist changes)
app.post('/api/records', (req, res) => {
  try {
    const { uploadId, safeName, record } = req.body;
    if (!uploadId || !safeName || !record) return res.status(400).json({ error: 'Missing params' });
    const p = loadProcessed(uploadId, safeName) || loadRawSheet(uploadId, safeName) || [];
    p.push(record);
    saveProcessed(uploadId, safeName, p);
    res.json({ ok: true, data: p });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.put('/api/records/:index', (req, res) => {
  try {
    const index = Number(req.params.index);
    const { uploadId, safeName, record } = req.body;
    if (!uploadId || !safeName || !record || isNaN(index)) return res.status(400).json({ error: 'Missing params' });
    const p = loadProcessed(uploadId, safeName) || loadRawSheet(uploadId, safeName) || [];
    if (index < 0 || index >= p.length) return res.status(400).json({ error: 'Index out of range' });
    p[index] = record;
    saveProcessed(uploadId, safeName, p);
    res.json({ ok: true, data: p });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.delete('/api/records/:index', (req, res) => {
  try {
    const index = Number(req.params.index);
    const { uploadId, safeName } = req.body;
    if (!uploadId || !safeName || isNaN(index)) return res.status(400).json({ error: 'Missing params' });
    const p = loadProcessed(uploadId, safeName) || loadRawSheet(uploadId, safeName) || [];
    if (index < 0 || index >= p.length) return res.status(400).json({ error: 'Index out of range' });
    p.splice(index, 1);
    saveProcessed(uploadId, safeName, p);
    res.json({ ok: true, data: p });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/export?uploadId=&safeName= -> CSV download
app.get('/api/export', (req, res) => {
  try {
    const { uploadId, safeName } = req.query;
    if (!uploadId || !safeName) return res.status(400).json({ error: 'Missing params' });
    const data = loadProcessed(uploadId, safeName) || loadRawSheet(uploadId, safeName) || [];
    if (!data || !data.length) return res.status(404).json({ error: 'No data to export' });
    const headers = Object.keys(data[0]);
    const csv = csvFromArrayOfObjects(data, headers);
    res.setHeader('Content-Disposition', `attachment; filename="export_${uploadId}_${safeName}.csv"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

// fallback to serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
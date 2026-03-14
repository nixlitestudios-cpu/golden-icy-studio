const { getStore } = require('@netlify/blobs');
const { neon }     = require('@neondatabase/serverless');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

async function getDb() {
  const url = process.env.NETLIFY_DATABASE_URL;
  if (!url) throw new Error('NETLIFY_DATABASE_URL not set');
  return neon(url);
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id          SERIAL PRIMARY KEY,
      title       TEXT    NOT NULL,
      author      TEXT    NOT NULL,
      category    TEXT    DEFAULT 'General',
      file_name   TEXT    NOT NULL,
      file_key    TEXT    NOT NULL UNIQUE,
      file_url    TEXT    NOT NULL,
      file_size   NUMERIC(10,2) DEFAULT 0,
      file_type   TEXT    DEFAULT 'PDF',
      icon        TEXT    DEFAULT '📄',
      pages       INT     DEFAULT 1,
      rating      NUMERIC(3,1) DEFAULT 5.0,
      downloads   INT     DEFAULT 0,
      access      TEXT    DEFAULT 'free',
      uploaded_by TEXT    DEFAULT 'Anonymous',
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const contentType = event.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Must be multipart/form-data' }) };
    }

    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body);

    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'No boundary found' }) };
    }

    const parts      = parseMultipart(body, boundaryMatch[1]);
    const filePart   = parts.find(p => p.name === 'file');
    const fileNameP  = parts.find(p => p.name === 'fileName');
    const authorP    = parts.find(p => p.name === 'author');
    const categoryP  = parts.find(p => p.name === 'category');

    if (!filePart) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'No file in request' }) };
    }

    const fileData     = filePart.data;
    const originalName = filePart.filename || 'document';
    const fileName     = (fileNameP ? fileNameP.data.toString() : Date.now() + '_' + originalName);
    const author       = authorP   ? authorP.data.toString()   : 'Anonymous';
    const category     = categoryP ? categoryP.data.toString() : 'General';
    const sizeMB       = (fileData.length / 1048576).toFixed(2);
    const ext          = originalName.split('.').pop().toLowerCase();
    const title        = originalName.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ');
    const icon         = ext === 'pdf' ? '📄' : (ext === 'ppt' || ext === 'pptx') ? '📊' : (ext === 'doc' || ext === 'docx') ? '📝' : '📃';
    const pages        = Math.max(1, Math.floor(fileData.length / 3000));

    if (fileData.length > 100 * 1024 * 1024) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'File too large. Max 100MB.' }) };
    }

    // 1. Save file to Netlify Blobs
    const store   = getStore({ name: 'docusphere-files', consistency: 'strong' });
    const key     = 'files/' + fileName;
    await store.set(key, fileData, {
      metadata: { originalName, uploadedAt: new Date().toISOString(), contentType: filePart.contentType || 'application/octet-stream', sizeMB }
    });

    const siteUrl = process.env.URL || 'https://docuspherepro.netlify.app';
    const fileUrl = siteUrl + '/.netlify/functions/serve?key=' + encodeURIComponent(key);

    // 2. Save metadata to Neon database
    const sql = await getDb();
    await ensureTable(sql);
    const result = await sql`
      INSERT INTO documents (title, author, category, file_name, file_key, file_url, file_size, file_type, icon, pages, uploaded_by)
      VALUES (${title}, ${author}, ${category}, ${originalName}, ${key}, ${fileUrl}, ${parseFloat(sizeMB)}, ${ext.toUpperCase()}, ${icon}, ${pages}, ${author})
      RETURNING id
    `;

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: fileUrl, key, sizeMB, id: result[0].id, title })
    };

  } catch (err) {
    console.error('Upload error:', err);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server error: ' + err.message })
    };
  }
};

function parseMultipart(buffer, boundary) {
  const parts    = [];
  const boundBuf = Buffer.from('--' + boundary);
  let   pos      = 0;
  while (pos < buffer.length) {
    const boundPos = indexOf(buffer, boundBuf, pos);
    if (boundPos === -1) break;
    pos = boundPos + boundBuf.length;
    if (buffer[pos] === 45 && buffer[pos + 1] === 45) break;
    if (buffer[pos] === 13 && buffer[pos + 1] === 10) pos += 2;
    const headersEnd = indexOf(buffer, Buffer.from('\r\n\r\n'), pos);
    if (headersEnd === -1) break;
    const headerStr = buffer.slice(pos, headersEnd).toString();
    pos = headersEnd + 4;
    const nextBound = indexOf(buffer, boundBuf, pos);
    const dataEnd   = nextBound === -1 ? buffer.length : nextBound - 2;
    const data      = buffer.slice(pos, dataEnd);
    pos             = nextBound === -1 ? buffer.length : nextBound;
    const part      = { data };
    const dispMatch = headerStr.match(/Content-Disposition:[^\r\n]*name="([^"]+)"/i);
    if (dispMatch) part.name = dispMatch[1];
    const fileMatch = headerStr.match(/filename="([^"]+)"/i);
    if (fileMatch) part.filename = fileMatch[1];
    const ctMatch   = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
    if (ctMatch) part.contentType = ctMatch[1].trim();
    parts.push(part);
  }
  return parts;
}

function indexOf(buf, search, start) {
  start = start || 0;
  for (let i = start; i <= buf.length - search.length; i++) {
    let found = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}

const { neon } = require('@neondatabase/serverless');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    const sql  = neon(process.env.NETLIFY_DATABASE_URL);
    const action = (event.queryStringParameters && event.queryStringParameters.action) || 'list';

    // List all documents
    if (action === 'list') {
      const rows = await sql`
        SELECT id, title, author, category, file_name, file_url, file_size,
               file_type, icon, pages, rating, downloads, access, uploaded_by,
               uploaded_at
        FROM documents
        ORDER BY uploaded_at DESC
      `;
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ docs: rows })
      };
    }

    // Increment download count
    if (action === 'download') {
      const id = event.queryStringParameters.id;
      if (id) {
        await sql`UPDATE documents SET downloads = downloads + 1 WHERE id = ${parseInt(id)}`;
      }
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unknown action' }) };

  } catch (err) {
    console.error('Docs error:', err);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};

const { getStore } = require('@netlify/blobs');

exports.handler = async function(event) {
  const key = event.queryStringParameters && event.queryStringParameters.key;
  if (!key) {
    return { statusCode: 400, body: 'Missing key parameter' };
  }

  try {
    const store  = getStore({ name: 'docusphere-files', consistency: 'strong' });
    const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });

    if (!result || !result.data) {
      return { statusCode: 404, body: 'File not found' };
    }

    const contentType = (result.metadata && result.metadata.contentType) || 'application/octet-stream';
    const fileName    = (result.metadata && result.metadata.originalName) || key.split('/').pop();
    const buffer      = Buffer.from(result.data);

    return {
      statusCode: 200,
      headers: {
        'Content-Type':        contentType,
        'Content-Disposition': 'attachment; filename="' + fileName + '"',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':       'public, max-age=31536000'
      },
      body:            buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    console.error('Serve error:', err);
    return { statusCode: 500, body: 'Error retrieving file: ' + err.message };
  }
};

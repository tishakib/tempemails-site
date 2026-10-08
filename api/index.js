const { handleApiRequest } = require('../server.js');

module.exports = async (req, res) => {
  const handled = await handleApiRequest(req, res);
  if (!handled) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'API route not found' }));
  }
};

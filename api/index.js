const { requestHandler } = require('../index.js');

module.exports = (req, res) => {
  return requestHandler(req, res);
};

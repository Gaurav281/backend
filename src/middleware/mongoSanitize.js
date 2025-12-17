const sanitize = (obj) => {
  if (!obj) return;

  for (const key in obj) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (typeof obj[key] === 'object') {
      sanitize(obj[key]);
    }
  }
};

module.exports = (req, res, next) => {
  sanitize(req.body);
  sanitize(req.params);
  sanitize(req.query);
  next();
};

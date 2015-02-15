var Tree = require('../models/tree');

exports.getByVariant = function(req, res) {
  var repoName = req.params.repo_name;
  var variant = req.params.variant;
  Tree.getByVariant(repoName, variant)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
};

var VariantGraph = require('../models/variant-graph');

exports.get = function(req, res) {
  var repo_name = req.params.repo_name;
  VariantGraph.findByRepoName(repo_name)
    .then(function(result) {
      res.json(result.graph);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}
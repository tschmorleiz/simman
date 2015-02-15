var SimilarityEvolution = require('../models/similarityEvolution');



// similarity evolutions grouped by first commit point
exports.groupByCommit = function(req, res) {
  var repoName = req.params.repo_name;
  var threshold = req.query.threshold || 0;
  SimilarityEvolution.groupByCommit(repoName, threshold)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
};

exports.compareVariant = function(req, res) {
  var repoName = req.params.repo_name;
  var variant = req.params.variant;
  var threshold = req.query.threshold || 0;
  SimilarityEvolution.compareVariant(repoName, variant, threshold)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
};

// similarity evolutions at first commit point, grouped by target variant
exports.groupByVariant = function(req, res) {
  var repoName = req.params.repo_name;
  var sha = req.params.sha;
  var threshold = req.query.threshold || 0;
  SimilarityEvolution.groupByVariant(repoName, sha, threshold)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
};


exports.compareFolder = function(req, res) {
  var repoName = req.params.repo_name;
  var variant = req.params.variant;
  var relative_path = req.param(0).slice(1);
  var threshold = req.query.threshold || 0
  SimilarityEvolution.compareFolder(repoName, variant, relative_path, threshold)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
};

exports.compareFile = function(req, res) {
  var repoName = req.params.repo_name;
  var variant = req.params.variant;
  var relative_path = req.param(0).slice(1);
  var threshold = req.query.threshold || 0
  SimilarityEvolution.compareFile(repoName, variant, relative_path, threshold)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
};

// similarity evolutions at first commit point and variant, grouped by target path
exports.groupByPath = function(req, res) {
  var repoName = req.params.repo_name;
  var sha = req.params.sha;
  var variant = req.params.variant;
  var threshold = req.query.threshold || 0;
  SimilarityEvolution.groupByPath(repoName, sha, variant, threshold)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
};

exports.compareFragment = function(req, res) {
  var repoName = req.params.repo_name;
  var id = req.params.id;
  var threshold = req.query.threshold || 0
  SimilarityEvolution.compareFragment(repoName, id, threshold)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}

// similarity evolutions at first commit point and variant, grouped by target path
exports.groupByFragment = function(req, res) {
  var repoName = req.params.repo_name;
  var sha = req.params.sha;
  var variant = req.params.variant;
  var relative_path = req.param(0).slice(1);
  var threshold = req.query.threshold || 0;
  SimilarityEvolution.groupByFragment(repoName, sha, variant, relative_path, threshold)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
};

exports.getSCCs = function(req, res) {
  var repoName = req.params.repo_name;
  SimilarityEvolution.getSCCs(repoName)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}

exports.get = function(req, res) {
  var id = req.params.id;
  SimilarityEvolution.get(id)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
};
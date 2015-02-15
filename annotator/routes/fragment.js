var path = require('path');

var Fragment = require('../models/fragmentSnapshot');


exports.index = function(query, res) {
  Fragment.index(query)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}

exports.indexAll = function(req, res) {
  exports.index({
    repo_name: req.params.repo_name
  }, res);
};

exports.indexByCommit = function(req, res) {
  exports.index({
    repo_name: req.params.repo_name,
    sha: req.params.sha
  }, res);
};

exports.indexByCommitAndVariant = function(req, res) {
  exports.index({
    repo_name: req.params.repo_name,
    sha: req.params.sha,
    variant: req.params.variant
  }, res);
};

exports.get = function(req, res) {
  Fragment.getAndPopulate(req.params.id)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}
var Repo = require('../models/repo');

exports.get = function(req, res) {
	var name = req.params.name;
	Repo.findByName(name)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}

exports.index = function(req, res) {
  var name = req.params.name;
  Repo.index()
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}

exports.update = function(req, res) {
  var name = req.params.name;
  var data = req.body;
  Repo.findAndUpdate(name, data)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}
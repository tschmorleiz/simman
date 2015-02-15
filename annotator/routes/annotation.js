var Annotation = require('../models/annotation');

exports.post = function(req, res) {
	var data = req.body;
  Annotation.saveAndClose(data) 
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}

exports.put = function(req, res) {
  var data = req.body;
  var id = data._id;
  delete data._id;
  Annotation.updateAndClose(id, data)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}

exports.get = function(req, res) {
  var evolution_id = req.query.annotated_evolution_id;
  Annotation.findByEvolutionId(evolution_id)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}

exports.getByFragmentIds = function(req, res) {
  var idF1 = req.params.idF1;
  var idF2 = req.params.idF2;
  Annotation.getByFragmentIds(idF1, idF2)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}

exports.annotateSCC = function(req, res) {
  var data = req.body;
  Annotation.annotateSCC(data)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}

exports.closeTriangles = function(req, res) {
  var evolution_id = req.params.evolution_id;
  Annotation.closeTriangles(evolution_id)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}


exports.index = function(req, res) {
  var repoName = req.params.repo_name;
  Annotation.findByRepoName(repoName)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}

exports.countInVariant = function(req, res) {
  var repoName = req.params.repo_name;
  var variant = req.params.variant;
  Annotation.countInVariant(repoName, variant)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}

exports.countInPath = function(req, res) {
  var repoName = req.params.repo_name;
  var variant = req.params.variant;
  var relative_path = req.param(0).slice(1);
  Annotation.countInPath(repoName, variant, relative_path)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}

exports.countInFragment = function(req, res) {
  var repoName = req.params.repo_name;
  var variant = req.params.variant;
  var path = req.param(0).slice(1).split('/');
  var relative_path = path.slice(0,-2).join('/');
  var classifier = path[path.length - 2];
  var name = path[path.length - 1];
  Annotation.countInFragment(repoName, variant, relative_path, classifier, name)
    .then(function(result) {
      res.json(result);
    })
    .catch(function(err) {
      res.status(err.code || 500);
      res.json({message: err.message})
    });
}

var Repo = require('../models/repo');
var Q = require('q');
var mongoose = require('mongoose-q')(require('mongoose'));


var Schema   = mongoose.Schema;
var treeSchema = new Schema({
  repo_path               : {type: String},
  variant                 : {type: String},
  tree                    : {type: Schema.Types.Object}
});
 
 
treeSchema.statics.getByVariant = function(repoName, variant) {
  return Repo.findOneQ({name: repoName})
    .then(function(repo) {
      return Tree.findOneQ({repo_path: repo.path, variant: variant})
    })
}

var Tree = mongoose.model('Tree', treeSchema);

module.exports = Tree;
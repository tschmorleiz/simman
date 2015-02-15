var Repo = require('../models/repo');
var Q = require('q');
var mongoose = require('mongoose-q')(require('mongoose'));


// schema for a similarity evolution
var Schema   = mongoose.Schema;
var variantGraphSchema = new Schema({
  repo_path               : {type: String},
  graph                   : {type: Object},
  
}, { collection: 'variantGraphs' } );

variantGraphSchema.statics.findByRepoName = function(repoName) {
  var self = this;
  return Repo.findOneQ({name: repoName})
  	.then(function(repo) {
  		return VariantGraph.findOneQ({repo_path: repo.path});
  	});
}
 
var VariantGraph = mongoose.model('VariantGraph', variantGraphSchema);
 
module.exports = VariantGraph;
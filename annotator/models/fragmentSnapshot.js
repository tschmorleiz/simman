var Repo = require('../models/repo');
var Q = require('q');
var mongoose = require('mongoose-q')(require('mongoose'));


// schema for a fragment (project)
var Schema   = mongoose.Schema;
var fragmentSnapshotSchema = new Schema({
  repo_path     : {type: String},
  relative_path : {type: String},
  variant       : {type: String},
  sha           : {type: String},
  name          : {type: String},
  from          : {type: Schema.Types.Object},
  to            : {type: Schema.Types.Object},
  is_new        : {type: Boolean},
  content       : {type: String}
}, { collection: 'fragmentSnapshots' } );
 
fragmentSnapshotSchema.statics.index = function(query) {
  var self = this;
  return Repo.findOneQ({name: query.repo_name})
    .then(function(repo) {
      delete query.repo_name;
      query.repo_path = repo.path; 
      return self.findQ(query);    
    })
}

fragmentSnapshotSchema.statics.getAndPopulate = function(id) {
  var self = this;
  return this.findByIdQ(id)
    .then(function(fragment) {
      return Repo.findOneQ({path: fragment.repo_path})
        .then(function(repo) {
          return repo.getFileContent(fragment.sha, fragment.variant, fragment.relative_path)
            .then(function(content) {
              fragment.content = content.split('\n').slice(fragment.from - 1, fragment.to).join('\n');
              return fragment;
            });
        })
    })
}

var FragmentSnapshot = mongoose.model('FragmentSnapshot', fragmentSnapshotSchema);
 
module.exports = FragmentSnapshot;
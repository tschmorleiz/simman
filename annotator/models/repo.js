var Q = require('q');
var mongoose = require('mongoose-q')(require('mongoose'));
var sem = require('semaphore')(1);
var path = require('path');
var exec = require('child_process').exec;
var git = require('nodegit');
var fs = require('fs');
 
// schema for a repo (project)
var Schema   = mongoose.Schema;
var repoSchema = new Schema({
  name                : {type: String},
  path                : {type: String},
  settings            : {type: Schema.Types.Object},
  last_hexsha_checked : {type: String}
});


repoSchema.methods.updateSettings = function(data) {
    this.settings = data.settings;
    return this.saveQ();
}

repoSchema.methods.getVariationDir = function() {
  var variationDirs = this.settings.variationDirs; 
  for(var i = 0; i < variationDirs.length; i++) {
    var fullPath = path.join(this.path, variationDirs[i]);
    if (fs.existsSync(fullPath)) {
      return variationDirs[i];
    }
  }
}

repoSchema.methods.getFileContent = function (sha, variant, relativePath) {
  var self = this;
  var deferred = Q.defer();
  var promise = deferred.promise;
  var gitPath = path.join(self.path ,'.git');
  git.Repository.open(gitPath, function(error, nodegitRepository) {
    sem.take(function() {
      exec('cd ' + self.path + '; git checkout ' + sha + '; git checkout ' + sha, function(err, branch) {
        var variationDir = self.getVariationDir();
        fs.readFile(path.join(self.path, variationDir, variant, relativePath), 'utf8', function(err, data) {
          deferred.resolve(data);
          sem.leave()
        });
      })
    });
  })
  return promise;
}
 
repoSchema.statics.index = function() {
  return this.findQ({}, 'name path');
}

repoSchema.statics.findByName = function(name) {
  return this.findOneQ({name: name});
}

repoSchema.statics.findAndUpdate = function(name, data) {
  return this.findOneQ({name: name})
    .then(function(repo) {
      return repo.updateSettings(data);
    });
}

var Repo = mongoose.model('Repo', repoSchema);
 
module.exports = Repo;
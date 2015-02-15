var Fragment = require('../models/fragmentSnapshot');
var GraphDump = require('../models/graph-dump');
var Repo = require('../models/repo');
var Q = require('q');
var mongoose = require('mongoose-q')(require('mongoose'));


// schema for a fragment (project)
var Schema   = mongoose.Schema;
var similarityEvolutionSchema = new Schema({
  repo_path                   : {type: String},
  first_sha                   : {type: String},
  first_source_id             : {type: Schema.Types.ObjectId, ref: 'Fragment'},
  first_target_id             : {type: Schema.Types.ObjectId, ref: 'Fragment'},
  first_target_relative_path  : {type: String},
  first_target_name           : {type: String},
  first_target_classifier     : {type: String},
  first_diff_ratio            : {type: Number},
  last_source_id              : {type: Schema.Types.ObjectId, ref: 'Fragment'},
  last_target_id              : {type: Schema.Types.ObjectId, ref: 'Fragment'},
  last_diff_ratio             : {type: Number},
  source_track_id             : {type: String},
  target_track_id             : {type: String}
}, { collection: 'similarityEvolutions' } );


similarityEvolutionSchema.statics.groupByCommit = function(repoName, threshold) {
  var self = this;
  return Repo.findOneQ({name: repoName})
    .then(function(repo) {
      return SimilarityEvolution.aggregateQ([{
          $match : {
            repo_path : repo.path,
            last_diff_ratio: {$exists : true},
            first_diff_ratio: {$gte: parseFloat(threshold)},
            last_diff_ratio: {$gte: parseFloat(threshold)}
          }
        }, {
          $group : {
            _id : "$first_sha",
            count : { $sum : 1 },
            diff_ratio_avg : { $avg : "$first_diff_ratio"}
          }  
        }
      ])      
    })
}

similarityEvolutionSchema.statics.mergeAggs = function(docs1, docs2) {
  var result = {};
  var ids = [];

  var getId = function(doc) {
    if (typeof(doc._id) == "object") {
      return JSON.stringify(doc._id);
    } else {
      return doc._id;
    }
  }
  for (var i = 0; i < docs1.length; i++) {
    ids.push(getId(docs1[i]));
    if (result[getId(docs1[i])]) {
      if (result[getId(docs1[i])].ids) {
        result[getId(docs1[i])].ids.push(docs1[i]._id._id);
      }
    } else {
      result[getId(docs1[i])] = docs1[i];
      if (result[getId(docs1[i])].ids) {
        result[getId(docs1[i])].ids = [docs1[i]._id._id];
      }
    }
    
  }
  for (var i = 0; i < docs2.length; i++) {
    if (result[getId(docs2[i])]) {
      result[getId(docs2[i])].first_diff_ratio_avg += docs2[i].first_diff_ratio_avg;
      result[getId(docs2[i])].first_diff_ratio_avg /= 2
      result[getId(docs2[i])].diff_ratio_avg += docs2[i].diff_ratio_avg;
      result[getId(docs2[i])].diff_ratio_avg /= 2
      result[getId(docs2[i])].diff_ratio_sum += docs2[i].diff_ratio_sum;
      if (docs2[i].count) {
        result[getId(docs2[i])].count += docs2[i].count;
      }
      if (result[getId(docs2[i])].ids) {
        result[getId(docs2[i])].ids.push(docs2[i]._id._id);
      }
    } else {
      ids.push(getId(docs2[i]));
      result[getId(docs2[i])] = docs2[i];
      result[getId(docs2[i])].diff_ratio_sum = docs2[i].diff_ratio_sum;
      result[getId(docs2[i])].count = docs2[i].count;
      result[getId(docs2[i])].ids = [docs2[i]._id._id];
    }
  }
  var out = [];
  for (var i = 0; i < ids.length; i++) {
    out.push(result[ids[i]]);
  }
  return out;
}

similarityEvolutionSchema.statics.mergeCompares = function(docs1, docs2, sha, variant, threshold, match_file) {
    var avg = function(doc, value, variant1, variant2, path2) {
      var m1 = {sha: sha, variant: variant1};
      if (match_file) {
        m1.relative_path = match_file;
      }
      return Fragment.countQ(m1)
        .then(function(count1) {
          var m2 = {sha: sha, variant: variant2};
          if (match_file) {
            m2.relative_path = otherPath;
          }
          return Fragment.countQ({sha: sha, variant: variant2})
            .then(function(count2) {
              var result = {
                _id            : doc._id,
                diff_ratio_avg : value / (count1 + count2),
                diff_ratio_sum : value,
                count          : doc.count,
                count_total    : count1 + count2
              };
              return result;
            });
        });
    }
    var raw = SimilarityEvolution.mergeAggs(docs1, docs2);
    var results = [];
    for (var i = 0; i < raw.length; i++) {
      var otherVariant;
      var otherPath;
      if (typeof(raw[i]._id) == 'object') {
        otherVariant = raw[i]._id.variant;
        otherPath = raw[i]._id.relative_path;
      } else {
        otherVariant = raw[i]._id;
      }
      var future = avg(raw[i], raw[i].diff_ratio_sum, variant, otherVariant, otherPath);
      results.push(future);
    }
    return Q.all(results)
      .then(function(results) {
        var compare = function(a,b) {
          if (a.diff_ratio_avg < b.diff_ratio_avg)
             return 1;
          if (a.diff_ratio_avg > b.diff_ratio_avg)
            return -1;
          return 0;
        }
        return results.sort(compare).filter(function(e) {return e.diff_ratio_avg >= threshold});
      })
}

similarityEvolutionSchema.statics.compareVariant = function(repoName, variant, threshold) {
  var self = this;
  return Repo.findOneQ({name: repoName})
    .then(function(repo) {
      var agg = function(id, otherId) {
        var match = {
          repo_path: repo.path
        };
        match[id] = variant;
        return SimilarityEvolution.aggregateQ([{
            $match : match
          }, {
            $group : {
              _id : otherId,
              diff_ratio_sum : { $sum : "$last_diff_ratio"}
            }
          }, {
            $sort: {
              diff_ratio_avg: -1
            }
          }
        ])  
      }

      return agg("last_source_variant", "$last_target_variant")
        .then(function(docs1) {
          return agg("last_target_variant", "$last_source_variant")
            .then(function(docs2) {
              return SimilarityEvolution.mergeCompares(docs1, docs2, repo.last_hexsha_checked, variant, threshold);
            });
        });
    })
}

similarityEvolutionSchema.statics.groupByVariant = function(repoName, sha, threshold) {
  var self = this;
  return Repo.findOneQ({name: repoName})
    .then(function(repo) {

      var agg = function(id) {
        return SimilarityEvolution.aggregateQ([{
            $match : {
              repo_path : repo.path,
              first_sha: sha,
              last_diff_ratio: {$exists : true},
              first_diff_ratio: {$gte: parseFloat(threshold)},
              last_diff_ratio: {$gte: parseFloat(threshold)}
            }
          }, {
            $group : {
              _id : id,
              count : { $sum : 1 },
              first_diff_ratio_avg : { $avg : "$first_diff_ratio"}
            }  
          }
        ]);
      }

      return agg("$first_source_variant")
        .then(function(docs1) {
          return agg("$first_target_variant")
            .then(function(docs2) {
              return SimilarityEvolution.mergeAggs(docs1, docs2);
            });
        });
    });       
}

similarityEvolutionSchema.statics.compareFolder = function(repoName, variant, relativePath, threshold) {
  var self = this;
  var escaped = relativePath.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  return Repo.findOneQ({name: repoName})
    .then(function(repo) {
      var agg = function(v, p, otherV, otherP) {
        var match = {
          repo_path: repo.path
        };
        match[v] = variant;
        match[p] = {$regex: new RegExp('^' + escaped)}
        return SimilarityEvolution.aggregateQ([{
            $match : match
          }, {
            $group : {
              _id : {
                variant: otherV,
                relative_path: otherP
              },
              diff_ratio_sum : { $sum : "$last_diff_ratio"},
              count : {$sum: 1}
            }
          }, {
            $sort: {
              diff_ratio_avg: -1
            }
          }
        ])  
      }

      var putIntoFolders = function(merged) {
        var paths = {}
        for (var i = 0; i < merged.length; i++) {
          var filePath = merged[i]._id.relative_path;
          var dir = filePath.substring(0, filePath.lastIndexOf('/')) || '.';
          var variant = merged[i]._id.variant;
          while (true) {
            var hash = dir + '^' + variant;
            if (!paths[hash]) {
              paths[hash] = {
                diff_ratio_sum : 0,
                count_total    : 0,
                dir            : dir,
                variant        : variant
              }
            }
            paths[hash].diff_ratio_sum += merged[i].diff_ratio_sum;
            paths[hash].count_total = merged[i].count_total;
            if (dir === '.') {
              break;
            }
            dir = dir.substring(0, dir.lastIndexOf('/')) || '.';
          }
        }
        var blacklisted = {}
        for (hash in paths) {
          if (paths.hasOwnProperty(hash)) {
            var element = paths[hash];
            var dir = element.dir;
            var parentDir;
            while (true) {
              var parentDir = dir.substring(0, dir.lastIndexOf('/')) || '.';
              if (dir == parentDir) {
                break;
              }
              var parentHash = parentDir + "^" + element.variant;
              if (element.diff_ratio_sum / element.count_total >= paths[parentHash].diff_ratio_sum / paths[parentHash].count_total ) {
                blacklisted[parentHash] = true;
              }
              if (dir === '.') {
                break;
              }
              dir = parentDir;
            }
          }
        }
        var result = [];
        for (hash in paths) {
          if (paths.hasOwnProperty(hash)) {
            if (!blacklisted[hash]) {
              var element = paths[hash];
              result.push({
                variant : element.variant,
                diff_ratio_avg: element.diff_ratio_sum / element.count_total,
                dir : element.dir
              })
            }
          }
        }
        return result;

      }

      return agg("last_source_variant", "last_source_relative_path", "$last_target_variant", "$last_target_relative_path")
        .then(function(docs1) {
          return agg("last_target_variant", "last_target_relative_path", "$last_source_variant", "$last_source_relative_path")
            .then(function(docs2) {
              return SimilarityEvolution.mergeCompares(docs1, docs2, repo.last_hexsha_checked, variant, threshold, {$regex: new RegExp('^' + escaped)})
                .then(function(merged) {
                  return putIntoFolders(merged);
                })
            });
        });
    })
}

similarityEvolutionSchema.statics.compareFile = function(repoName, variant, relativePath, threshold) {
  var self = this;
  return Repo.findOneQ({name: repoName})
    .then(function(repo) {
      var agg = function(v, p, otherV, otherP) {
        var match = {
          repo_path: repo.path
        };
        match[v] = variant;
        match[p] = relativePath;
        return SimilarityEvolution.aggregateQ([{
            $match : match
          }, {
            $group : {
              _id : {
                variant: otherV,
                relative_path: otherP
              },
              diff_ratio_sum : { $sum : "$last_diff_ratio"},
              count : {$sum: 1}
            }
          }, {
            $sort: {
              diff_ratio_avg: -1
            }
          }
        ])  
      }

      var putInFiles = function(merged) {
        var result = [];
        for (var i = 0; i < merged.length; i++) {
          result.push({
            variant: merged[i]._id.variant,
            diff_ratio_avg: merged[i].diff_ratio_avg,
            file: merged[i]._id.relative_path
          });
        }
        return result;
      }

      return agg("last_source_variant", "last_source_relative_path", "$last_target_variant", "$last_target_relative_path")
        .then(function(docs1) {
          return agg("last_target_variant", "last_target_relative_path", "$last_source_variant", "$last_source_relative_path")
            .then(function(docs2) {
              return SimilarityEvolution.mergeCompares(docs1, docs2, repo.last_hexsha_checked, variant, threshold, relativePath)
                .then(function(merged) {
                  return putInFiles(merged)
                })
            });
        });
    })
}

similarityEvolutionSchema.statics.groupByPath = function(repoName, sha, variant, threshold) {
  var self = this;
  return Repo.findOneQ({name: repoName})
    .then(function(repo) {

      var agg = function(matcher, id) {
        var match = {
          repo_path : repo.path,
          first_sha: sha,
          last_diff_ratio: {$exists : true},
          first_diff_ratio: {$gte: parseFloat(threshold)},
          last_diff_ratio: {$gte: parseFloat(threshold)}
        }

        match[matcher] = variant;

        return SimilarityEvolution.aggregateQ([{
            $match : match }, {
            $group : {
              _id : id,
              count : { $sum : 1 },
              first_diff_ratio_avg : { $avg : "$first_diff_ratio"}
            }  
          }
        ]); 
      }
      
      return agg("first_target_variant", "$first_target_relative_path")
        .then(function(docs1) {
          return agg("first_source_variant", "$first_source_relative_path")
            .then(function(docs2) {
              return SimilarityEvolution.mergeAggs(docs1, docs2);
            })
        })

    })  
}

similarityEvolutionSchema.statics.compareFragment = function(repoName, id, threshold) {
    var self = this;
  return Repo.findOneQ({name: repoName})
    .then(function(repo) {
      var agg = function(id_, direction) {
        var match = {
          repo_path: repo.path,
          last_diff_ratio: {$gte: parseFloat(threshold)}
        };
        match[id_] = mongoose.Types.ObjectId(id);
        return SimilarityEvolution.aggregateQ([{
            $match : match
          }, {
            $group : {
              _id : {
                id: "$_id",
                fragment_id: "$last_" + direction + "_id",
                variant: "$last_" + direction + "_variant",
                relative_path: "$last_" + direction + "_relative_path",
                classifier: "$last_" + direction + "_classifier",
                name: "$last_" + direction + "_name"
              },
              diff_ratio_avg : { $sum : "$last_diff_ratio"},
            }
          }, {
            $sort: {
              diff_ratio_avg: -1
            }
          }
        ])  
      }

      return agg("last_source_id", "target")
        .then(function(docs1) {
          return agg("last_target_id", "source")
            .then(function(docs2) {
              var result = [];
              for (var i = 0; i < docs1.length; i++) {
                docs1[i]._id['diff_ratio_avg'] = docs1[i].diff_ratio_avg;
                result.push(docs1[i]._id);
              }
              for (var i = 0; i < docs2.length; i++) {
                docs2[i]._id['diff_ratio_avg'] = docs2[i].diff_ratio_avg;
                result.push(docs2[i]._id);
              }
              var compare = function(a,b) {
                if (a.diff_ratio_avg < b.diff_ratio_avg)
                   return 1;
                if (a.diff_ratio_avg > b.diff_ratio_avg)
                  return -1;
                return 0;
              }
              return result.sort(compare).filter(function(e) {return e.diff_ratio_avg >= threshold});
            });
        });
    })
}

similarityEvolutionSchema.statics.groupByFragment = function(repoName, sha, variant, relative_path, threshold) {
  var self = this;
  return Repo.findOneQ({name: repoName})
    .then(function(repo) {

      var agg = function(matcher_path, matcher_variant, id) {
        var match = {
          repo_path : repo.path,
          first_sha: sha,
          last_diff_ratio: {$exists : true},
          first_diff_ratio: {$gte: parseFloat(threshold)},
          last_diff_ratio: {$gte: parseFloat(threshold)}
        }
        match[matcher_path] = relative_path;
        match[matcher_variant] = variant;
        return SimilarityEvolution.aggregateQ([{
            $match : match
          }, {
            $group : {
              _id : id,
              count : { $sum : 1 },
              diff_ratio_avg : { $avg : "$first_diff_ratio"}
            }  
          }
        ])
      }

      return agg("first_target_relative_path", "first_target_variant", {
        _id: "$_id",
        classifier: "$first_target_classifier",
        name: "$first_target_name"
      }).then(function(docs1) {
          return agg("first_source_relative_path", "first_source_variant", {
            _id: "$_id",
            classifier: "$first_source_classifier",
            name: "$first_source_name"
          }).then(function(docs2) {
            return SimilarityEvolution.mergeAggs(docs1, docs2);
          })
      })
    })  
}

similarityEvolutionSchema.statics.sccs = {}


similarityEvolutionSchema.statics.getSCCs = function(repoName) {

  var to_dict = function(sccs) {
    var out = [];
    var count = 0;
    for (var i = 0; i < sccs.length; i++) {
      if (typeof(sccs[i][0]) == 'string') {
        out.push(sccs[i]);
      }
    }
    return out;
  }


  var d = Q.defer();
  if (similarityEvolutionSchema.statics.sccs[repoName]) {
    d.resolve(to_dict(similarityEvolutionSchema.statics.sccs[repoName]));
  }
  Repo.findOneQ({name: repoName})
  .then(function(repo){
    return SimilarityEvolution.findQ({repo_path: repo.path})
      .then(function(es) {
        var vertices = [];
        var edges = {};
        for (var i = 0; i < es.length; i++) {
          if (es[i].last_diff_ratio != 1) {
            continue;
          }
          var f1Id = es[i].last_source_id + '';
          var f2Id = es[i].last_target_id + '';
          if (vertices.indexOf(f1Id) == -1) {
            vertices.push(f1Id);
          }
          if (vertices.indexOf(f2Id) == -1) {
            vertices.push(f2Id);
          }
          if (!edges[f1Id]) {
            edges[f1Id] = [];
          }
          if (!edges[f2Id]) {
            edges[f2Id] = [];
          }
          if (edges[f1Id].indexOf(f2Id) == -1) {
            edges[f1Id].push(f2Id);
          }
          if (edges[f2Id].indexOf(f1Id) == -1) {
            edges[f2Id].push(f1Id);
          } 
        }
        var identified = [];
        var stack = [];
        var index = {};
        var boundaries = [];
        var sccs = [];

        var dfs = function(v) {
          index[v] = stack.length;
          stack.push(v);
          boundaries.push(index[v]);
          var result = [];
          var currentEdges = edges[v];
          for (var i = 0; i < currentEdges.length; i++) {
            var w = currentEdges[i];
            if (!index[w]) {
              result.push(dfs(w));
            } else if (!identified[w]){
                while (index[w] < boundaries[boundaries.length - 1]) {
                  boundaries.pop();
                }
            }
          }

          if (boundaries[boundaries.length - 1] == index[v]) {
            boundaries.pop();
            var scc = stack.slice(index[v]);
            stack.splice(index[v], stack.length);
            for (var i = 0; i < scc.length; i++) {
              if (identified.indexOf(scc[i]) == -1) {
                identified.push(scc[i]);
              }
            }
            sccs.push(scc)
          }

        }
        for (var i = 0; i < vertices.length; i++) {
            var v = vertices[i];
            if (!index[v]) {
              dfs(v);
            }
        }

        similarityEvolutionSchema.statics.sccs[repoName] = to_dict(sccs);
        d.resolve(similarityEvolutionSchema.statics.sccs[repoName]);

    })
  })
  return d.promise;
}


similarityEvolutionSchema.statics.get = function(id) {
  return SimilarityEvolution.findByIdQ(id);
}


var SimilarityEvolution = mongoose.model('SimilarityEvolution', similarityEvolutionSchema);

module.exports = SimilarityEvolution;
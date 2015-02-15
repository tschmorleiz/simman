var Repo = require('../models/repo');
var SimilarityEvolution = require('../models/similarityEvolution');
var Q = require('q');
var mongoose = require('mongoose-q')(require('mongoose'));


// schema for a similarity evolution
var Schema   = mongoose.Schema;
var annotationSchema = new Schema({
  repo_path               : {type: String},
  name                    : {type: String},
  intent                  : {type: String},
  annotated_value         : {type: Number},
  annotated_evolution_id  : {type: Schema.Types.ObjectId, ref: 'SimilarityEvolution'},
  propagate_to            : {type: String},
  rule_annotated          : {type: Boolean},
  class_annotated         : {type: Boolean},
  auto_updated            : {type: Boolean}
});

annotationSchema.statics.applicableRules = function(firstEdge, secondEdge) {
  var r1 = {
    first   : 'maintain-equality', 
    second  : 'maintain-equality', 
    closing : {
      evolution : {first: 'any', last: 'equal'},
      name   : 'maintain-equality'
    }
  }

  var r2 = {
    first   : 'maintain-equality',
    second  : 'restore-equality',
    closing : {
      evolution : {first: 'equal', last: 'unequal'},
      name   : 'restore-equality' 
    }
  }

  var rules = [r1, r2];

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i]

    if (firstEdge.name == rule.first || rule.first.not && firstEdge != rule.first.not) {
      if (!secondEdge || (secondEdge && secondEdge.name == rule.second)) {
        return [rule, false];
      }
      if (!secondEdge || (secondEdge && rule.second.not && secondEdge.name != rule.second.not)) {
        return [rule, false];
      }
    }

    if (firstEdge.name == rule.second || rule.second.not && firstEdge.name != rule.second.not) {
      if (!secondEdge || (secondEdge && secondEdge.name == rule.first)) {
        return [rule, true];
      }
      if (!secondEdge || (secondEdge && rule.first.not && secondEdge.name != rule.first.not)) {
        return [rule, true];
      }
    }
  }
}

annotationSchema.statics.closeTrianglesWithSeconds = function(first_evolution, first_annotation, second_evolutions) {
  var fas = [];
  for (var i = 0; i < second_evolutions.length; i++) {
    if (second_evolutions[i]._id + "" != first_evolution._id + "") {
      (function(i) {fas.push(function(){
        var second_evolution = second_evolutions[i];
        console.log(second_evolution._id)
        fas.push(
        Annotation.findOneQ({annotated_evolution_id: second_evolution._id})
          .then(function(second_annotation) {
            
            if (!second_annotation) {
              return null;
            }
            var rule = Annotation.applicableRules(first_annotation, second_annotation)
            if (!rule) {
              return null;
            }
            var f3s = []
            if (first_evolution.target_track_id == second_evolution.target_track_id) {
              f3s.push(
                SimilarityEvolution.findOneQ({source_track_id: first_evolution.source_track_id, target_track_id: second_evolution.source_track_id})
              );
              f3s.push(
                SimilarityEvolution.findOneQ({source_track_id: second_evolution.source_track_id, target_track_id: first_evolution.source_track_id})
              );
            }
            if (first_evolution.source_track_id == second_evolution.source_track_id) {
              f3s.push(
                SimilarityEvolution.findOneQ({source_track_id: first_evolution.target_track_id, target_track_id: second_evolution.target_track_id})
              );
              f3s.push(
                SimilarityEvolution.findOneQ({source_track_id: second_evolution.target_track_id, target_track_id: first_evolution.target_track_id})
              );
            }
            if (first_evolution.source_track_id == second_evolution.target_track_id) {
              f3s.push(
                SimilarityEvolution.findOneQ({source_track_id: first_evolution.target_track_id, target_track_id: second_evolution.source_track_id})
              );
              f3s.push(
                SimilarityEvolution.findOneQ({source_track_id: second_evolution.source_track_id, target_track_id: first_evolution.target_track_id})
              );
            }
            if (first_evolution.target_track_id == second_evolution.source_track_id) {
              f3s.push(
                SimilarityEvolution.findOneQ({source_track_id: first_evolution.source_track_id, target_track_id: second_evolution.target_track_id})
              );
              f3s.push(
                SimilarityEvolution.findOneQ({source_track_id: second_evolution.target_track_id, target_track_id: first_evolution.source_track_id})
              );
            }
            return Q.all(f3s)
              .then(function(third_evolutions) {
                if (!third_evolutions[0] && !third_evolutions[1]) {
                  return;
                }
                var third_evolution = third_evolutions[0] != null ? third_evolutions[0] : third_evolutions[1];
                return Annotation.findOneQ({annotated_evolution_id: third_evolution._id})
                  .then(function(third_annotation) {
                    if (third_annotation) {
                      return;
                    } else {
                      var flipped = rule[1];
                      rule = rule[0];
                      if ((rule.closing.evolution.first == 'any' || 
                        rule.closing.evolution.first == 'unequal' && third_evolution.first_diff_ratio != 1 ||
                        rule.closing.evolution.first == 'equal' && third_evolution.first_diff_ratio == 1) && 
                        (rule.closing.evolution.last == 'any' || 
                        rule.closing.evolution.last == 'unequal' && third_evolution.last_diff_ratio != 1 ||
                        rule.closing.evolution.last == 'equal' && third_evolution.last_diff_ratio == 1)
                      ) {
                        var name;
                        if (rule.closing.name.given) {
                          if ((rule.closing.name.given == 'first' && !flipped) ||
                            (rule.closing.name.given == 'second' && flipped)) {
                            name = first_annotation.name;
                          } else {
                            name = second_annotation.name;
                          }
                        } else {
                          name = rule.closing.name;
                        }
                        var third_annotation = new Annotation({
                          repo_path              : first_annotation.repo_path,
                          name                   : name,
                          intent                 : first_annotation.intent == second_annotation.intent ? first_annotation.intent : '',
                          annotated_evolution_id : third_evolution._id,
                          rule_annotated         : true,
                          auto_updated           : false
                        })
                        var flip_direction = function(direction) {
                          if (direction == 'source') {
                            return 'target';
                          }
                          if (direction == 'target') {
                            return 'source';
                          }
                          return direction;
                        }
                        console.log(first_annotation.name)
                        console.log(second_annotation.name)
                        if (first_annotation.name == 'maintain-equality') {
                          if (second_annotation.name == 'restore-equality') {
                            console.log("1...")
                            if (second_annotation.propagate_to) {
                              if (second_evolution.last_source_id + '' == third_evolution.last_source_id + ''){
                                third_annotation.propgate_to = second_annotation.propagate_to;
                              } else if (first_evolution.last_target_id + '' == third_evolution.last_target_id + '') {
                                third_annotation.propgate_to = second_annotation.propagate_to;
                              } else {
                                third_annotation.propgate_to = flip_direction(second_annotation.propagate_to);
                              }
                            }
                          }
                        }
                        if (first_annotation.name == 'restore-equality') {
                          if (second_annotation.name == 'maintain-equality') {
                            console.log("2...")
                            if (first_annotation.propagate_to) {
                              if (first_evolution.last_source_id + '' == third_evolution.last_source_id + ''){
                                third_annotation.propagate_to = first_annotation.propagate_to;
                              } else if (first_evolution.last_target_id + '' == third_evolution.last_target_id + '') {
                                third_annotation.propagate_to = first_annotation.propagate_to;
                              } else {
                                third_annotation.propagate_to = flip_direction(first_annotation.propagate_to);
                              }
                              console.log(third_annotation)
                            }
                          }
                        }
                        console.log(third_annotation)
                        return third_annotation.saveQ()
                          .then(function() {
                            return Annotation.closeTriangles(third_evolution._id + '');
                          })
                      } else {
                        return;
                      }
                    }
                  });
              });
          })
      )})})(i);
    }
  }
  return fas.reduce(Q.when, Q());
}


// close all triangles involved in a given edge
annotationSchema.statics.closeTriangles = function(first_evolution_id) {
  return Annotation.findOneQ({annotated_evolution_id: first_evolution_id})
    .then(function(first_annotation) {
      if (!first_annotation || !Annotation.applicableRules(first_annotation)) {
        return [];
      }
      return SimilarityEvolution.findOneQ({_id: first_evolution_id})
        .then(function(first_evolution) {
          var f1 = function() {return SimilarityEvolution.findQ({target_track_id: first_evolution.source_track_id})
            .then(function(second_evolutions) {
              console.log("A")
              // console.log(second_evolutions.length);
              return Annotation.closeTrianglesWithSeconds(first_evolution, first_annotation, second_evolutions);
            })};

          var f2 = function() {return SimilarityEvolution.findQ({source_track_id: first_evolution.target_track_id})
            .then(function(second_evolutions) {
              console.log("B")
              // console.log(second_evolutions.length);
              return Annotation.closeTrianglesWithSeconds(first_evolution, first_annotation, second_evolutions);
            })};

          var f3 = function() {return SimilarityEvolution.findQ({source_track_id: first_evolution.source_track_id})
            .then(function(second_evolutions) {
              console.log("C")
              // console.log(second_evolutions.length);
              return Annotation.closeTrianglesWithSeconds(first_evolution, first_annotation, second_evolutions);
            })};

          var f4 = function() {return SimilarityEvolution.findQ({target_track_id: first_evolution.target_track_id})
            .then(function(second_evolutions) {
              console.log("D")
              // console.log(second_evolutions.length);
              return Annotation.closeTrianglesWithSeconds(first_evolution, first_annotation, second_evolutions);
            })}  

          return f1()
            .then(function() {
              return f2()
                .then(function() {
                  return f3()
                    .then(function() {
                      return f4();
                    });
                })
              })

        });
    });
}

annotationSchema.statics.annotateSCC = function(data) {
  return SimilarityEvolution.getSCCs(data.repo_name)
    .then(function(sccs) {

      var lastFragmentIds = sccs[data.group_id];

      var evolutionPromises = [];
      for (var i = 0; i < lastFragmentIds.length; i++) {
        for (var j = i + 1; j < lastFragmentIds.length; j++) {
          evolutionPromises.push(SimilarityEvolution.findOneQ({
              last_source_id: mongoose.Types.ObjectId(lastFragmentIds[i]), 
              last_target_id: mongoose.Types.ObjectId(lastFragmentIds[j])}
          ));
          evolutionPromises.push(SimilarityEvolution.findOneQ({
              last_source_id: mongoose.Types.ObjectId(lastFragmentIds[j]), 
              last_target_id: mongoose.Types.ObjectId(lastFragmentIds[i])}
          ));
        }
      }
      return Q.all(evolutionPromises)
        .then(function(evolutions) {
          evolution_ids = evolutions.filter(function(e) {return (!!e)}).map(function(e) {return e._id});
          return Annotation.closeClass(evolution_ids, data.name, data.intent, data.repo_path);
        });
    })
  
}

annotationSchema.statics.closeClass = function(evolution_ids, name, intent, repoPath) {
  var promises = [];
  for (var i = 0; i < evolution_ids.length; i++) {
    (function(i) {
      var evolution_id = evolution_ids[i];
      promises.push(Annotation.findOneQ({annotated_evolution_id: evolution_id})
        .then(function(annotation) {
          if (!annotation) {
            var annotation = new Annotation({
              repo_path              : repoPath,
              name                   : name,
              intent                 : intent,
              annotated_evolution_id : evolution_id,
              class_annotated        : true,
              auto_updated           : false

            })
            return annotation.saveQ();
          }
        }));
    })(i);
  }
  return Q.all(promises)

}

annotationSchema.statics.saveAndClose = function(data) {
  var annotation = new Annotation(data);
  return annotation.saveQ()
    .then(function() {
      return Annotation.closeTriangles(data.annotated_evolution_id)
        .then(function() {
          return annotation;
        })
    });
}

annotationSchema.statics.updateAndClose = function(id, data) {
  return Annotation.updateQ({ _id: id }, { $set: data})
    .then(function(annotation) {
      return Annotation.closeTriangles(data.annotated_evolution_id)
        .then(function() {
          return annotation;
        });
    });
}

annotationSchema.statics.findByEvolutionId = function(evolution_id) {
  return Annotation.findOneQ({annotated_evolution_id: mongoose.Types.ObjectId(evolution_id)})
}

annotationSchema.statics.findByRepoName = function(repoName) {
  var self = this;
  return Repo.findOneQ({name: repoName})
  	.then(function(repo) {
  		return Annotation.findQ({repo_path: repo.path});
  	});
}

annotationSchema.statics.countForEvolutions = function(repoName, queries) {
  return Repo.findOneQ({name: repoName})
    .then(function(repo) {
      var agg = function(query) {
        query['repo_path'] = repo.path;
        return SimilarityEvolution.findQ(query)
          .then(function(evolutions) {
            var annotationPromises = [];
            for (var i = 0; i < evolutions.length; i++) {
              (function(i) {
                annotationPromises.push(
                  Annotation.findOneQ({annotated_evolution_id: evolutions[i]._id})
                    .then(function(annotation) {
                      return (!!annotation) ? 1 : 0
                    })
                );
              })(i);
            }
            return Q.all(annotationPromises)
              .then(function(counts) {
                counts.push(0)
                return counts.reduce(function(a,b) {return a + b});
              })
          });
      }

      var promises = [];
      for (var i = 0; i < queries.length; i++) {
        promises.push(agg(queries[i]));
      }
      return Q.all(promises)
        .then(function(counts) {
          counts.push(0)
          return counts.reduce(function(a,b) {return a + b});
        });
    });
}

annotationSchema.statics.countInVariant = function(repoName, variant) {
  var queries = [
    {'last_source_variant': variant},
    {'last_target_variant': variant}
  ];
  return Annotation.countForEvolutions(repoName, queries);
}

annotationSchema.statics.countInPath = function(repoName, variant, path) {
  var escaped = path.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  var queries = [
    {
      'last_source_variant': variant,
      'last_source_relative_path': {$regex: new RegExp('^' + escaped)}
    }, {
      'last_target_variant': variant,
      'last_target_relative_path': {$regex: new RegExp('^' + escaped)}
    }
  ]
  return Annotation.countForEvolutions(repoName, queries);
}

annotationSchema.statics.countInFragment = function(repoName, variant, path, classifier, name) {
  var queries = [
    {
      'last_source_variant': variant,
      'last_source_relative_path': path,
      'last_source_classifier': classifier,
      'last_source_name': name
    }, {
      'last_target_variant': variant,
      'last_target_relative_path': path,
      'last_target_classifier': classifier,
      'last_target_name': name
    }
  ]
  return Annotation.countForEvolutions(repoName, queries);
}
 
var Annotation = mongoose.model('Annotation', annotationSchema);
 
module.exports = Annotation;
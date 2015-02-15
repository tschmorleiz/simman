var Repo = require('../models/repo');
var Q = require('q');
var mongoose = require('mongoose-q')(require('mongoose'));


// schema for a similarity evolution
var Schema   = mongoose.Schema;
var graphDumpSchema = new Schema({
  vertices                : {type: Object},
  edges_dict              : {type: Object},
  
}, { collection: 'graphdump' } );
 
var GraphDump = mongoose.model('GraphDump', graphDumpSchema);
 
module.exports = GraphDump;
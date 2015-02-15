var express = require('express');
var http = require('http');
var mongoose = require('mongoose');
var site = require('./routes/site');
var repo = require('./routes/repo');
var fragment = require('./routes/fragment');
var similarity = require('./routes/similarityEvolution');
var variantgraph = require('./routes/variant-graph');
var annotation = require('./routes/annotation');
var tree = require('./routes/tree');

var app = express(); 
mongoose.connect('mongodb://localhost/anntest_pp3');
mongoose.connection.on('error', function(err) {
  console.log("Error: Count not connect to local MongoDB.");
  process.exit(1);
});

// configuration
app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.engine('html', require('ejs').renderFile);
  app.use(express.methodOverride());
  app.use(express.cookieParser(process.env.COOKIE_SECRET || 'Dancing bavarian cat'));
  app.use(express.session());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

// routes
// main
app.get('/', site.index);

// API
app.get('/api/repos', repo.index);
app.get('/api/repos/:name', repo.get);
app.patch('/api/repos/:name', repo.update);

app.get('/api/trees/:repo_name/:variant', tree.getByVariant);

app.get('/api/similarities/sccs/:repo_name', similarity.getSCCs);
app.get('/api/similarities/:id', similarity.get);
app.get('/api/similarities/tree/:repo_name', similarity.groupByCommit);
app.get('/api/similarities/tree/:repo_name/:sha', similarity.groupByVariant);
app.get('/api/similarities/tree/:repo_name/:sha/:variant', similarity.groupByPath);
app.get('/api/similarities/tree/:repo_name/:sha/:variant*', similarity.groupByFragment);

app.get('/api/similarities/compare/variant/:repo_name/:variant', similarity.compareVariant);
app.get('/api/similarities/compare/folder/:repo_name/:variant*', similarity.compareFolder);
app.get('/api/similarities/compare/file/:repo_name/:variant*', similarity.compareFile);
app.get('/api/similarities/compare/fragment/:repo_name/:id', similarity.compareFragment);

app.get('/api/variant_graph/:repo_name', variantgraph.get)

app.get('/api/fragments/list/:repo_name', fragment.indexAll);
app.get('/api/fragments/list/:repo_name/:sha', fragment.indexByCommit);
app.get('/api/fragments/list/:repo_name/:sha/:variant', fragment.indexByCommitAndVariant);
app.get('/api/fragments/:id', fragment.get);

app.post('/api/annotations/', annotation.post);
app.post('/api/annotations/sccs/annotate/', annotation.annotateSCC);
app.get('/api/annotations/closeTriangles/:evolution_id', annotation.closeTriangles);
app.put('/api/annotations/:id', annotation.put);
app.get('/api/annotations/', annotation.get);
app.get('/api/annotations/:repo_name', annotation.index);

app.get('/api/annotations/count/variant/:repo_name/:variant', annotation.countInVariant);
app.get('/api/annotations/count/folder/:repo_name/:variant*', annotation.countInPath);
app.get('/api/annotations/count/file/:repo_name/:variant*', annotation.countInPath);
app.get('/api/annotations/count/fragment/:repo_name/:variant*', annotation.countInFragment);

// start server
http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
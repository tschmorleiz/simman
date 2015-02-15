var Ann = Ann || {};
Ann.Views = Ann.Views || {};

Ann.Views.Variants = Backbone.View.extend({

	initialize: function(options) {
    _.bindAll(this, 'highlightSelection', 'highlightCommit');
    this.variations = this.model.getVariations();
		this.render();
		Ann.vent.on('tree:node-selected', this.highlightSelection);
	},

	render: function() {
		var self = this;
		
		new Ann.Views.HBView({
			el: $(this.el),
			templateId: 'variations-template'
		})
		this.sigmag = new sigma({
  			graph: this.variations,
  			container: 'graph',
  			settings: {
            	minEdgeSize: 0.5,
            	maxEdgeSize: 2,
            	minY: -1
          	}
		});
		this.sigmag.bind('overNode outNode', function(e) {
			if (e.data.node.kind !== 'commit')
				var hexsha = e.data.node.hexsha;
  			var node = (_.findWhere(self.variations.nodes, {kind: 'commit', hexsha: hexsha}))
  			var nodeIdx = self.variations.nodes.indexOf(node);
  			var edge = (_.findWhere(self.variations.edges, {hexsha: hexsha}))
  			var edgeIdx = self.variations.edges.indexOf(edge)
  			if (e.type == 'overNode') {
  				self.sigmag.graph.nodes()[nodeIdx].color = '#2577B5';
  				self.sigmag.graph.nodes()[nodeIdx].size = '0.5';
  				self.sigmag.graph.edges()[edgeIdx].color = '#2577B5';
  				self.sigmag.graph.edges()[edgeIdx].size = '1';
  				var message = _.findWhere(self.model.get('messages'), {hexsha: hexsha})
  				$(self.el).find('.message').text("> " + hexsha.slice(0,7) + ": " + message.message)
  			} else {
  				self.sigmag.graph.nodes()[nodeIdx].color = '#ccc';
  				self.sigmag.graph.nodes()[nodeIdx].size = '0.1';
  				self.sigmag.graph.edges()[edgeIdx].color = '#ddd';
  				self.sigmag.graph.edges()[edgeIdx].size = '0.1';
  				$(self.el).find('.message').text('')
  			}

  			self.sigmag.refresh();
		});
	},

	highlightCommit: function(hexsha) {
		console.log("highlightCommit");
    if (this.lastHighlightedCommit) {
      this.sigmag.graph.nodes()[this.lastHighlightedCommit.nodeIdx].color = '#ccc';
      this.sigmag.graph.nodes()[this.lastHighlightedCommit.nodeIdx].size = '0.1';
      this.sigmag.graph.edges()[this.lastHighlightedCommit.edgeIdx].color = '#ddd';
      this.sigmag.graph.edges()[this.lastHighlightedCommit.edgeIdx].size = '0.1';
    }
    var relevantHexsha = this.model.getNextVariationRelevantCommit(hexsha);
    var node = (_.findWhere(this.variations.nodes, {kind: 'commit', hexsha: relevantHexsha}))
    var nodeIdx = this.variations.nodes.indexOf(node);
    var edge = (_.findWhere(this.variations.edges, {hexsha: relevantHexsha}))
    var edgeIdx = this.variations.edges.indexOf(edge)
    this.sigmag.graph.nodes()[nodeIdx].color = '#2577B5';
    this.sigmag.graph.nodes()[nodeIdx].size = '0.5';
    this.sigmag.graph.edges()[edgeIdx].color = '#2577B5';
    this.sigmag.graph.edges()[edgeIdx].size = '1';
    this.sigmag.refresh();
    this.lastHighlightedCommit = {nodeIdx: nodeIdx, edgeIdx: edgeIdx};
	},

	highlightVariant: function(variation) {
		console.log("highlightVariant");

	},

	highlightSelection: function(level, parentIds, id) {
		var highlighters = [this.highlightCommit, this.highlightVariant, this.highlightVariant, this.highlightVariant];
		highlighters[level](id);
	}

})
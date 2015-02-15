var Ann = Ann || {};
Ann.Views = Ann.Views || {};

Ann.Views.CommitAnnotator = Backbone.View.extend({

	initialize: function(options) {
		this.render();
	},

	render: function() {
		var self = this;
		var template = Handlebars.compile($('#annotator-template').html());
		var html = template({});
		$(this.el).html(html)
		
		// start tree building
		$.get('/api/similarities/sccs/' + Ann.currentRepo.get('name'), function(sccs) {
			self.rendersimilarities(0.7, sccs);
			self.rendervariations();
			$('.threshold-slider').slider().on('slideStop', function() {
				self.rendersimilarities(parseFloat($('.threshold-slider').val()));
			});
		})

	},

	rendersimilarities: function(threshold, sccs) {
		
		new Ann.Views.Similarities({
			el: $('#similarities-tree'),
			url: '/api/similarities/tree/' + Ann.State.repo.get('name'),
			param: {"threshold": threshold},
			tree: [],
			path: [],
			sccs: sccs
		});
	},

	rendervariations: function() {
		var view = new Ann.Views.Variants({model: Ann.State.repo, el: $(this.el).find('.variations')});
	}

})
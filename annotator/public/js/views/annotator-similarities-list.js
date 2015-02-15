var Ann = Ann || {};
Ann.Views = Ann.Views || {};

Ann.Views.AnnotatorSimilaritiesList = Backbone.View.extend({

	initialize: function(options) {
		_.bindAll(this, 'render', 'addOne');
		this.collection = new Ann.Models.SimilaritiesGroup();
		this.ids = options.ids;
		this.sccs = options.sccs;
		for(var i = 0; i < this.ids.length; i++) {
			var s = new Ann.Models.Similarity();
			console.log(options.urlRoot + this.ids[i])
			s.fetch({url: options.urlRoot + this.ids[i],
				success: this.addOne
			});
			this.collection.add(s);
		}
	},

	addOne: function(entry) {
		var li = $('<li>');
		$(this.el).append(li);
		var view = new Ann.Views.AnnotatorSimilarity({
			model: entry,
			el: li,
			sccs: this.sccs,
		});
	},

	render: function() {
		$(this.el).html('');
		$('#sim-count').text('(' + this.collection.length + ')');
		this.collection.each(this.addOne);
		this.collection.each(this.addOne);
	}

})
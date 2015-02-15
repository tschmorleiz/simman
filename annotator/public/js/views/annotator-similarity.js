var Ann = Ann || {};
Ann.Views = Ann.Views || {};

Ann.Views.AnnotatorSimilarity = Backbone.View.extend({

	initialize: function(options) {
		this.sccs = options.sccs;
		this.render();
	},

	render: function(options) {
		var that = this;
		$("#annotator-controls").html('').show()
		var template = Handlebars.compile($('#full-similarity').html());
		var html = template(this.model.toJSON());
		$(this.el).html(html);

		// render similarity values
		$(this.el).find('.similarity-value').text(this.model.get('first_diff_ratio').toFixed(2));
		$(this.el).find('.last-similarity-value').text(this.model.get('last_diff_ratio').toFixed(2));

		// render fragments
		var sfView = new Ann.Views.Fragment({
			model: new Ann.Models.Fragment({id: this.model.get('first_source_id')}),
			el: $(this.el).find('.left-fragment')
		});

		var tfView = new Ann.Views.Fragment({
			model: new Ann.Models.Fragment({id: this.model.get('first_target_id')}),
			el: $(this.el).find('.right-fragment')
		});

		if (this.model.get('first_diff_ratio') != 1 || this.model.get('last_diff_ratio') != 1) {
			var sfView = new Ann.Views.Fragment({
				model: new Ann.Models.Fragment({id: this.model.get('last_source_id')}),
				el: $(this.el).find('.left-last-fragment')
			});
			var tfView = new Ann.Views.Fragment({
				model: new Ann.Models.Fragment({id: this.model.get('last_target_id')}),
				el: $(this.el).find('.right-last-fragment')
			});
		} else {
			$(this.el).find('.last-fragments').remove();
		}
		$(this.el).find("button").click(function() {
			that.annotate();
		})

	},

	annotate: function() {
		this.annotateView = new Ann.Views.AnnotatorControls({
			model : this.model,
			sccs  : this.sccs
		});
	}

})
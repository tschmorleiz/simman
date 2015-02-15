var Ann = Ann || {};
Ann.Views = Ann.Views || {};

Ann.Views.HBView = Backbone.View.extend({

	initialize: function(options) {
		this.templateId = options.templateId;
		this.render();
	},

	render: function() {
		this.model = this.model || new Backbone.Model()
		var template = Handlebars.compile($('#' + this.templateId).html());
		var html = template(this.model.toJSON());
		$(this.el).html(html)
	}

})
var Ann = Ann || {};
Ann.Views = Ann.Views || {};

Ann.Views.Home = Backbone.View.extend({

	initialize: function() {
		this.render();
	},

	render: function() {
		var template = Handlebars.compile($('#home-template').html());
		console.log(this)
		console.log(this.model.toJSON())
		var html = template(this.model.toJSON());
		$(this.el).html(html)
		$('#page-wrapper').css('margin-left', '0px')
		$('#navigation-sidebar').html('')
	}

})
var Ann = Ann || {};
Ann.Views = Ann.Views || {};

Ann.Views.Fragment = Backbone.View.extend({

	initialize: function(options) {
		_.bindAll(this, 'render');
		this.model.fetch({success: this.render});
	},

	render: function() {
		var template = Handlebars.compile($('#fragment-template').html());
		var html = template(this.model.toJSON());
		$(this.el).html(html)
		$(this.el).find('.fragment-editor').text(this.model.get('content'));
		var editor = ace.edit($(this.el).find('.fragment-editor')[0]);
		editor.setTheme("ace/theme/monokai");
		editor.getSession().setMode("ace/mode/haskell");
		editor.setFontSize(10);
	}

})
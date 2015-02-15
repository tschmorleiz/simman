var Ann = Ann || {};
Ann.Models = Ann.Models || {};

Ann.Models.CrossSimilarities = Backbone.Collection.extend({

	initialize: function(_, options) {
		this.level = options.level;
		this.variant = options.variant
		this.repoName = options.repoName;
	},

	url: function() {
		var url = '/api/similarities/compare/' + this.level.kind + '/' + this.repoName + '/';
		if (this.level.kind == 'variant') {
			url += this.level.name;
		}
		else if (this.level.kind == 'fragment') {
			url += this.level.id;
		} else {
			url += this.variant + '/' + this.level.path;
		}
		return url;
	}
})
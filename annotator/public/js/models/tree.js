var Ann = Ann || {};
Ann.Models = Ann.Models || {};


Ann.Models.Tree = Backbone.Model.extend({
	idAttribute: "_id",
	url: function() {
		return '/api/trees/' + this.get('repo_name') + '/' + this.get('variant');
	}
});

var Ann = Ann || {};
Ann.Models = Ann.Models || {};


Ann.Models.Annotation = Backbone.Model.extend({
	idAttribute: '_id',
	urlRoot: '/api/annotations/',

	directions: {
		'maintain-equality': [],
		'maintain-similarity': [],
		'restore-equality': [],
		'increase': [],
		'ignore': []
	},

	fetchEvolution: function(callback) {
		var similarty = new Ann.Models.Similarity({'id': this.get('annotated_evolution_id')});
		similarty.fetch({success: callback});
	}



}, {
	getByFragmentIds: function(idF1, idF2) {
		var annotation = new Ann.Models.Annotation();
		annotation.fetch({
			url: '/api/annotations/byFragmentIds/' + idF1 + '/'+ idF2
		});
	},
});

Ann.Models.Annotations = Backbone.Collection.extend({
  model: Ann.Models.Annotation
});

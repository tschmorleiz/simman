var Ann = Ann || {};

Ann.Router = Backbone.Router.extend({
	routes: {
		'': 'index',
		'repo/:name': 'repo',
		'repo/:name/:view': 'repo'
	},

	index: function() {
		var repos = new Ann.Models.Repos();
		repos.fetch({
			success: function() {
				new Ann.Views.Home({model: repos, el: $("#page-content")});		
			}
		})
		
	},

	repo: function(name, subViewName) {
		subViewName = subViewName || 'general';
		var repo = new Ann.Models.Repo({name: name});
		repo.fetch({
			success: function() {
				Ann.currentRepo = repo;
				new Ann.Views.HBView({model: repo, templateId: "repo-sidebar-template", el: "#navigation-sidebar"})
				new Ann.Views.Repo({model: repo, el: $("#page-content"), subViewName: subViewName});
			}
		});
	}
})
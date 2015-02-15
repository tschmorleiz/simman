var Ann = Ann || {};
Ann.Models = Ann.Models || {};

Ann.Models.Renaming = Backbone.Model.extend({
	defaults: {
		from: "",
		to: "",
		isSplit: false
	}
})

Ann.Models.Renamings = Backbone.Collection.extend({
  model: Ann.Models.Renaming
});
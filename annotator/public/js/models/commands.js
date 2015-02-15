var Ann = Ann || {};
Ann.Models = Ann.Models || {};

Ann.Models.Command = Backbone.Model.extend({
	defaults: {
		name: "",
		args: [],
	}
})

Ann.Models.Commands = Backbone.Collection.extend({
  model: Ann.Models.Command
});
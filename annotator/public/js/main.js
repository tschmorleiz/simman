$(function() {
	Ann.State = {};
	Ann.vent = _.extend({}, Backbone.Events);
    new Ann.Router();
    Backbone.history.start();
});
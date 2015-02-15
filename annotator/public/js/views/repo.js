var Ann = Ann || {};
Ann.Views = Ann.Views || {};

Ann.Views.Repo = Backbone.View.extend({

	initialize: function(options) {
		this.subViewName = options.subViewName;
		this.render();
	},

	render: function() {
		var template = Handlebars.compile($('#repo-template').html());
		var html = template(this.model.toJSON());
		$(this.el).html(html);
		$('#page-wrapper').css('margin-left', '250px');
		Ann.State.repo = this.model;
		this['render' + this.subViewName.replace('-', '')]();
	},

	rendergeneral: function() {
		new Ann.Views.HBView({
			model: this.model,
			el: $(this.el).find("#general"),
			templateId: 'general-template'
		});
	},

	renderstats: function() {
		var self = this;
		this.currentStartPos = -1;
		new Ann.Views.HBView({
			el: $(this.el).find("#stats"),
			templateId: 'stats-template'
		});
		var stats = this.model.getStats();
		stats["morrisSeriesOptions"]["element"] = "usage-series";
		stats["morrisSeriesOptions"].hoverCallback = function (idx, options, content) {
			startPos = stats['seriesInterval'] * idx;
			endPos = startPos + (stats['seriesInterval'] - 1);
			self.renderCommitsSeries(startPos, endPos);
			return content;
		}
		Morris.Area(stats["morrisSeriesOptions"]);
		stats["morrisDonutOptions"]["element"] = "usage-donut";
		Morris.Donut(stats["morrisDonutOptions"]);
	},

	renderCommitsSeries: function(startPos, endPos) {
		var self = this;
		if (endPos >= this.model.get('messages').length) {
			endPos = this.model.get('messages').length - 1;
		}
		if (startPos == this.currentStartPos) {
			return;
		}
		var messagesDiv = $(this.el).find('#usage-series-messages').html($('<ul>'));
		for(var idx = startPos; idx <= endPos; idx++) {
			var messageObject = this.model.get('messages')[idx];
			var message = messageObject.message.slice(0,80);
			if (messageObject.message.length > 120) {
				message += "...";
			} 
			var template = Handlebars.compile($('#stats-message-template').html());
			var commitStats = self.model.getCommitStats(idx);
			console.log(idx);
			var options = _.extend(commitStats, {
				message: message,
				hexsha: messageObject.hexsha.slice(0,7)
			})
			var html = template(options)
			messagesDiv.find('ul').append(html);

		}
		this.currentStartPos = startPos;
	},

	rendervariants: function() {
		var view = new Ann.Views.Variants({model: this.model, el: this.el});
	},

	rendervariantannotator: function() {
		var view = new Ann.Views.VariantAnnotator({model: this.model, el: $(this.el).find('#variant-annotator')});
	},

	rendersettings: function() {
		var self = this;
		new Ann.Views.HBView({
			model: this.model.get('settings'),
			el: $(this.el).find("#settings"),
			templateId: 'settings-template'
		});
		$(this.el).find('form').submit(function(e){
			e.preventDefault();
			self.model.save({settings: self.model.get('settings')}, {patch: true});
		})
	},

	rendercommitannotator: function() {
		new Ann.Views.CommitAnnotator({el: $(this.el).find('#commit-annotator')})
	},

	rendertodos: function() {
		new Ann.Views.Todos({el: $(this.el).find('#todos')})
	}


})
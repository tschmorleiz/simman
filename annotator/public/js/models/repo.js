var Ann = Ann || {};
Ann.Models = Ann.Models || {};

Ann.Models.Repo = Backbone.Model.extend({
	idAttribute: "name",
	urlRoot: "/api/repos",

	defaults: {
		settings: {}
	},

	parse: function(data) {
		return {
			actions: new Ann.Models.Commands(data.actions),
			renamings: new Ann.Models.Renamings(data.renamings),
			variations: data.variants,
			renamings: data.renamings,
			name: data.name,
			path: data.path,
			last_hexsha_checked: data.last_hexsha_checked,
			messages: data.messages,
			variationDirs: data.variationDirs,
			settings: new Backbone.Model(data.settings || this.defaults.settings)
		}
	},

	getCommitStats: function(commitPos) {
		var commandPos = this.commitPoss[commitPos];
		var idx = commandPos - 1;
		var result = this.commitData[commitPos - 1] || {
			create: 0,
			delete: 0,
			rename: 0,
			edit: 0
		};
		return result;

	},

	getStats: function() {
		var self = this;
		this.commitPoss = {};
		var totalCounts = {};
		var morrisSeriesData = [];
		var seriesInterval = this.get('actions').filter(function(c) {return c.get('name') === 'commit'}).length / 125 + 1;
		this.seriesInterval = seriesInterval;
		seriesInterval = Math.floor(seriesInterval)
		var ci = 0;
		var actions = ['create', 'delete', 'rename', 'edit', 'commit'];
		var operators;
		this.commitData = {};
		this.get('actions').each(function(command, i) {
			if (command.get('name') == 'commit') {
				if (Math.floor(ci/seriesInterval) != Math.floor((ci+1)/seriesInterval)) {
					var label = self.get('messages')[ci - seriesInterval + 1].hexsha.slice(0,7)
									+ "..."
									+ self.get('messages')[ci].hexsha.slice(0,7)								
					morrisSeriesData[Math.floor(ci/seriesInterval)].y = label
				}
				
				self.commitPoss[ci] = i;
				ci++;
			}
			if (ci == self.get('messages').length) {
				return;
			}
			if (!command.get('name')) {
				return;
			}
			var totalCount = totalCounts[command.get('name')]
			totalCounts[command.get('name')] = (totalCount || 0) + 1;
			var count = morrisSeriesData[Math.floor(ci/seriesInterval)];
			if (!count && ci > 0) {
				morrisSeriesData[Math.floor(ci/seriesInterval) - 1]['y'] += (ci - 1);
			}
			morrisSeriesData[Math.floor(ci/seriesInterval)] = count || {
				create : 0,
				delete : 0,
				rename : 0,
				edit : 0,
				commit : 0
			};
			var count = morrisSeriesData[Math.floor(ci/seriesInterval)][command.get('name')]
			morrisSeriesData[Math.floor(ci/seriesInterval)][command.get('name')] = (count || 0) + 1;

			var count = self.commitData[ci];
			self.commitData[ci] = count || {
				create : 0,
				delete : 0,
				rename : 0,
				edit : 0,
				commit : 0
			};
			var count = self.commitData[ci][command.get('name')]
			self.commitData[ci][command.get('name')] = (count || 0) + 1;

		});
		var morrisSeriesOptions = {
			lineColors : ["#4DA74D", "#BF3030", "#7A92A3", "#EDC240", "#2577B5"],
			pointSize: 2,
			data: morrisSeriesData,
			xkey: "y",
			parseTime: false,
			ykeys: actions,
			labels: actions
		}
		var morrisDonutData = [];
		_.each(actions, function(action) {
			if (action) {
				morrisDonutData.push({label: action, value: totalCounts[action]});
			}
		});
		var morrisDonutOptions = {
			colors : morrisSeriesOptions.lineColors,
			data : morrisDonutData
		}
		return {
			seriesInterval: seriesInterval,
			morrisSeriesOptions: morrisSeriesOptions, 
			morrisDonutOptions: morrisDonutOptions
		}
	},

	getNextVariationRelevantCommit: function(hexsha) {
		var messages = this.get('messages');
		var commit = _.findWhere(messages, {hexsha: hexsha});
		var startIdx = messages.indexOf(commit);
		for (var i = startIdx; i < messages.length; i++) {
			if (this.relevantHexshas.indexOf(messages[i].hexsha) != -1) {
				return messages[i].hexsha;
			}
		}
	},

	getVariations: function() {
		var variations = this.get('variations');
		var messages = this.get('messages');
		var renamings = this.get('renamings');
		var relevantHexshas = [];
		_.each(messages, function(messageObject, idx) {
			var hexsha = messageObject.hexsha;
			var currentVariations = variations[hexsha];
			currentVariations.sort();
			if (idx == 0 || idx == (messages.length - 1)) {
				relevantHexshas.push(hexsha);
			}
			else if (!_.isEqual(currentVariations, lastVariations)) {
				relevantHexshas.push(hexsha);	
			}
			else if (!!renamings[hexsha]) {
				relevantHexshas.push(hexsha);	
			}
			lastVariations = currentVariations;
		});
		this.relevantHexshas = relevantHexshas;
		var total = _.flatten(variations);
		total = _.unique(total);
		total = _.sortBy(total, function(variation) {
			var index =  _.find(relevantHexshas, function(hexsha) {
				if (variations[hexsha].indexOf(variation) != -1) {
					return hexsha;
				}
			})
			return relevantHexshas.indexOf(index);
		})
		var nodes = []
		var edges = []
		nodes.push({id: '.1', x:0, y:-1, label: '', size: 1, color: '#fff'});
		lineOf = {}
		var lastVariations = [];
		var max = total.length;
		var lastHexsha;
		var lastHexshas = {}
		_.each(relevantHexshas, function(hexsha, idx) {
			nodes.push({
				id: hexsha + "up",
				label: hexsha.slice(0,7),
				x: idx,
				y: -1,
				size: 0.1,
				color: '#ccc',
				kind: 'commit',
				hexsha: hexsha
			})
			nodes.push({
				id: hexsha + "down",
				x: idx,
				y: max + 1,
				size: 0.1,
				color: '#fff'
			})
			edges.push({
				id: hexsha,
				source: hexsha + "up",
				target: hexsha + "down",
				size: 0.1,
				color: '#ddd',
				hexsha: hexsha

			})
			var shortHexsha = hexsha.slice(0,7);
			var currentVariations = variations[hexsha];
			var currentRenamings = renamings[hexsha];

			// handle renamed variations
			var targets = [];
			var lastIndexUsed;
			_.each(currentRenamings, function(renaming) {
				if (targets.indexOf(renaming["to"]) != -1) {
					return;
				}
				if (targets.indexOf(renaming["to"]) != -1)
					return

				var oldIndex = total.indexOf(renaming["from"])
				if (total.indexOf(renaming["from"]) == -1)
					return

				targets.push(renaming["to"]);
				nodes.push({
				    id: renaming['to'] + "@" + hexsha,
				    label: "Rename: " + renaming["from"] + "->" + renaming["to"],
				    x: idx,
				    y: total.indexOf(renaming['from']),
				    size: 0.3,
				    hexsha: hexsha,
				    color: '#7A92A3'
			  	});
			  	lastIndexUsed = total.indexOf(renaming['from']);
			  	edges.push({
			  		id: renaming["to"] + "@" + hexsha + "r",
			  		source: renaming["from"] + "@" + lastHexshas[renaming["from"]],
			  		target: renaming['to'] + "@" + hexsha,
			  		color: '#222',
			  		type: "arrow",
			  		arrow: "source",
			  		size: 1
			  	})
			  	if (!renaming["isSplit"]) {
			  		total[total.indexOf(renaming["to"])] = "";
					total[oldIndex] = renaming["to"];
			  	}
			  	lastHexshas[renaming["to"]] = hexsha;
				
			})

			var newVariations = _.difference(currentVariations, lastVariations);
			_.each(newVariations, function(newVariation) {
				if (_.findWhere(currentRenamings, {to: newVariation})) {
					return;
				}
				if (total.indexOf(newVariation) == -1) {
					total.push(newVariation)
				}
				if (total.indexOf(newVariation) == -1) {
					return;
				}
				nodes.push({
				    id: newVariation + "@" + hexsha,
				    label: "Create: " + newVariation,
				    x: idx,
				    y: total.indexOf(newVariation),
				    size: 0.3,
				    hexsha: hexsha,
				    color: '#4DA74D'
			  	});
			  	lastIndexUsed = total.indexOf(newVariation);
			  	lastHexshas[newVariation] = hexsha;
			  	
			})
			var goneVariations = _.difference(lastVariations, currentVariations);
			_.each(goneVariations, function(goneVariation) {
				if (_.findWhere(currentRenamings, {from: goneVariation})) {
					return;
				}
				if (!lastHexshas[goneVariation]) {
					return;
				}
				
				nodes.push({
				    id: goneVariation + "@" + hexsha,
				    label: "Delete: " + goneVariation,
				    x: idx,
				    y: total.indexOf(goneVariation),
				    size: 0.3,
				    hexsha: hexsha,
				    color: '#BF3030'
			  	});
			  	lastIndexUsed = total.indexOf(goneVariation);
			  	edges.push({
			  		id: goneVariation + "@" + lastHexshas[goneVariation] + "d",
			  		source: goneVariation + "@" + lastHexshas[goneVariation],
			  		target: goneVariation + "@" + hexsha,
			  		color: '#222',
			  		type: "arrow",
			  		arrow: "source",
			  		size: 1
			  	})

			})
			lastVariations = currentVariations;
			lastHexsha = hexsha;
		})
		_.each(variations[lastHexsha], function(lastVariation) {
			if (!lastHexshas[lastVariation]) {
				return;
			}
			nodes.push({
				id: lastVariation + "@" + lastHexsha,
				label: lastVariation,
				x: relevantHexshas.length - 1,
				y: total.indexOf(lastVariation),
				size: 0.3,
				hexsha: lastHexsha,
				color: '#000'
			 });
			edges.push({
			  		id: lastVariation + "@" + lastHexshas[lastVariation] + "l",
			  		source: lastVariation + "@" + lastHexshas[lastVariation],
			  		target: lastVariation + "@" + lastHexsha,
			  		color: '#222',
			  		type: "arrow",
			  		arrow: "target",
			  		size: 1
			  	})
		})
		// compress
		ysUsed = _.sortBy(_.unique(nodes.map(function(n) {return n.y})));
		_.each(ysUsed, function(y, idx) {
			_.map(_.where(nodes, {y : y}), function(node) {
				node.y = idx;
			})
		})
		nodes.push({id: '.2', x:relevantHexshas.length + 10, y: ysUsed.length, label: '', size: 0.1, color: '#fff'});
		return {nodes: nodes, edges: edges};
		//return [[maxVariationsSha, 	maxVariationsNum]]
	}
})

Ann.Models.Repos = Backbone.Collection.extend({
  model: Ann.Models.Repo,
  url: "/api/repos"
});
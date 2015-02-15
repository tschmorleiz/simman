var Ann = Ann || {};
Ann.Views = Ann.Views || {};

Ann.Views.VariantAnnotator = Backbone.View.extend({

	el: '#variant-similarities',

	initialize: function(options) {
		Ann.variantTreeView = this;
		_.bindAll(this, 'showOthers', 'renderOthers');
		var self = this;
		$.getJSON('/api/variant_graph/' + this.model.get('name'), function(data) {
			$.get('/api/similarities/sccs/' + Ann.currentRepo.get('name'), function(sccs) {
				self.sccs = sccs;
				self.graph = data;
				self.render();
			});
		});
		this.annotatorOpen = false;
		this.levelNames = ["variant", "folder", "file", "fragment"];
		this.rankingCache = {};
	},


	render: function() {
		var self = this;
		this.model = this.model || new Backbone.Model();
		var template = Handlebars.compile($('#variant-similarities-template').html());
		var html = template(this.model.toJSON());
		$(this.el).html(html);
		$('#annotations').hide();


		var width = 960,
    		height = 500

		var svg = d3.select("#variant-similarities-container").append("svg")
		    .attr("width", width)
		    .attr("height", height);

		this.svg = svg;

		var force = d3.layout.force()
		    .gravity(.05)
		    .distance(200)
		    .charge(-200)
		    .size([width, height]);

		d3.json('/api/variant_graph/' + this.model.get('name'), function(error, json) {

			force
			    .nodes(json.nodes)
			    .links(json.links)
			    .linkStrength(function(l) {return l.value / 4})
			    .linkDistance(function(l) {return 150 * (1 - l.value)})
			    .start();

			var max = 0;
			for (var i = 0; i < json.links.length; i++) {
				if (json.links[i].value > max) {
					max = json.links[i].value;
				}
			}

			var link = svg.selectAll(".link")
				.data(json.links)
			    	.enter().append("line")
			      		.attr("class", "link");

			self.renderLinks(link, 0, max)

			self.topThreshold = 0;
			$(self.el).find('.threshold-slider')
				.slider({max : max})
				.on('slide', function(ev) {
					self.topThreshold = ev.value;
					self.renderLinks(link, ev.value, max)
				});

			var node = svg.selectAll(".node")
				.data(json.nodes)
			    	.enter().append("g")
			      		.attr("class", "node")
			      		.call(force.drag);

			node.append("image")
				.attr("xlink:href", "https://github.com/favicon.ico")
			    .attr("x", -8)
			    .attr("y", -8)
			    .attr("width", 16)
			    .attr("height", 16)
			    .on("click", function(node) {
			    	self.showVariant(node.name, node.index);
			    });

			node.append("text")
				.attr("dx", 12)
			    .attr("dy", ".35em")
			    .text(function(d) { return d.name });

			force.on("tick", function() {
				link.attr("x1", function(d) { return d.source.x; })
			    	.attr("y1", function(d) { return d.source.y; })
			        .attr("x2", function(d) { return d.target.x; })
			        .attr("y2", function(d) { return d.target.y; });

		    node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
		  });
		});

	},

	renderLinks: function(link, value, max) {
		link
			.style("stroke-width", function(l) {return l.value < value ? 0 : (l.value)*10})
			.style("stroke", function(l) {
			 	var x = Math.floor(255 * (l.value-value)/(max-value))
			 	var a = (l.value-value)/(max-value);
			 	a = 1 - ((1-a)*(1-a));
			    return 'rgba(' + (0) + ',' + (255 - x) + ', ' + (x) + ', ' + a  + ')';
			});
	},

	levelCounts: {},

	getLevelCount: function(variant, level, force, cb) {
		var self = this;
		var url = '/api/annotations/count/' + level.kind + '/' + Ann.currentRepo.get('name') + '/' + variant;
		if (level.kind != 'variant') {
			url += '/' + level.path;
		}
		if (this.levelCounts[url] && !force) {
			cb(this.levelCounts[url]);
		} else {
			$.get(url, function(count) {
				self.levelCounts[url] = count;
				cb(count);
			});
 		}
	},

	openLevels: {},

	showLevel: function(variant, level) {
		var self = this;
		if(this.openLevels[level.path] && level.kind != 'variant') {
			delete this.openLevels[level.path];
		} else {
			this.openLevels[level.path] = level;
		}
		window.ol = this.openLevels;
		$('#variant-tree .tree label').css('background-color', 'white');
		var $treeEl = $('#variant-tree .tree [data-path="' + level.path + '"]');
		$treeEl.css('background-color', '#ccc');
		$('#variant-tree .ranking-header').text('Level: ' + level.kind);
		if (level.kind != 'fragment') {
			$treeEl.parent().children('ul').toggle(300);
			$('#annotations').hide();
		}
		this.showOthers(level)
	},

	showLevelCount: function(variant, level, force) {
		this.getLevelCount(variant, level, force, function(count) {
			var path = level.path;
			if (level.kind == 'variant') {
				path = '.';
			} 
			var $treeEl = $('#variant-tree .tree [data-path="' + level.path + '"]');
			$treeEl.find('.ann-count').text(count);
		});
	},

	updateLevelCounts: function() {
		for (p in this.openLevels) {
			if (this.openLevels.hasOwnProperty(p)) {
				this.showLevelCount(this.currentVariant, this.openLevels[p], true);
			}
		}
	},


	initializeAnnotationControls: function(id) {
		var self = this;
		$('#annotations-selection').html('');
		var similarity = new Ann.Models.Similarity({id: id})
		similarity.fetch({
			success: function() {
				$('#annotations').show();
				self.annotatorSimilarity = new Ann.Views.AnnotatorSimilarity({
					model: similarity,
					el: $('#annotations-selection'),
					sccs: self.sccs
				});
			}
		})
	},

	renderOthers: function(crossSimilarities) {
		var self = this;
		var cached = localStorage.getItem(this.model.get('last_hexsha_checked') + crossSimilarities.url());
		if (!cached) {
			localStorage.setItem(this.model.get('last_hexsha_checked') + crossSimilarities.url(), JSON.stringify(crossSimilarities.toJSON()));			
		}
		if (crossSimilarities.level != this.currentLevel) {
			return;
		}
		var $ul = $('<ul>');
		crossSimilarities.each(function(similarity){
			var kind = crossSimilarities.level.kind;
			var nameHtml = $('<span>');
			if (kind == 'variant') {
				nameHtml.append($('<span>').text(similarity.get('_id')).addClass('main-name'));
			} else if (kind == 'folder') {
				nameHtml.append($('<span>').text(similarity.get('dir')).addClass('main-name')
					.append($('<span>').addClass('location').text(' (in ' + similarity.get('variant') + ')')));
			} else if (kind == 'file') {
				nameHtml.append($('<span>').text(similarity.get('file')).addClass('main-name')
					.append($('<span>').addClass('location').text(' (in ' + similarity.get('variant') + ')')));
			} else if (kind == 'fragment') {
				nameHtml.append($('<span>').text(similarity.get('classifier') + '/' + similarity.get('name')).addClass('main-name')
					.append($('<span>').addClass('location').text(' (in ' + similarity.get('relative_path') + ' in ' + similarity.get('variant') + ')')));
			}
			nameHtml.append($('<span>').addClass('similarity-value').text((similarity.get('diff_ratio_avg') * 100).toFixed(2) + "% similar"))
			var $li = $('<li>').addClass('nav nav-list tree')
				.append(
					$('<label>')
						.click(function() {
							if (kind == 'fragment') {
								self.initializeAnnotationControls(similarity.get('id'));
							}
						})
						.addClass('tree-toggler nav-header')
						.addClass(kind)
						.html(nameHtml)
				);
			$ul.append($li);
		});
		$('#other-ranking .tree').html($ul);
	},

	showOthers: function(level) {
		if (level.kind == 'variant') {
			this.currentVariant = level.name;
		}
		this.currentLevel = level;
		var crossSimilarities = new Ann.Models.CrossSimilarities([], {level: level, variant: this.currentVariant, repoName: this.model.get('name')});
		$('#other-ranking .tree').html($('<i>').text('Loading...'));
		var cached = localStorage.getItem(this.model.get('last_hexsha_checked') + crossSimilarities.url());
		if (cached) {
			cached = JSON.parse(cached);
			for (var i = 0; i < cached.length; i++) {
				crossSimilarities.add(cached[i]);
			}
			this.renderOthers(crossSimilarities);
		} else {
			crossSimilarities.fetch({
				success: this.renderOthers
			});
		}
	},

	annotate: function(idF1, idF2) {
		Ann.Models.Annotation.getByFragmentIds(idF1, idF2);
	},

	showVariantTree: function(variant, tree) {
		var self = this;
		var showTreeLevel = function(level, el) {
			var list = $(el);
			for (var i = 0; i < level.length; i++) {
				(function(i){
					var subLevel = level[i];
					var kind = subLevel.kind;
					var name = subLevel.name;
					var count = subLevel.evolution_count;
					var countText = '<span class="ann-count">... </span>/' + count + ' annotated';
					var path = subLevel.path;
					var children = subLevel.children;
					var li = $('<li>').addClass('nav nav-list tree')
						.append(
							$('<label>')
								.addClass('tree-toggler nav-header')
								.addClass(kind)
								.attr('data-path', path)
								.append($('<span>').addClass('name').text(name))
								.append($('<span>')
									.addClass('similarity-count')
									.html(countText))
								.click(function() {
									self.showLevel(variant, subLevel);
									if (children) {
										for (var i = 0; i < children.length; i++) {
											(function(i){
												self.showLevelCount(variant, children[i], false);
											})(i);
										}
									}
								})
						)
					var ul = $('<ul>')
					$(li).append(ul);
					if (children) {
						showTreeLevel(children, ul);	
					}
					$(list).append(li);
				})(i)
			}
		}

		var $rootEl = $('#variant-tree .tree');
		var $ul = $('<ul>');
		showTreeLevel([tree.get('tree')], $ul);
		$rootEl.append($ul);
		$rootEl.find('ul ul label').parent().children('ul').toggle(300);
		this.showLevel(variant, tree.get('tree'));
		self.showLevelCount(variant, tree.get('tree'), false);
	},

	showVariant: function(name, index) {
		$('#variant-similarities-controls').show()
			.css('height', '450px')
			.find('.tree').html('');
		$('#variant-similarities-controls .col-lg-12').css('height', '450px');
		$('#variant-tree').css('height', '450px').css('overflow', 'auto');
		$('#other-ranking').css('height', '450px').css('overflow', 'auto');
		var self = this;
		this.openLevels = {};
		this.currentLevel = 0;
		this.currentVariant = name;
		
		var others = [];
		var outgoing = _.where(this.graph.links, {source: index});
		var incoming = _.where(this.graph.links, {target: index});
		var all = outgoing.concat(incoming);
		all = all.filter(function(l) {return l.value >= self.topThreshold});
		all = _.sortBy(all, function(x) {return x.value});
		for(var i = 0; i < all.length; i++) {
			var otherIndex = all[i].target == index ? all[i].source : all[i].target;
			var otherName = this.graph.nodes[otherIndex].name;
			var diffRatio = all[i].value;
			others.push({
				otherIndex: otherIndex,
				otherName: otherName,
				diffRatio: diffRatio
			});
		}
		$(this.el).find('.ranking-header').show();
		this.tree = new Ann.Models.Tree({repo_name: this.model.get('name'), variant: name});
		this.tree.fetch({
			success: function(tree) {
				self.showVariantTree(name, tree);
			}
		});
	}

})
var Ann = Ann || {};
Ann.Views = Ann.Views || {};

Ann.Views.Similarities = Backbone.View.extend({

	initialize: function(options) {
		_.bindAll(this, 'render');
		this.collection = new Ann.Models.SimilaritiesGroup();
		this.url = options.url;
		this.param = options.param;
		this.callback = options.callback;
		this.collection.fetch({data: $.param(this.param), url: this.url, success: this.render})
		this.tree = options.tree;
		this.path = options.path;
		this.parentTreeIds = options.parentTreeIds || [];
		this.parentIds = options.parentIds || [];
		this.sccs = options.sccs;
		this.lookup = {};
	},

	populate: function(id) {
		var childPath = this.path.slice(0);
		childPath.push(id);
		console.log($(this.el).find('[data-id="' + id +'"]'))
		new Ann.Views.Similarities({
			el: $('#similarities-tree'),
			url: this.url + '/' + id,
			tree: this.tree,
			param: {},
			path: childPath,
			el: $(this.el).find('[data-id="' + id +'"]'),
			sccs: this.sccs,
		});
		this.populated[id] = true;
	},

	initializeAnnotationControls: function(id) {
		console.log(this.lookup)
		if (this.path.length == 3) {
			id = id._id;
		} 
		var url = '/api/similarities/' + id;
		new Ann.Views.AnnotatorSimilaritiesList({
			ids: this.lookup[id].get('ids'),
			urlRoot: '/api/similarities/',
			el: $('#annotation-selection-list'),
			sccs: this.sccs
		})
	},

	addChild: function(id, count, entry) {
		var self = this;
		this.lookup[entryId] = entry;
		if (this.path.length == 3) {
			var text = id.classifier + '/' + id.name;
			var entryId = id._id;
		} else {
			var text = id;
			var entryId = id;
		}
		if (this.path.length == 0) {
			count *= 2;
		} 
		if (this.path.length == 0 && text.length > 15) {
			text = text.slice(0,7);
		}
		$(this.el).find('ul')
			.append(
				$('<li>').addClass('nav nav-list tree')
					.append(
						$('<label>')
							.addClass('tree-toggler nav-header')
							.text(text)
							.click(function() {
								if (self.path.length < 3) {
									if (!self.populated[entryId]) {
										self.populate(entryId);	
									} else {
										$(this).parent().children('ul').toggle(300);
									}
								} else {
									self.initializeAnnotationControls(entryId);
								}	
							})
							.append($('<span>').addClass('similarity-value').text(count))
					)
					.attr('data-id', entryId)
			);
	},

	render: function() {
		var self = this;
		this.populated = {};
		if (this.path.length == 0) {
			$('#similarities-count').text('in ' + this.collection.length + ' commits.')
		}
		var list = $('<ul>')
		if (this.path.length != 0) {
			list.hide();
		}
		$(this.el).append(list);
		this.collection.each(function(entry,idx) {
			self.addChild(entry.get('_id'), entry.get('count'), entry);
			self.populated[entry.get('_id')] = false;
			this.idx
		});
		if (this.path.length != 0) {
			list.toggle(300);
		}
	}

})
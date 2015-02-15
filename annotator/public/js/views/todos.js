var Ann = Ann || {};
Ann.Views = Ann.Views || {};

Ann.Views.Todos = Backbone.View.extend({

	initialize: function(options) {
		_.bindAll(this, 'addOne', 'addAll');
		this.render();
	},

	render: function() {
		var self = this;
		var template = Handlebars.compile($('#todo-list-template').html());
		var html = template({});
		$(this.el).html(html);
		this.model = new Ann.Models.Annotations([]);
		this.model.url = "/api/annotations/101haskell"
		this.model.fetch({
			success: self.addAll
		})
	},

	addOne: function(todo) {
		var self = this;
		if (todo.get('name') == 'increase-similarity' 
			|| todo.get('name') == 'restore-equality'
			|| todo.get('name') == 'establish-equality'
			|| todo.get('name') == 'restore-similarity'
			|| todo.get('auto') === false) {
			todo.fetchEvolution(function(evolution) {
				var todoView = new Ann.Views.Todo({model: todo, evolution: evolution});
				$(self.el).find('tbody').append(todoView.$el);
				todoView.render();
			});
		}
	},

	addAll: function() {
		this.model.each(this.addOne);
	}

});

Ann.Views.Todo = Backbone.View.extend({

	el: '<tr>',

	initialize: function(options) {
		this.evolution = options.evolution;
		_.bindAll(this, 'save', 'showFragments');
	},

	render: function() {
		var renderObject = this.model.toJSON();
		var annotationsText = this.model.get('name').split('-').join(' ');
		annotationsText = annotationsText[0].toUpperCase() + annotationsText.slice(1);
		renderObject.nameText = annotationsText;
		renderObject.first_diff_ratio = this.evolution.get('first_diff_ratio')
		if (renderObject.first_diff_ratio < 1) {
			renderObject.first_diff_ratio =  renderObject.first_diff_ratio.toFixed(2);
		}
		renderObject.last_diff_ratio = this.evolution.get('last_diff_ratio')
		if (renderObject.last_diff_ratio < 1) {
			renderObject.last_diff_ratio = renderObject.last_diff_ratio.toFixed(2);
		}
		renderObject.path_f1_variant = this.evolution.get('last_source_variant')
		renderObject.path_f1_path = this.evolution.get('last_source_relative_path');
		renderObject.path_f1_classifier = this.evolution.get('last_source_classifier');
		renderObject.path_f1_name = this.evolution.get('last_source_name');
		renderObject.path_f2_variant = this.evolution.get('last_target_variant')
		renderObject.path_f2_path = this.evolution.get('last_target_relative_path');
		renderObject.path_f2_classifier = this.evolution.get('last_target_classifier');
		renderObject.path_f2_name = this.evolution.get('last_target_name');
		var template = Handlebars.compile($('#todo-item-template').html());
		var html = template(renderObject);
		this.$el.html(html);


		var applicableAnnotations = this.evolution.getApplicableAnnotations();
		for (var annotationName in applicableAnnotations) {
			var el = this.$el.find('.annotation-name option[value="' + annotationName + '"]')
			var text = $(el).text()
			$(el)
				.prop('disabled', false)
				.text(text)
		}
		this.$el.find('.annotation-name')
			.val(this.model.get('name'))
			.change(this.save);
		this.$el.find('[contenteditable="true"]').on('blur', this.save);
		this.$el.find('.expand').click(this.showFragments);
		this.renderAuto();
	},

	renderAuto: function() {
		var auto = (this.model.get('name').split('-').length === 2
			&& this.model.get('name').split('-')[1] === 'equality' 
			&& this.model.get('name').split('-')[0] !== 'establish'
			&& this.model.get('auto') !== false) || this.model.get('name') === 'ignore';		
		this.$el.removeClass('success warning');
		this.$el.addClass(auto ? 'success' : 'warning');
		var autoText = auto ? 'Auto' : 'Manual';
		if (this.model.get('auto') === false) {
			autoText += ' (auto failed)';
		}
		this.$el.find('.auto-text').text(autoText);
		this.$el.find('.rule-annotated-text').text(this.model.get('rule_annotated') ? 'Yes' : 'No');
		this.$el.find('.class-annotated-text').text(this.model.get('class_annotated') ? 'Yes' : 'No');
	},

	showFragments: function() {
		var self = this;
		if (this.$el.find('.modal').length == 0) {
			var template = Handlebars.compile($('#fragments-modal-template').html());
			var html = template({});
			this.$el.append(html);
			var sfView = new Ann.Views.Fragment({
				model: new Ann.Models.Fragment({id: this.evolution.get('last_source_id')}),
				el: $(this.el).find('.left-fragment')
			});
			var tfView = new Ann.Views.Fragment({
				model: new Ann.Models.Fragment({id: this.evolution.get('last_target_id')}),
				el: $(this.el).find('.right-fragment')
			});
			

		}
		this.$el.find('.modal').modal('show');	
	},

	save: function() {
		var oldName = this.model.get('name');
		var intent =  this.$el.find('.intent').text();
		var name = this.$el.find('.annotation-name').val().toLowerCase();
		var nameChanged = oldName == name;
		var data = {
			'name'   : name,
			'intent' : intent,
			'auto_updated': false,
			'annotated_value': this.evolution.get('last_diff_ratio')
		}
		if (nameChanged) {
			data['rule_annotated'] = false;
			data['class_annotated'] = false;
		}
		this.model.save()
		this.renderAuto();
	}


});
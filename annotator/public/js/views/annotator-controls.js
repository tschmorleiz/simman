var Ann = Ann || {};
Ann.Views = Ann.Views || {};

Ann.Views.AnnotatorControls = Backbone.View.extend({

	el: '#annotator-controls',

	events: {
		'click #annotate-save': 'save',
		'click #annotate-scc' : 'saveSCC'
	},

	initialize: function(options) {
		_.bindAll(this, 'render');
		this.annotation = new Ann.Models.Annotation({'annotated_evolution_id': this.model.get('_id')});
		this.sccs = options.sccs;
		this.annotation.fetch({
			data: $.param({'annotated_evolution_id': this.model.get('_id')}),
			success: this.render,
			error: this.render
		});
	},

	annotationHints: {
		'maintain-equality': '<u>Automatically<u/> maintain equality by three-way-merge.',
		'maintain-similarity': '<u>Manually</u> maintain similarity.',
		'restore-equality': 'Restore former equality.',
		'establish-equality': 'Establish never-exiting equality',
		'restore-similarity': 'Restore a certain similarity value',
		'increase-similarity': '<u>Manually</u> increase similarity.',
		'ignore': '<u>Automatically</u> ignore similarity (for now).'
	},

	render: function() {
		var self = this;
		Ann.currentAnnotationView = this;
		var template = Handlebars.compile($('#annotator-controls-template').html());
		var html = template(this.model.toJSON());
		var applicableAnnotations = this.model.getApplicableAnnotations();
		$(this.el).html(html);
		for (var annotationName in applicableAnnotations) {
			var el = $('#annotation-control option[value="' + annotationName + '"]')
			var text = $(el).text()
			$(el)
				.prop('disabled', false)
				.text(text + ' (' + applicableAnnotations[annotationName] + ')')		
		}

		var inSCC = false;
		for (var i = 0; i < this.sccs.length; i++) {
			if (this.sccs[i].indexOf(this.model.get('last_source_id')) != -1 &&
				this.sccs[i].indexOf(this.model.get('last_target_id')) != -1) {
				inSCC = true;
				$('#cssc-info').show();
				$('#cssc-info .count').text(this.sccs[i].length);
				this.sccsGroupId = i;
			}
		}
		if (!inSCC) {
			$('#cssc-info').hide();
		}
		$('#annotation-control').val(this.annotation.get('name'));
		$('#intent-control').val(this.annotation.get('intent'));
		if (this.annotation.get('name') == 'restore-equality') {
			$('#annotation-direction-control').show();	
		} else {
			$('#annotation-direction-control').hide();	
		}
		$('#annotation-control').change(function(e) {
			$('#annotation-info').html(self.annotationHints[$(e.target).val()]);
			if ($(e.target).val() == 'restore-equality') {
				$('#annotation-direction-control').show();
			} else {
				$('#annotation-direction-control').hide();
			}
		})
	},

	save: function() {
		var name = $('#annotation-control').val();
		if (!name) {
			return;
		}
		if (Ann.currentAnnotationView) {
			if (Ann.currentAnnotationView.model != this.model) {
				return;
			}
			
		}
		name = name.toLowerCase();
		var intent = $('#intent-control').val();
		var name = $('#annotation-control').val().toLowerCase()
		this.annotation.set('name', name);
		this.annotation.set('intent', intent);
		this.annotation.set('repo_path', Ann.currentRepo.get('path'));
		this.annotation.set('auto_updated', false);
		this.annotation.set('annotated_value', this.model.get('last_diff_ratio'));
		if (name == 'restore-equality') {
			var propagationTarget = $('#annotation-direction-control select').val()
			this.annotation.set('propagate_to', propagationTarget);
		}

		$('#annotate-save').addClass('disabled').removeClass('primary');
		this.annotation.save({},{
			success: function(){
			if (Ann.variantTreeView) {
				Ann.variantTreeView.updateLevelCounts();
			}
			$('#annotate-save').addClass('primary').removeClass('disabled');
			}
		});
	},

	saveSCC: function() {
		var name = $('#annotation-control').val();
		if (!name) {
			return;
		}
		if (Ann.currentAnnotationView) {
			if (Ann.currentAnnotationView.model != this.model) {
				return;
			}
			
		}
		var intent = $('#intent-control').val();
		var data = {
			repo_path : Ann.currentRepo.get('path'),
			repo_name : Ann.currentRepo.get('name'),
			group_id  : this.sccsGroupId,
			name      : name,
			intent    : intent
		}
		$('#annotate-scc').addClass('disabled').removeClass('primary');
		$.post('/api/annotations/sccs/annotate/', data, function() {
			if (Ann.variantTreeView) {
				Ann.variantTreeView.updateLevelCounts();
			}
			$('#annotate-scc').addClass('primary').removeClass('disabled');
		})
	}

})
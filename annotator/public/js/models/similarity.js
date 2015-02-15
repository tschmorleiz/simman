var Ann = Ann || {};
Ann.Models = Ann.Models || {};


Ann.Models.Similarity = Backbone.Model.extend({

  urlRoot: '/api/similarities/',

  applicabilities: function() {
    return {
      'equal': {
        'equal': {
          'maintain-equality': this.get('auto') !== false ? 'auto' : 'manual',
          'ignore' : 'auto'
        },
        'unequal': {
        	'maintain-similarity': 'manual',
          'restore-equality': this.get('auto') !== false ? 'auto' : 'manual',
          'increase-similarity' : 'manual',
          'restore-similarity': 'manual',
          'ignore' : 'auto'
        }
      },
      'unequal': {
        'equal' : {
          'maintain-equality': this.get('auto') !== false ? 'auto' : 'manual',
          'ignore': 'auto'
        },
        'unequal': {
        	'maintain-similarity': 'manual',
          'increase-similarity': 'manual',
          'restore-similarity': 'manual',
          'establish-equality': 'manual',
          'ignore': 'auto'
        }
      }
    }
  },

  getApplicableAnnotations: function() {
  	var first = this.get('first_diff_ratio') == 1 ? 'equal' : 'unequal';
  	var last = this.get('last_diff_ratio') == 1 ? 'equal' : 'unequal';
    console.log(first, last)
  	return this.applicabilities()[first][last];
  }

})

Ann.Models.SimilaritiesGroup = Backbone.Collection.extend({
  model: Ann.Models.Similarity

});
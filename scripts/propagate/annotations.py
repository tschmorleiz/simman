def update_annotation(annotation, evolution):
	print annotation
	annotation_name = annotation['name']
	new_annotation_name = annotation_name
	ratio = evolution['last_diff_ratio']

	if annotation_name == 'ignore':
		return

	sim_annotations_names = [
		'increase-similarity',
		'maintain-similarity',
		'restore-equality'
	]

	if annotation_name in sim_annotations_names and ratio == 1:
		new_annotation_name = 'maintain-equality'

	if annotation == 'maintain-equality' and ratio != 1:
		new_annotation_name == 'restore-equality'

	annotation['name'] = new_annotation_name
	return annotation
